"""Study authorization is independent of public preview roles and model output."""

from fastapi import HTTPException
from sqlalchemy import or_, select

from school2036.models import StudyAccess, StudyConversation, StudyLesson

ACTIVE_RUNS = ("queued", "retrieving", "answering")


def accessible_lessons(account_id):
    return select(StudyLesson).where(
        StudyLesson.state != "deleted",
        or_(
            StudyLesson.owner == account_id,
            StudyLesson.id.in_(
                select(StudyAccess.lesson_id).where(StudyAccess.account_id == account_id)
            ),
        ),
    )


def lesson_for(db, account_id, lesson_id, *, owner=False):
    lesson = db.scalar(accessible_lessons(account_id).where(StudyLesson.id == lesson_id))
    if lesson is None or (owner and lesson.owner != account_id):
        raise HTTPException(404, "Lesson not found or access has changed")
    return lesson


def conversation_for(db, account_id, conversation_id):
    conversation = db.get(StudyConversation, conversation_id)
    if conversation is None or conversation.deleted or conversation.owner != account_id:
        raise HTTPException(404, "Conversation not found")
    # Historical assistant messages can contain literal source text. Revocation applies
    # to history and citations as well as new retrievals.
    for lesson_id in conversation.lesson_ids:
        lesson_for(db, account_id, lesson_id)
    return conversation


def lesson_view(lesson, account_id, *, detail=False):
    return {
        "id": lesson.id,
        "title": lesson.title,
        "subject": lesson.subject,
        "state": lesson.state,
        "created": lesson.created,
        "error": lesson.error,
        "owned": lesson.owner == account_id,
        **({"transcript": lesson.transcript} if detail else {}),
    }


def conversation_view(conversation):
    return {
        "id": conversation.id,
        "title": conversation.title,
        "lesson_ids": conversation.lesson_ids,
        "created": conversation.created,
        "updated": conversation.updated,
    }


def run_view(run):
    return {"id": run.id, "state": run.state, "error": run.error} if run else None
