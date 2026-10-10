"""Real PostgreSQL study boundaries with injected, non-network provider doubles."""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from school2036.models import (
    AuthSession,
    InstallationState,
    OutboxJob,
    StudyLesson,
    StudyMessage,
    StudyRun,
)
from school2036.study_jobs import process_study_job
from school2036.study_providers import NO_EVIDENCE, StudyProviders
from sqlalchemy import func, select, text
from test_identity import login

BASE = "/api/v1/study"
TRANSCRIPT = "A net force changes acceleration. Force equals mass times acceleration."


class Providers:
    def __init__(self, *, retrieve_hook=None, answer_hook=None, upload_hook=None):
        self.retrieve_hook = retrieve_hook
        self.answer_hook = answer_hook
        self.upload_hook = upload_hook
        self.calls = []

    def upload_transcript(self, transcript, filename):
        self.calls.append(("upload", transcript, filename))
        if self.upload_hook:
            self.upload_hook()
        return "source_" + filename.removesuffix(".txt")

    def receipt(self, source):
        self.calls.append(("receipt", source))
        return {"state": "ready"}

    def retrieve(self, question, sources):
        self.calls.append(("retrieve", question, sources))
        if self.retrieve_hook:
            self.retrieve_hook()
        return [{"source_id": sources[0], "content": TRANSCRIPT, "page": 2}]

    def answer(self, question, history, passages):
        self.calls.append(("answer", question, history, passages))
        if self.answer_hook:
            self.answer_hook()
        return "Acceleration is net force divided by mass. [1]"


@pytest.fixture
def study(system):
    client, _, config = system
    config.rag_api_key = SecretStr("test-rag-placeholder")
    config.gemini_api_key = SecretStr("test-gemini-placeholder")
    login(client)
    return system


def other_client(system, user):
    _, app, config = system
    client = TestClient(app, headers={"Origin": config.public_origin})
    login(client, user)
    return client


def claim(app, kind, target):
    with app.state.sessions.begin() as db:
        jobs = list(db.scalars(select(OutboxJob).where(OutboxJob.kind == kind)))
        job = next(job for job in jobs if target in job.payload.values())
        job.state = "running"
        job.attempts += 1
        job.available = time.time() + 600
        return job.id, job.attempts


def process(system, kind, target, providers=None):
    _, app, config = system
    job, attempt = claim(app, kind, target)
    assert process_study_job(app.state.sessions, config, job, attempt, providers or Providers())
    return job


def add_lesson(system, ready=True):
    client, _, _ = system
    response = client.post(
        BASE + "/lessons",
        json={
            "title": "Newton's second law",
            "subject": "Physics",
            "transcript": TRANSCRIPT,
        },
    )
    assert response.status_code == 202, response.text
    lesson = response.json()
    assert "source_id" not in lesson and "transcript" not in lesson
    if ready:
        process(system, "study.ingest", lesson["id"])
    return lesson["id"]


def conversation(client, lesson):
    response = client.post(BASE + "/conversations", json={"lesson_ids": [lesson]})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def send(client, conversation_id, request_id=None):
    response = client.post(
        BASE + f"/conversations/{conversation_id}/messages",
        json={
            "content": "How do I find acceleration?",
            "request_id": request_id or str(uuid4()),
        },
    )
    assert response.status_code == 202, response.text
    return response.json()["id"]


def run_state(app, run_id):
    with app.state.sessions() as db:
        run = db.get(StudyRun, run_id)
        count = db.scalar(
            select(func.count())
            .select_from(StudyMessage)
            .where(
                StudyMessage.conversation_id == run.conversation_id,
                StudyMessage.role == "assistant",
            )
        )
        return run.state, run.error, count


