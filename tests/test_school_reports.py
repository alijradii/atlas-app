"""Reports require an explicit student share; recipient links never expose private chats."""

import asyncio
import json
import time
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr
from school2036.config import Settings
from school2036.models import Account, AuditEvent, SchoolReport, StudyConversation, StudyMessage
from school2036.operator import set_relationship
from school2036.study_providers import ProviderUnavailable
from school2036.study_reports import draft_report
from sqlalchemy import func, select
from test_school import school as school

BASE = "/api/v1/school/reports"


def conversation(school, owner="bob", messages=None):
    _, ids, app, _ = school
    key = str(uuid4())
    now = time.time()
    with app.state.sessions.begin() as db:
        db.add(
            StudyConversation(
                id=key,
                owner=ids[owner],
                title="Exploring robotics",
                lesson_ids=[],
                created=now,
                updated=now,
                deleted=False,
            )
        )
        db.flush()
        for index, message in enumerate(
            messages
            if messages is not None
            else [
                {"role": "user", "content": "I want to build a small robot."},
                {"role": "assistant", "content": "You could start with a paper prototype."},
            ]
        ):
            db.add(
                StudyMessage(
                    id=str(uuid4()),
                    conversation_id=key,
                    citations=[],
                    created=now + index,
                    **message,
                )
            )
    return key


def shared(school, conversation_id=None):
    clients, ids, _, _ = school
    response = clients["bob"].post(
        BASE,
        json={
            "title": "My robotics idea",
            "body": "I would like support trying a small robotics project.",
            "recipient_ids": [ids["alice"], ids["parent"]],
            "conversation_id": conversation_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_student_shares_only_reviewed_document_with_chosen_recipients(school):
    clients, ids, app, _ = school
    key = conversation(school)
    report = shared(school, key)
    assert report["conversation_id"] == key
    assert set(report["recipient_ids"]) == {ids["alice"], ids["parent"]}
    for name in ("alice", "parent"):
        view = clients[name].get(f"{BASE}/{report['id']}")
        assert view.status_code == 200, view.text
        assert view.json()["conversation_id"] is None
        assert view.json()["recipient_ids"] == [ids[name]]
        assert clients[name].get(f"/api/v1/study/conversations/{key}").status_code == 404
        assert clients[name].get(BASE).json()[0]["body"] == report["body"]
    for name in ("advisor", "outsider", "otherstudent", "otherparent"):
        assert clients[name].get(BASE).json() == []
        assert clients[name].get(f"{BASE}/{report['id']}").status_code == 404
    with app.state.sessions() as db:
        assert db.get(SchoolReport, report["id"]).body == report["body"]


def test_unlinked_recipients_and_foreign_conversations_are_rejected(school):
    clients, ids, app, _ = school
    foreign = conversation(school, "otherstudent")
    body = {"title": "My idea", "body": "An edited report", "recipient_ids": [ids["parent"]]}
    assert clients["bob"].post(BASE, json=body | {"conversation_id": foreign}).status_code == 404
    assert (
        clients["bob"].post(BASE, json=body | {"recipient_ids": [ids["otherparent"]]}).status_code
        == 404
    )
    assert clients["alice"].post(BASE, json=body).status_code == 403
    assert (
        clients["bob"]
        .post(BASE, json=body | {"recipient_ids": [ids["parent"], ids["parent"]]})
        .status_code
        == 422
    )
    assert clients["bob"].post(BASE, json=body | {"body": "   "}).status_code == 422
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolReport)) == 0


def test_revoking_recipient_link_or_role_removes_report_access(school):
    clients, ids, app, config = school
    report = shared(school)
    set_relationship(config, app.state.sessions, "parent", "bob", "parent", remove=True)
    assert clients["parent"].get(BASE).json() == []
    assert clients["parent"].get(f"{BASE}/{report['id']}").status_code == 404
    with app.state.sessions.begin() as db:
        db.get(Account, ids["alice"]).roles = []
    assert clients["alice"].get(BASE).json() == []
    assert clients["bob"].get(f"{BASE}/{report['id']}").status_code == 200


