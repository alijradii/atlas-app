"""Durable study work with short database transactions around bounded provider calls.

A lost answer lease is not replayed automatically: the provider may have charged for
it. The user can make a new attempt. Deleted/revoked sources and cancelled/expired
sessions are checked again before any generated text is saved.
"""

import time
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from school2036.identity import audit, locked_state
from school2036.models import (
    Account,
    AuthSession,
    OutboxJob,
    StudyConversation,
    StudyLesson,
    StudyMessage,
    StudyRun,
)
from school2036.study import ACTIVE_RUNS, conversation_for, lesson_for
from school2036.study_providers import ProviderUnavailable, StudyProviders


def _lease(db, job_id, attempt):
    # Match API mutation ordering. This is held only for the small authorization/write
    # transaction, never for a provider call; revocation cannot race the final save.
    locked_state(db)
    job = db.scalar(select(OutboxJob).where(OutboxJob.id == job_id).with_for_update())
    if job is None or job.state != "running" or job.attempts != attempt:
        raise HTTPException(409, "Study work was superseded")


def authorized_run(db, run):
    if run is None or run.state not in ACTIVE_RUNS:
        raise HTTPException(409, "Answer stopped")
    c = db.get(StudyConversation, run.conversation_id)
    if c is None:
        raise HTTPException(404, "Conversation not found")
    account = db.get(Account, c.owner)
    session = db.get(AuthSession, run.session_hash)
    now = time.time()
    if (
        account is None
        or account.status != "active"
        or session is None
        or session.account_id != c.owner
        or session.kind != "user"
        or session.expires <= now
        or session.last_seen + 1800 <= now
    ):
        raise HTTPException(401, "Sign in again to continue studying")
    c = conversation_for(db, c.owner, c.id)
    lessons = [lesson_for(db, c.owner, key) for key in c.lesson_ids]
    if any(lesson.state != "ready" or not lesson.source_id for lesson in lessons):
        raise HTTPException(409, "A selected transcript is no longer ready")
    return c, lessons


def _ingest(sessions, providers, lesson_id, job_attempt, job_id):
    with sessions.begin() as db:
        _lease(db, job_id, job_attempt)
        lesson = db.get(StudyLesson, lesson_id)
        if lesson is None or lesson.state == "deleted":
            return
        # Preparation may have committed before the worker lost its final outbox
        # acknowledgement. A current lease finishes bookkeeping without a new
        # upload or downgrading a source that is already durably ready.
        if lesson.state == "ready" and lesson.source_id:
            return
        owner = db.get(Account, lesson.owner)
        if owner is None or owner.status != "active":
            raise HTTPException(403, "Account is unavailable")
        if job_attempt > 1:
            raise ProviderUnavailable("interrupted", "Preparation was interrupted. Please retry.")
        if lesson.state != "queued":
            return
        text = lesson.transcript
        lesson.state, lesson.error = "indexing", ""
    # No account/global installation lock is held while the service indexes.
    source_id = providers.upload_transcript(text, f"{lesson_id}.txt")
    with sessions.begin() as db:
        _lease(db, job_id, job_attempt)
        lesson = db.get(StudyLesson, lesson_id)
        if lesson is None or lesson.state == "deleted":
            return
        lesson.source_id = source_id
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        receipt = providers.receipt(source_id)
        with sessions.begin() as db:
            _lease(db, job_id, job_attempt)
            lesson = db.get(StudyLesson, lesson_id)
            if lesson is None or lesson.state == "deleted":
                return
            if receipt["state"] == "ready":
                lesson.state, lesson.error = "ready", ""
                audit(db, "study.lesson_ready", lesson.owner, lesson.id)
                return
            if receipt["state"] == "failed":
                raise ProviderUnavailable(
                    "index_failed", "Transcript preparation failed. Please retry."
                )
        time.sleep(2)
    raise ProviderUnavailable(
        "index_timeout", "Transcript preparation took too long. Please retry."
    )