def test_study_auth_csrf_origin_and_forbidden_provider_scope(study):
    client, app, config = study
    with TestClient(app, headers={"Origin": config.public_origin}) as guest:
        assert guest.get(BASE + "/lessons").status_code == 401
        assert (
            guest.post(BASE + "/conversations", json={"lesson_ids": [str(uuid4())]}).status_code
            == 401
        )
    payload = {"title": "Forces", "transcript": TRANSCRIPT}
    csrf = client.headers.pop("X-CSRF-Token")
    assert client.post(BASE + "/lessons", json=payload).status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    assert (
        client.post(
            BASE + "/lessons", json=payload, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    for extra in ({"owner": "bob"}, {"source_id": "private_source"}, {"state": "ready"}):
        assert client.post(BASE + "/lessons", json=payload | extra).status_code == 422
    lesson = add_lesson(study)
    assert (
        client.post(
            BASE + "/conversations", json={"lesson_ids": [lesson], "source_ids": ["private_source"]}
        ).status_code
        == 422
    )
    cid = conversation(client, lesson)
    for extra in ({"sources": ["private_source"]}, {"role": "assistant"}):
        assert (
            client.post(
                BASE + f"/conversations/{cid}/messages",
                json={"content": "Question", "request_id": str(uuid4())} | extra,
            ).status_code
            == 422
        )


def test_transcript_preparation_history_citations_and_replay(study):
    client, app, config = study
    lesson = add_lesson(study, ready=False)
    assert client.post(BASE + "/conversations", json={"lesson_ids": [lesson]}).status_code == 409
    ingest = Providers()
    process(study, "study.ingest", lesson, ingest)
    assert client.get(BASE + f"/lessons/{lesson}").json()["state"] == "ready"
    assert ingest.calls[0][1] == TRANSCRIPT
    cid = conversation(client, lesson)
    run = send(client, cid)
    providers = Providers()
    job = process(study, "study.answer", run, providers)
    detail = client.get(BASE + f"/conversations/{cid}").json()
    assert detail["run"]["state"] == "completed"
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    citation = detail["messages"][1]["citations"][0]
    assert citation["lesson_id"] == lesson and citation["quote"] == TRANSCRIPT
    assert citation["location"] == "Transcript section 2"
    assert "source_id" not in citation
    assert process_study_job(app.state.sessions, config, job, 1, providers)
    assert len(providers.calls) == 2
    second = send(client, cid)
    process(study, "study.answer", second, providers)
    assert [entry["role"] for entry in providers.calls[-1][2]] == ["user", "assistant"]


def test_same_request_double_send_is_one_message_run_and_job(study):
    client, app, _ = study
    cid = conversation(client, add_lesson(study))
    request_id = str(uuid4())
    barrier = Barrier(2)

    def submit():
        barrier.wait(timeout=5)
        return send(client, cid, request_id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _: submit(), range(2)))
    assert ids[0] == ids[1]
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(StudyRun)) == 1
        assert db.scalar(select(func.count()).select_from(StudyMessage)) == 1
        assert (
            db.scalar(
                select(func.count()).select_from(OutboxJob).where(OutboxJob.kind == "study.answer")
            )
            == 1
        )
    assert (
        client.post(
            BASE + f"/conversations/{cid}/messages",
            json={"content": "A different question", "request_id": request_id},
        ).status_code
        == 409
    )
    assert (
        client.post(
            BASE + f"/conversations/{cid}/messages",
            json={"content": "Another question", "request_id": str(uuid4())},
        ).status_code
        == 409
    )


def test_explicit_grants_do_not_transfer_ownership_and_revocation_hides_history(study):
    alice, _, _ = study
    lesson = add_lesson(study)
    alice_cid = conversation(alice, lesson)
    with other_client(study, "bob") as bob:
        assert bob.get(BASE + f"/lessons/{lesson}").status_code == 404
        assert bob.post(BASE + "/conversations", json={"lesson_ids": [lesson]}).status_code == 404
        grant = alice.post(BASE + f"/lessons/{lesson}/access", json={"login": "bob"})
        assert grant.status_code == 200
        assert bob.get(BASE + f"/lessons/{lesson}").json()["owned"] is False
        assert bob.delete(BASE + f"/lessons/{lesson}").status_code == 404
        assert bob.get(BASE + f"/lessons/{lesson}/access").status_code == 404
        assert (
            bob.post(BASE + f"/lessons/{lesson}/access", json={"login": "alice"}).status_code == 404
        )
        assert bob.get(BASE + f"/conversations/{alice_cid}").status_code == 404
        cid = conversation(bob, lesson)
        run = send(bob, cid)
        process(study, "study.answer", run)
        assert bob.get(BASE + f"/conversations/{cid}").status_code == 200
        assert alice.get(BASE + f"/conversations/{cid}").status_code == 404
        assert (
            alice.delete(
                BASE + f"/lessons/{lesson}/access/{grant.json()['account_id']}"
            ).status_code
            == 204
        )
        assert bob.get(BASE + f"/conversations/{cid}").status_code == 404
        assert bob.get(BASE + "/conversations").json() == []
        assert bob.delete(BASE + f"/conversations/{cid}").status_code == 204