def test_draft_uses_only_selected_owned_chat_and_never_sends(monkeypatch, school):
    clients, _, app, _ = school
    key = conversation(school)
    conversation(school, messages=[{"role": "user", "content": "Private unrelated topic"}])
    seen = []

    async def fake(config, messages):
        seen.extend(messages)
        return {"title": "Robotics idea", "body": "My draft to review."}

    monkeypatch.setattr("school_api.school_report_routes.draft_report", fake)
    response = clients["bob"].post(f"/api/v1/study/conversations/{key}/report-draft")
    assert response.status_code == 200, response.text
    assert response.json()["requires_review"] is True
    assert response.json()["conversation_id"] == key
    assert len(seen) == 2 and "Private unrelated" not in json.dumps(seen)
    assert clients["parent"].get(BASE).json() == []
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolReport)) == 0
    assert (
        clients["otherstudent"].post(f"/api/v1/study/conversations/{key}/report-draft").status_code
        == 404
    )
    assert (
        clients["parent"].post(f"/api/v1/study/conversations/{key}/report-draft").status_code == 403
    )


def test_model_failure_stays_unsent_and_attempts_are_rate_limited(monkeypatch, school):
    clients, _, app, _ = school
    key = conversation(school)

    async def unavailable(config, messages):
        raise ProviderUnavailable("unavailable", "Drafting is unavailable. Please try again.")

    monkeypatch.setattr("school_api.school_report_routes.draft_report", unavailable)
    for _ in range(3):
        response = clients["bob"].post(f"/api/v1/study/conversations/{key}/report-draft")
        assert response.status_code == 503
        assert response.json()["detail"] == "Drafting is unavailable. Please try again."
    assert clients["bob"].post(f"/api/v1/study/conversations/{key}/report-draft").status_code == 429
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolReport)) == 0
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditEvent)
                .where(AuditEvent.action == "school.report_draft_requested")
            )
            == 3
        )


def test_rechecks_conversation_access_after_generation(monkeypatch, school):
    clients, _, app, _ = school
    key = conversation(school)

    async def delete_during_generation(config, messages):
        with app.state.sessions.begin() as db:
            db.get(StudyConversation, key).deleted = True
        return {"title": "Draft", "body": "Must not be returned"}

    monkeypatch.setattr("school_api.school_report_routes.draft_report", delete_during_generation)
    assert clients["bob"].post(f"/api/v1/study/conversations/{key}/report-draft").status_code == 404


def test_empty_chat_cannot_generate_a_draft(school):
    clients, _, _, _ = school
    key = conversation(school, messages=[])
    assert clients["bob"].post(f"/api/v1/study/conversations/{key}/report-draft").status_code == 409


def test_reports_require_auth(system):
    client, _, _ = system
    assert client.get(BASE).status_code == 401
    assert client.post(f"/api/v1/study/conversations/{uuid4()}/report-draft").status_code == 401


def test_gemini_report_contract_verifies_student_quotes_and_keeps_ai_ideas_separate():
    model = {
        "title": "A robotics project",
        "student_quotes": ["I want to build a small robot."],
        "ai_suggestions": ["Start with a paper prototype."],
        "next_steps": ["Ask my teacher about materials."],
    }
    captured = []

    def handler(request):
        captured.append(json.loads(request.content))
        assert request.headers["x-goog-api-key"] == "synthetic-report-key"
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [{"text": json.dumps(model)}],
                        },
                    }
                ]
            },
        )

    config = Settings(_env_file=None, gemini_api_key=SecretStr("synthetic-report-key"))
    history = [
        {"role": "user", "content": "I want to build a small robot."},
        {"role": "assistant", "content": "Start with a paper prototype."},
    ]
    result = asyncio.run(draft_report(config, history, transport=httpx.MockTransport(handler)))
    assert "## What I said\n> I want to build a small robot." in result["body"]
    assert "## Ideas suggested by AI" in result["body"]
    assert "not an assessment of ability" in result["body"]
    assert "Do not infer personality" in captured[0]["systemInstruction"]["parts"][0]["text"]
    model["student_quotes"] = ["Start with a paper prototype."]
    with pytest.raises(ProviderUnavailable, match="could not be verified"):
        asyncio.run(draft_report(config, history, transport=httpx.MockTransport(handler)))


def test_report_provider_does_not_fabricate_drafts_on_error_or_missing_configuration():
    config = Settings(_env_file=None, gemini_api_key=SecretStr("synthetic-report-key"))
    history = [{"role": "user", "content": "I enjoy drawing."}]
    with pytest.raises(ProviderUnavailable):
        asyncio.run(
            draft_report(
                config,
                history,
                transport=httpx.MockTransport(
                    lambda request: httpx.Response(503, text="sensitive provider internals")
                ),
            )
        )
    with pytest.raises(ProviderUnavailable, match="not configured"):
        asyncio.run(draft_report(Settings(_env_file=None), history))