def _answer(sessions, providers, run_id, job_attempt, job_id):
    with sessions.begin() as db:
        _lease(db, job_id, job_attempt)
        run = db.get(StudyRun, run_id)
        if run is None or run.state not in ACTIVE_RUNS:
            return
        if job_attempt > 1:
            raise ProviderUnavailable(
                "interrupted", "The answer was interrupted. Please try again."
            )
        c, lessons = authorized_run(db, run)
        sources = {
            lesson.source_id: {"lesson_id": lesson.id, "title": lesson.title} for lesson in lessons
        }
        question = db.get(StudyMessage, run.message_id).content
        history = [
            {"role": message.role, "content": message.content}
            for message in db.scalars(
                select(StudyMessage)
                .where(StudyMessage.conversation_id == c.id, StudyMessage.id != run.message_id)
                .order_by(StudyMessage.created.desc())
                .limit(12)
            )
        ]
        history.reverse()
        run.state, run.updated = "retrieving", time.time()
    passages = providers.retrieve(question, list(sources))
    # Recheck before a second paid operation; RAG evidence never grants access.
    with sessions.begin() as db:
        _lease(db, job_id, job_attempt)
        run = db.get(StudyRun, run_id)
        _, lessons = authorized_run(db, run)
        if set(sources) != {lesson.source_id for lesson in lessons}:
            raise HTTPException(409, "Selected transcripts changed; start a new answer")
        run.state, run.updated = "answering", time.time()
    for passage in passages:
        if passage.get("source_id") not in sources:
            raise ProviderUnavailable(
                "invalid_scope", "The study service returned invalid sources."
            )
    answer = providers.answer(question, history, passages)
    citations = [
        {
            "index": i,
            **sources[p["source_id"]],
            "quote": p["content"],
            "location": (
                f"{'Page' if p.get('page_basis') == 'physical' else 'Transcript section'} "
                f"{p.get('page') or 1}"
            ),
        }
        for i, p in enumerate(passages, 1)
    ]
    with sessions.begin() as db:
        _lease(db, job_id, job_attempt)
        run = db.scalar(select(StudyRun).where(StudyRun.id == run_id).with_for_update())
        c, lessons = authorized_run(db, run)
        if set(sources) != {lesson.source_id for lesson in lessons}:
            raise HTTPException(409, "Selected transcripts changed; start a new answer")
        now = time.time()
        db.add(
            StudyMessage(
                id=str(uuid4()),
                conversation_id=c.id,
                role="assistant",
                content=answer,
                citations=citations,
                created=now,
            )
        )
        c.updated = now
        run.state, run.updated = "completed", now
        audit(db, "study.answer_completed", c.owner, run.id)


def process_study_job(sessions, config, job_id, lease_attempt, providers=None):
    with sessions.begin() as db:
        job = db.get(OutboxJob, job_id)
        if not job or job.state != "running" or job.attempts != lease_attempt:
            return True
        kind, payload = job.kind, dict(job.payload)
    provider = providers or StudyProviders(config)
    error = None
    try:
        if kind == "study.ingest":
            _ingest(sessions, provider, payload["lesson_id"], lease_attempt, job_id)
        elif kind == "study.answer":
            _answer(sessions, provider, payload["run_id"], lease_attempt, job_id)
        else:
            raise ValueError("unsupported_study_job")
    except ProviderUnavailable as exc:
        error = exc.message
    except HTTPException as exc:
        error = str(exc.detail)
    except Exception:
        # Never expose provider payloads, credentials or source text in job errors.
        error = "Study processing was interrupted. Please try again."
    with sessions.begin() as db:
        job = db.scalar(select(OutboxJob).where(OutboxJob.id == job_id).with_for_update())
        if job is None or job.state != "running" or job.attempts != lease_attempt:
            return True
        job.state, job.error = ("failed", "study_failed") if error else ("succeeded", None)
        if error and kind == "study.ingest":
            lesson = db.get(StudyLesson, payload["lesson_id"])
            if lesson and lesson.state != "deleted":
                lesson.state, lesson.error = "failed", error
        if error and kind == "study.answer":
            run = db.get(StudyRun, payload["run_id"])
            if run and run.state in ACTIVE_RUNS:
                run.state, run.error, run.updated = "failed", error, time.time()
    return True