@pytest.mark.parametrize("during", ["retrieve", "answer"])
def test_revocation_during_provider_call_discards_output(study, during):
    alice, app, _ = study
    lesson = add_lesson(study)
    with other_client(study, "bob") as bob:
        account = alice.post(BASE + f"/lessons/{lesson}/access", json={"login": "bob"}).json()[
            "account_id"
        ]
        cid = conversation(bob, lesson)
        run = send(bob, cid)

        def revoke():
            assert alice.delete(BASE + f"/lessons/{lesson}/access/{account}").status_code == 204

        providers = Providers(**{during + "_hook": revoke})
        process(study, "study.answer", run, providers)
        state, _, count = run_state(app, run)
        assert state == "failed" and count == 0
        if during == "retrieve":
            assert [call[0] for call in providers.calls] == ["retrieve"]
        assert bob.get(BASE + f"/conversations/{cid}").status_code == 404


@pytest.mark.parametrize("stop", ["cancel", "logout", "expiry", "lesson", "conversation"])
@pytest.mark.parametrize("during", ["retrieve", "answer"])
def test_cancel_expiry_logout_and_deletion_during_generation_discard_answer(study, stop, during):
    client, app, _ = study
    lesson = add_lesson(study)
    cid = conversation(client, lesson)
    run = send(client, cid)

    def interrupt():
        if stop == "cancel":
            assert client.post(BASE + f"/conversations/{cid}/cancel").json()["state"] == "cancelled"
        elif stop == "logout":
            assert client.post("/api/v1/auth/logout").status_code == 200
        elif stop == "expiry":
            with app.state.sessions.begin() as db:
                db.get(AuthSession, db.get(StudyRun, run).session_hash).expires = time.time() - 1
        else:
            path = f"/lessons/{lesson}" if stop == "lesson" else f"/conversations/{cid}"
            assert client.delete(BASE + path).status_code == 204

    providers = Providers(**{during + "_hook": interrupt})
    process(study, "study.answer", run, providers)
    if during == "retrieve":
        assert [call[0] for call in providers.calls] == ["retrieve"]
    state, _, count = run_state(app, run)
    assert state == ("cancelled" if stop in {"cancel", "conversation"} else "failed")
    assert count == 0
    if stop == "lesson":
        assert client.get(BASE + f"/conversations/{cid}").status_code == 404
        assert client.get(BASE + "/conversations").json() == []


def test_provider_calls_hold_no_authentication_or_installation_lock(study):
    client, app, _ = study
    lesson = add_lesson(study)
    cid = conversation(client, lesson)
    run = send(client, cid)
    checks = []

    def inspect_locks():
        with app.state.sessions.begin() as db:
            db.execute(text("SET LOCAL lock_timeout = '300ms'"))
            db.execute(select(InstallationState).with_for_update()).all()
            db.execute(select(AuthSession).with_for_update()).all()
        assert client.get("/api/v1/auth/me").status_code == 200
        checks.append(True)

    process(
        study,
        "study.answer",
        run,
        Providers(retrieve_hook=inspect_locks, answer_hook=inspect_locks),
    )
    assert run_state(app, run)[0] == "completed"
    assert checks == [True, True]


