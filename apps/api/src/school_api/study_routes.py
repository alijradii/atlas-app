"""Authenticated study routes; the browser never supplies RAG source identifiers."""

import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.jobs import enqueue
from school2036.models import (
    Account,
    Person,
    StudyAccess,
    StudyConversation,
    StudyLesson,
    StudyMessage,
    StudyRun,
)
from school2036.study import (
    ACTIVE_RUNS,
    accessible_lessons,
    conversation_for,
    conversation_view,
    lesson_for,
    lesson_view,
    require_study_id,
    run_view,
)
from school2036.study_schemas import (
    AccessInput,
    AccessView,
    ConversationDetail,
    ConversationInput,
    ConversationView,
    LessonDetail,
    LessonInput,
    LessonView,
    MessageInput,
    RunView,
    StudyStatus,
)
from sqlalchemy import delete, func, select


def study_router(config, sessions):
    router = APIRouter(prefix="/api/v1/study", tags=["study"])

    def actor(db, request):
        return authenticate(config, db, request)[1]

    @router.get("/status", response_model=StudyStatus)
    def status(request: Request):
        with sessions.begin() as db:
            actor(db, request)
            return {
                "rag_configured": bool(config.rag_api_key.get_secret_value()),
                "answer_configured": bool(config.gemini_api_key.get_secret_value()),
            }

    @router.get("/lessons", response_model=list[LessonView])
    def lessons(request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            return [
                lesson_view(value, user.id)
                for value in db.scalars(
                    accessible_lessons(user.id).order_by(StudyLesson.created.desc())
                )
            ]

    @router.post("/lessons", response_model=LessonView, status_code=202)
    def add_lesson(data: LessonInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            count = db.scalar(
                select(func.count())
                .select_from(StudyLesson)
                .where(StudyLesson.owner == user.id, StudyLesson.state != "deleted")
            )
            if count >= 40:
                raise HTTPException(
                    429, "Keep at most 40 transcripts. Remove an older lesson first."
                )
            value = StudyLesson(
                id=str(uuid4()),
                owner=user.id,
                title=data.title,
                subject=data.subject,
                transcript=data.transcript,
                state="queued",
                error="",
                created=time.time(),
            )
            db.add(value)
            db.flush()
            enqueue(db, "study.ingest", user.id, {"lesson_id": value.id})
            audit(db, "study.lesson_added", user.id, value.id)
            return lesson_view(value, user.id)

    @router.get("/lessons/{lesson_id}", response_model=LessonDetail)
    def lesson_detail(lesson_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            return lesson_view(lesson_for(db, user.id, lesson_id), user.id, detail=True)

    @router.post("/lessons/{lesson_id}/retry", response_model=LessonView)
    def retry_lesson(lesson_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            value = lesson_for(db, user.id, lesson_id, owner=True)
            if value.state != "failed":
                raise HTTPException(409, "Only failed preparation can be retried")
            value.state, value.error = "queued", ""
            enqueue(db, "study.ingest", user.id, {"lesson_id": value.id})
            return lesson_view(value, user.id)

    @router.delete("/lessons/{lesson_id}", status_code=204)
    def delete_lesson(lesson_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            value = lesson_for(db, user.id, lesson_id, owner=True)
            value.state = "deleted"
            audit(db, "study.lesson_deleted", user.id, value.id)
        return Response(status_code=204)

    @router.get("/lessons/{lesson_id}/access", response_model=list[AccessView])
    def access(lesson_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            lesson_for(db, user.id, lesson_id, owner=True)
            rows = db.execute(
                select(Account, Person)
                .join(Person, Person.id == Account.id)
                .join(StudyAccess, StudyAccess.account_id == Account.id)
                .where(StudyAccess.lesson_id == lesson_id)
            )
            return [{"account_id": a.id, "login": a.login, "name": p.name} for a, p in rows]

    @router.post("/lessons/{lesson_id}/access", response_model=AccessView)
    def share(lesson_id: str, data: AccessInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            lesson_for(db, user.id, lesson_id, owner=True)
            other = db.scalar(
                select(Account).where(
                    Account.login == data.login.lower(), Account.status == "active"
                )
            )
            if other is None:
                raise HTTPException(404, "No active account with that login")
            if other.id == user.id:
                raise HTTPException(409, "You already own this lesson")
            if db.get(StudyAccess, (lesson_id, other.id)) is None:
                db.add(StudyAccess(lesson_id=lesson_id, account_id=other.id))
                audit(db, "study.access_granted", user.id, lesson_id, reader=other.id)
            return {
                "account_id": other.id,
                "login": other.login,
                "name": db.get(Person, other.id).name,
            }

    @router.delete("/lessons/{lesson_id}/access/{account_id}", status_code=204)
    def revoke(lesson_id: str, account_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            lesson_for(db, user.id, lesson_id, owner=True)
            require_study_id(account_id, "Account not found")
            db.execute(
                delete(StudyAccess).where(
                    StudyAccess.lesson_id == lesson_id, StudyAccess.account_id == account_id
                )
            )
            audit(db, "study.access_revoked", user.id, lesson_id, reader=account_id)
        return Response(status_code=204)

    @router.get("/conversations", response_model=list[ConversationView])
    def conversations(request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            allowed = set(db.scalars(accessible_lessons(user.id).with_only_columns(StudyLesson.id)))
            return [
                conversation_view(c)
                for c in db.scalars(
                    select(StudyConversation)
                    .where(StudyConversation.owner == user.id, StudyConversation.deleted.is_(False))
                    .order_by(StudyConversation.updated.desc())
                )
                if set(c.lesson_ids) <= allowed
            ]

    @router.post("/conversations", response_model=ConversationView, status_code=201)
    def create_conversation(data: ConversationInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            selected = [lesson_for(db, user.id, str(key)) for key in dict.fromkeys(data.lesson_ids)]
            if any(lesson.state != "ready" or not lesson.source_id for lesson in selected):
                raise HTTPException(409, "Wait for the selected transcripts to be ready")
            count = db.scalar(
                select(func.count())
                .select_from(StudyConversation)
                .where(StudyConversation.owner == user.id, StudyConversation.deleted.is_(False))
            )
            if count >= 100:
                raise HTTPException(429, "Remove an older conversation before starting another")
            now = time.time()
            value = StudyConversation(
                id=str(uuid4()),
                owner=user.id,
                title=selected[0].title,
                lesson_ids=[lesson.id for lesson in selected],
                created=now,
                updated=now,
                deleted=False,
            )
            db.add(value)
            db.flush()
            return conversation_view(value)

    @router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
    def conversation_detail(conversation_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            c = conversation_for(db, user.id, conversation_id)
            messages = db.scalars(
                select(StudyMessage)
                .where(StudyMessage.conversation_id == c.id)
                .order_by(StudyMessage.created, StudyMessage.id)
            )
            run = db.scalar(
                select(StudyRun)
                .where(StudyRun.conversation_id == c.id)
                .order_by(StudyRun.created.desc())
                .limit(1)
            )
            return {
                **conversation_view(c),
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "content": m.content,
                        "created": m.created,
                        "citations": m.citations,
                    }
                    for m in messages
                ],
                "run": run_view(run),
            }

    @router.post(
        "/conversations/{conversation_id}/messages", response_model=RunView, status_code=202
    )
    def message(conversation_id: str, data: MessageInput, request: Request):
        with sessions.begin() as db:
            current, user, _ = authenticate(config, db, request)
            c = conversation_for(db, user.id, conversation_id)
            prior = db.scalar(
                select(StudyRun).where(
                    StudyRun.conversation_id == c.id, StudyRun.request_id == str(data.request_id)
                )
            )
            if prior:
                if db.get(StudyMessage, prior.message_id).content != data.content:
                    raise HTTPException(
                        409, "That request key was already used for another message"
                    )
                return run_view(prior)
            if (
                not config.gemini_api_key.get_secret_value()
                or not config.rag_api_key.get_secret_value()
            ):
                raise HTTPException(
                    503, "Study providers are not configured. Your transcripts are saved."
                )
            if any(lesson_for(db, user.id, key).state != "ready" for key in c.lesson_ids):
                raise HTTPException(409, "A selected transcript is not ready")
            owned_runs = (
                select(StudyRun)
                .join(StudyConversation, StudyConversation.id == StudyRun.conversation_id)
                .where(StudyConversation.owner == user.id)
            )
            if db.scalar(owned_runs.where(StudyRun.state.in_(ACTIVE_RUNS)).limit(1)):
                raise HTTPException(
                    409, "Wait for your current answer or stop it before sending another"
                )
            recent = db.scalar(
                owned_runs.with_only_columns(func.count()).where(
                    StudyRun.created > time.time() - 86400
                )
            )
            if recent >= config.study_daily_requests:
                raise HTTPException(429, "Daily study limit reached. Please return later.")
            length = db.scalar(
                select(func.count())
                .select_from(StudyMessage)
                .where(StudyMessage.conversation_id == c.id)
            )
            if length >= 100:
                raise HTTPException(
                    409, "Start a new conversation to continue studying these lessons"
                )
            now = time.time()
            value = StudyMessage(
                id=str(uuid4()),
                conversation_id=c.id,
                role="user",
                content=data.content,
                citations=[],
                created=now,
            )
            db.add(value)
            db.flush()
            run = StudyRun(
                id=str(uuid4()),
                conversation_id=c.id,
                message_id=value.id,
                request_id=str(data.request_id),
                session_hash=current.token_hash,
                state="queued",
                error="",
                created=now,
                updated=now,
            )
            db.add(run)
            db.flush()
            c.updated = now
            enqueue(db, "study.answer", user.id, {"run_id": run.id})
            audit(db, "study.answer_requested", user.id, run.id)
            return run_view(run)

    @router.post("/conversations/{conversation_id}/cancel", response_model=RunView)
    def cancel(conversation_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            c = conversation_for(db, user.id, conversation_id)
            run = db.scalar(
                select(StudyRun)
                .where(StudyRun.conversation_id == c.id)
                .order_by(StudyRun.created.desc())
                .limit(1)
            )
            if run is None:
                raise HTTPException(404, "No answer to stop")
            if run.state in ACTIVE_RUNS:
                run.state, run.updated = "cancelled", time.time()
            return run_view(run)

    @router.delete("/conversations/{conversation_id}", status_code=204)
    def delete_conversation(conversation_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            # Owners may delete their conversation even after a lesson was revoked.
            require_study_id(conversation_id, "Conversation not found")
            c = db.get(StudyConversation, conversation_id)
            if c is None or c.owner != user.id or c.deleted:
                raise HTTPException(404, "Conversation not found")
            c.deleted = True
            for run in db.scalars(
                select(StudyRun).where(
                    StudyRun.conversation_id == c.id, StudyRun.state.in_(ACTIVE_RUNS)
                )
            ):
                run.state = "cancelled"
        return Response(status_code=204)

    return router