def test_provider_failure_is_safe_and_unscoped_evidence_never_reaches_answer(study):
    client, app, _ = study
    cid = conversation(client, add_lesson(study))
    run = send(client, cid)

    def fail():
        raise RuntimeError("SECRET API KEY and private transcript body")

    process(study, "study.answer", run, Providers(retrieve_hook=fail))
    state, error, count = run_state(app, run)
    assert state == "failed" and count == 0
    assert "SECRET" not in error and "transcript body" not in error
    assert error == "Study processing was interrupted. Please try again."

    class WrongScope(Providers):
        def retrieve(self, question, sources):
            return [{"source_id": "another_account_source", "content": "private"}]

    run = send(client, cid)
    providers = WrongScope()
    process(study, "study.answer", run, providers)
    assert run_state(app, run)[0] == "failed"
    assert providers.calls == []
    assert run_state(app, run)[2] == 0


def test_deleted_ingesting_lesson_is_not_resurrected(study):
    client, app, _ = study
    lesson = add_lesson(study, ready=False)

    def remove():
        assert client.delete(BASE + f"/lessons/{lesson}").status_code == 204

    providers = Providers(upload_hook=remove)
    process(study, "study.ingest", lesson, providers)
    assert [call[0] for call in providers.calls] == ["upload"]
    with app.state.sessions() as db:
        assert db.get(StudyLesson, lesson).state == "deleted"
    assert client.get(BASE + "/lessons").json() == []


def test_reclaimed_lease_cannot_publish_stale_provider_answer(study):
    client, app, config = study
    cid = conversation(client, add_lesson(study))
    run = send(client, cid)
    job_id, attempt = claim(app, "study.answer", run)

    def reclaim():
        with app.state.sessions.begin() as db:
            job = db.get(OutboxJob, job_id)
            job.attempts += 1
            job.available = time.time() + 600

    process_study_job(app.state.sessions, config, job_id, attempt, Providers(answer_hook=reclaim))
    assert run_state(app, run)[2] == 0


def test_reclaimed_ingest_lease_cannot_write_a_stale_source(study):
    _, app, config = study
    lesson = add_lesson(study, ready=False)
    job_id, attempt = claim(app, "study.ingest", lesson)

    def reclaim():
        with app.state.sessions.begin() as db:
            db.get(OutboxJob, job_id).attempts += 1

    providers = Providers(upload_hook=reclaim)
    process_study_job(app.state.sessions, config, job_id, attempt, providers)
    with app.state.sessions() as db:
        value = db.get(StudyLesson, lesson)
        assert value.source_id is None and value.state != "ready"
    assert [call[0] for call in providers.calls] == ["upload"]


def test_lost_generation_is_not_automatically_replayed_and_unconfigured_send_is_safe(study):
    client, app, config = study
    cid = conversation(client, add_lesson(study))
    config.gemini_api_key = SecretStr("")
    response = client.post(
        BASE + f"/conversations/{cid}/messages",
        json={
            "content": "Explain force",
            "request_id": str(uuid4()),
        },
    )
    assert response.status_code == 503
    assert client.get(BASE + f"/conversations/{cid}").json()["messages"] == []
    config.gemini_api_key = SecretStr("test-gemini-placeholder")
    run = send(client, cid)
    job_id, _ = claim(app, "study.answer", run)
    with app.state.sessions.begin() as db:
        db.get(OutboxJob, job_id).attempts = 2
    providers = Providers()
    process_study_job(app.state.sessions, config, job_id, 2, providers)
    assert providers.calls == []
    assert run_state(app, run)[0] == "failed"
    assert run_state(app, run)[2] == 0


@pytest.mark.parametrize("field", ["title", "subject", "content", "login"])
@pytest.mark.parametrize("invalid", ["\x00", "\ud800"], ids=["nul", "unpaired-surrogate"])
def test_invalid_text_inputs_are_validation_errors_not_database_failures(study, field, invalid):
    client, app, _ = study
    lesson = add_lesson(study)
    cid = conversation(client, lesson)
    if field in {"title", "subject"}:
        path = "/lessons"
        payload = {"title": "Forces", "subject": "Physics", "transcript": TRANSCRIPT}
    elif field == "content":
        path = f"/conversations/{cid}/messages"
        payload = {"content": "What is force?", "request_id": str(uuid4())}
    else:
        path = f"/lessons/{lesson}/access"
        payload = {"login": "bob"}
    payload[field] = "valid" + invalid + "text"
    with TestClient(
        app,
        headers=dict(client.headers),
        cookies=client.cookies,
        raise_server_exceptions=False,
    ) as browser:
        response = browser.post(
            BASE + path, content=json.dumps(payload), headers={"Content-Type": "application/json"}
        )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("resource", ["lessons", "conversations"])
@pytest.mark.parametrize("method", ["GET", "DELETE"])
def test_invalid_nul_resource_identifiers_do_not_raise_database_errors(study, resource, method):
    client, app, _ = study
    with TestClient(
        app,
        headers=dict(client.headers),
        cookies=client.cookies,
        raise_server_exceptions=False,
    ) as browser:
        response = browser.request(method, BASE + f"/{resource}/invalid%00identifier")
    assert response.status_code in {404, 422}, response.text


def test_reclaimed_ingest_after_ready_commit_does_not_invalidate_finished_lesson(study):
    client, app, config = study
    lesson_id = add_lesson(study)
    cid = conversation(client, lesson_id)
    with app.state.sessions.begin() as db:
        job = next(
            job
            for job in db.scalars(select(OutboxJob).where(OutboxJob.kind == "study.ingest"))
            if job.payload["lesson_id"] == lesson_id
        )
        # Crash window: ready/source_id committed, final outbox success not yet committed.
        job.state = "running"
        job.attempts = 2
        job_id = job.id
    providers = Providers()
    process_study_job(app.state.sessions, config, job_id, 2, providers)
    assert providers.calls == []
    assert client.get(BASE + f"/lessons/{lesson_id}").json()["state"] == "ready"
    run = send(client, cid)
    process(study, "study.answer", run)
    assert run_state(app, run)[0] == "completed"


def test_invalid_share_target_is_not_a_storage_outage(study):
    client, _, _ = study
    lesson = add_lesson(study)
    response = client.delete(BASE + f"/lessons/{lesson}/access/invalid%00account")
    assert response.status_code == 404


@pytest.mark.parametrize("ready", [False, True])
def test_ingest_recovery_respects_lease_and_never_replays_unfinished_upload(study, ready):
    _, app, config = study
    lesson_id = add_lesson(study, ready=ready)
    with app.state.sessions.begin() as db:
        job = next(
            job
            for job in db.scalars(select(OutboxJob).where(OutboxJob.kind == "study.ingest"))
            if job.payload["lesson_id"] == lesson_id
        )
        job.state, job.attempts = "running", 2
        job_id = job.id
        if not ready:
            lesson = db.get(StudyLesson, lesson_id)
            lesson.state, lesson.source_id = "indexing", "unfinished-source"
    providers = Providers()
    # A stale original worker must not finish a newer lease, even for ready data.
    process_study_job(app.state.sessions, config, job_id, 1, providers)
    with app.state.sessions() as db:
        assert db.get(OutboxJob, job_id).state == "running"
        assert db.get(StudyLesson, lesson_id).state == ("ready" if ready else "indexing")
    process_study_job(app.state.sessions, config, job_id, 2, providers)
    assert providers.calls == []
    with app.state.sessions() as db:
        assert db.get(OutboxJob, job_id).state == ("succeeded" if ready else "failed")
        assert db.get(StudyLesson, lesson_id).state == ("ready" if ready else "failed")


def test_followup_without_hits_does_not_treat_old_answer_as_evidence_or_pay_model(study):
    client, _, config = study
    cid = conversation(client, add_lesson(study))
    process(study, "study.answer", send(client, cid))
    calls = []

    def no_hits(request):
        calls.append(request.url.path)
        assert request.url.path == "/v1/rag/naive", "No Gemini call without current evidence"
        payload = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "kind": "retrieval_evidence",
                "version": 1,
                "status": "completed",
                "source_ids": payload["source_ids"],
                "sources": [],
                "candidates": [],
            },
        )

    response = client.post(
        BASE + f"/conversations/{cid}/messages",
        json={
            "content": "Could you explain that again?",
            "request_id": str(uuid4()),
        },
    )
    assert response.status_code == 202
    process(
        study,
        "study.answer",
        response.json()["id"],
        StudyProviders(config, transport=httpx.MockTransport(no_hits)),
    )
    detail = client.get(BASE + f"/conversations/{cid}").json()
    assert detail["run"]["state"] == "completed"
    assert detail["messages"][-1]["content"] == NO_EVIDENCE
    assert detail["messages"][-1]["citations"] == []
    assert calls == ["/v1/rag/naive"]


def test_open_study_persists_without_rag_and_keeps_history_private(study):
    client, app, config = study
    config.rag_api_key = SecretStr("")
    response = client.post(BASE + "/conversations", json={})
    assert response.status_code == 201
    cid = response.json()["id"]
    assert response.json()["lesson_ids"] == []
    assert response.json()["title"] == "Study session"
    request_id = str(uuid4())
    run = send(client, cid, request_id)
    assert send(client, cid, request_id) == run
    requests = []

    def tutor(request):
        requests.append(request)
        assert request.url.host == "generativelanguage.googleapis.com"
        body = json.loads(request.content)
        packet = json.loads(body["contents"][0]["parts"][0]["text"])
        assert packet["evidence"] == []
        if len(requests) == 2:
            assert [turn["role"] for turn in packet["history"]] == ["user", "assistant"]
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": "Try dividing force by mass."}]},
                    }
                ]
            },
        )

    provider = StudyProviders(config, transport=httpx.MockTransport(tutor))
    process(study, "study.answer", run, provider)
    detail = client.get(BASE + f"/conversations/{cid}").json()
    assert detail["run"]["state"] == "completed"
    assert detail["title"] == "How do I find acceleration?"
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert all(m["citations"] == [] for m in detail["messages"])
    assert client.get(BASE + "/conversations").json()[0]["id"] == cid
    process(study, "study.answer", send(client, cid), provider)
    assert len(requests) == 2
    with other_client(study, "bob") as bob:
        assert bob.get(BASE + f"/conversations/{cid}").status_code == 404
        assert bob.get(BASE + "/conversations").json() == []
    assert run_state(app, run)[0] == "completed"


@pytest.mark.parametrize("stop", ["cancel", "logout", "expiry", "conversation"])
def test_open_study_discards_output_after_access_or_run_changes(study, stop):
    client, app, config = study
    cid = client.post(BASE + "/conversations", json={"lesson_ids": []}).json()["id"]
    run = send(client, cid)

    def tutor(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        if stop == "cancel":
            assert client.post(BASE + f"/conversations/{cid}/cancel").status_code == 200
        elif stop == "logout":
            assert client.post("/api/v1/auth/logout").status_code == 200
        elif stop == "expiry":
            with app.state.sessions.begin() as db:
                db.get(AuthSession, db.get(StudyRun, run).session_hash).expires = time.time() - 1
        else:
            assert client.delete(BASE + f"/conversations/{cid}").status_code == 204
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": "Discard this answer."}]},
                    }
                ]
            },
        )

    process(
        study, "study.answer", run, StudyProviders(config, transport=httpx.MockTransport(tutor))
    )
    state, _, count = run_state(app, run)
    assert state == ("cancelled" if stop in {"cancel", "conversation"} else "failed")
    assert count == 0


def test_open_study_keeps_model_budget_auth_and_csrf_limits(study):
    client, app, config = study
    with TestClient(app, headers={"Origin": config.public_origin}) as guest:
        assert guest.post(BASE + "/conversations", json={}).status_code == 401
    csrf = client.headers.pop("X-CSRF-Token")
    assert client.post(BASE + "/conversations", json={}).status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    cid = client.post(BASE + "/conversations", json={}).json()["id"]
    payload = {"content": "Help me study", "request_id": str(uuid4())}
    config.gemini_api_key = SecretStr("")
    assert client.post(BASE + f"/conversations/{cid}/messages", json=payload).status_code == 503
    config.gemini_api_key = SecretStr("test-gemini-placeholder")
    config.study_daily_requests = 1
    send(client, cid)
    assert client.post(BASE + f"/conversations/{cid}/messages", json=payload).status_code == 409
    client.post(BASE + f"/conversations/{cid}/cancel")
    assert client.post(BASE + f"/conversations/{cid}/messages", json=payload).status_code == 429
