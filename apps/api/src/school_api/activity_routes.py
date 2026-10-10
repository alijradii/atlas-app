"""Peer opt-ins generate requests; only the linked teacher can organize an event."""

import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from school2036.activities import (
    MIN_SHARED_INTEREST,
    active_participants,
    interest_students,
    lock_teacher,
    request_view,
    request_visible,
    responsible_for,
    suggest_activity,
)
from school2036.activity_schemas import (
    ActivityInterestInput,
    ActivityInterestView,
    ActivityJoinInput,
    ActivityRequestInput,
    ActivityRequestView,
    ActivityReviewInput,
    ActivitySuggestionInput,
)
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.models import (
    ActivityInterest,
    ActivityParticipant,
    ActivityRequest,
    AuditEvent,
    Person,
    SchoolEvent,
    SchoolEventStudent,
)
from school2036.school import relationship_exists, require_relationship, role
from school2036.study import require_study_id
from school2036.study_providers import ProviderUnavailable
from sqlalchemy import and_, func, or_, select


def activity_router(config, sessions):
    router = APIRouter(prefix="/api/v1/school", tags=["school"])

    def capacity(db, teacher_id):
        count = db.scalar(
            select(func.count())
            .select_from(ActivityRequest)
            .where(
                ActivityRequest.teacher_id == teacher_id,
            )
        )
        if count >= 200:
            raise HTTPException(429, "Activity request limit reached. Contact your administrator.")

    @router.get("/activity-interests", response_model=list[ActivityInterestView])
    def interests(request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            own_child_topics = (
                select(ActivityInterest.teacher_id, ActivityInterest.topic)
                .where(
                    responsible_for(user.id, ActivityInterest.student_id),
                    relationship_exists(
                        ActivityInterest.teacher_id, ActivityInterest.student_id, "teacher"
                    ),
                )
                .subquery()
            )
            rows = db.execute(
                select(ActivityInterest, Person.name)
                .join(Person, Person.id == ActivityInterest.teacher_id)
                .where(
                    relationship_exists(
                        ActivityInterest.teacher_id, ActivityInterest.student_id, "teacher"
                    ),
                    or_(
                        and_(ActivityInterest.teacher_id == user.id, "teacher" in user.roles),
                        and_(
                            "student" in user.roles,
                            relationship_exists(ActivityInterest.teacher_id, user.id, "teacher"),
                        ),
                        select(own_child_topics)
                        .where(
                            own_child_topics.c.teacher_id == ActivityInterest.teacher_id,
                            own_child_topics.c.topic == ActivityInterest.topic,
                        )
                        .exists(),
                    ),
                )
                .order_by(ActivityInterest.teacher_id, ActivityInterest.topic)
            )
            result = {}
            for interest, name in rows:
                key = (interest.teacher_id, interest.topic)
                row = result.setdefault(
                    key,
                    {
                        "teacher_id": interest.teacher_id,
                        "organizer_name": name,
                        "topic": interest.topic,
                        "interested_count": 0,
                        "joined": False,
                        "can_suggest": False,
                    },
                )
                row["interested_count"] += 1
                row["joined"] |= interest.student_id == user.id
                row["can_suggest"] = (
                    interest.teacher_id == user.id
                    and "teacher" in user.roles
                    and row["interested_count"] >= MIN_SHARED_INTEREST
                )
            return list(result.values())

    @router.put("/activity-interests", response_model=list[ActivityInterestView])
    def change_interest(data: ActivityInterestInput, request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            teacher_id = str(data.teacher_id)
            lock_teacher(db, teacher_id)
            require_relationship(db, teacher_id, user.id, "teacher")
            existing = db.get(ActivityInterest, (teacher_id, user.id, data.topic))
            if data.interested and existing is None:
                count = db.scalar(
                    select(func.count())
                    .select_from(ActivityInterest)
                    .where(
                        ActivityInterest.student_id == user.id,
                    )
                )
                if count >= 30:
                    raise HTTPException(429, "Keep up to 30 shared interests. Remove one first.")
                db.add(
                    ActivityInterest(
                        teacher_id=teacher_id,
                        student_id=user.id,
                        topic=data.topic,
                        created=time.time(),
                    )
                )
            elif not data.interested and existing is not None:
                db.delete(existing)
            audit(db, "activity.interest_changed", user.id, teacher_id, interested=data.interested)
        return interests(request)

    @router.get("/activity-requests", response_model=list[ActivityRequestView])
    def list_requests(request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            rows = db.scalars(
                select(ActivityRequest)
                .where(request_visible(user))
                .order_by(ActivityRequest.created.desc(), ActivityRequest.id)
                .limit(200)
            )
            return [request_view(db, user, row) for row in rows]

    @router.post("/activity-requests", response_model=ActivityRequestView, status_code=201)
    def create_request(data: ActivityRequestInput, request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            teacher_id = str(data.teacher_id)
            lock_teacher(db, teacher_id)
            require_relationship(db, teacher_id, user.id, "teacher")
            capacity(db, teacher_id)
            now = time.time()
            record = ActivityRequest(
                id=str(uuid4()),
                teacher_id=teacher_id,
                creator_id=user.id,
                topic=data.topic,
                title=data.title,
                description=data.description,
                source="student",
                state="pending",
                teacher_note="",
                evidence_count=0,
                created=now,
                updated=now,
            )
            db.add(record)
            db.flush()
            db.add(ActivityParticipant(request_id=record.id, student_id=user.id))
            db.flush()
            audit(db, "activity.requested", user.id, record.id)
            return request_view(db, user, record)

    @router.post("/activity-requests/suggest", response_model=ActivityRequestView)
    async def suggest(data: ActivitySuggestionInput, request: Request):
        # Commit the attempt before networking. No DB transaction is held over the model call.
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "teacher")
            teacher_id = user.id
            lock_teacher(db, teacher_id)
            count = len(interest_students(db, teacher_id, data.topic))
            if count < MIN_SHARED_INTEREST:
                raise HTTPException(
                    409, "At least 3 currently linked students must share this interest."
                )
            pending = select(ActivityRequest).where(
                ActivityRequest.teacher_id == teacher_id,
                ActivityRequest.topic == data.topic,
                ActivityRequest.source == "ai",
                ActivityRequest.state == "pending",
            )
            existing = db.scalar(pending)
            if existing is not None:
                return request_view(db, user, existing)
            capacity(db, teacher_id)
            attempts = (
                select(func.count())
                .select_from(AuditEvent)
                .where(
                    AuditEvent.actor == teacher_id,
                    AuditEvent.action == "activity.suggestion_requested",
                )
            )
            if (
                db.scalar(attempts.where(AuditEvent.at > time.time() - 60)) >= 3
                or db.scalar(attempts.where(AuditEvent.at > time.time() - 86400)) >= 20
            ):
                raise HTTPException(429, "Activity suggestion limit reached. Please try later.")
            audit(db, "activity.suggestion_requested", teacher_id)
        try:
            suggestion = await suggest_activity(config, data.topic, count)
        except ProviderUnavailable as error:
            raise HTTPException(503, error.message) from None
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "teacher")
            if user.id != teacher_id:
                raise HTTPException(409, "Your account changed. Please try again.")
            lock_teacher(db, teacher_id)
            current_count = len(interest_students(db, teacher_id, data.topic))
            if current_count != count:
                raise HTTPException(409, "Shared interests changed. Ask for a fresh suggestion.")
            existing = db.scalar(pending)
            if existing is not None:
                return request_view(db, user, existing)
            capacity(db, teacher_id)
            now = time.time()
            record = ActivityRequest(
                id=str(uuid4()),
                teacher_id=teacher_id,
                creator_id=None,
                topic=data.topic,
                title=suggestion.title,
                description=suggestion.description,
                source="ai",
                state="pending",
                teacher_note="",
                evidence_count=count,
                created=now,
                updated=now,
            )
            db.add(record)
            db.flush()
            audit(db, "activity.suggested", teacher_id, record.id, evidence_count=count)
            return request_view(db, user, record)

    @router.put("/activity-requests/{request_id}/interest", response_model=ActivityRequestView)
    def join_request(request_id: str, data: ActivityJoinInput, request: Request):
        require_study_id(request_id, "Activity request not found")
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            record = db.get(ActivityRequest, request_id)
            if record is None:
                raise HTTPException(404, "Activity request not found")
            lock_teacher(db, record.teacher_id)
            db.refresh(record)
            require_relationship(db, record.teacher_id, user.id, "teacher")
            if record.state != "pending":
                raise HTTPException(409, "This request has already been reviewed")
            existing = db.get(ActivityParticipant, (request_id, user.id))
            if data.interested and existing is None:
                db.add(ActivityParticipant(request_id=request_id, student_id=user.id))
            elif not data.interested and existing is not None:
                db.delete(existing)
            db.flush()
            audit(
                db,
                "activity.participation_changed",
                user.id,
                request_id,
                interested=data.interested,
            )
            return request_view(db, user, record)

    @router.patch("/activity-requests/{request_id}", response_model=ActivityRequestView)
    def review(request_id: str, data: ActivityReviewInput, request: Request):
        require_study_id(request_id, "Activity request not found")
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "teacher")
            lock_teacher(db, user.id)
            record = db.get(ActivityRequest, request_id)
            if record is None or record.teacher_id != user.id:
                raise HTTPException(404, "Activity request not found")
            if record.state != "pending":
                raise HTTPException(409, "This request has already been reviewed")
            if data.event_id:
                event = db.get(SchoolEvent, str(data.event_id))
                if event is None or event.teacher_id != user.id or event.state != "scheduled":
                    raise HTTPException(404, "Scheduled event not found")
                audience = set(
                    db.scalars(
                        select(SchoolEventStudent.student_id).where(
                            SchoolEventStudent.event_id == event.id,
                        )
                    )
                )
                if not set(active_participants(db, record)).issubset(audience):
                    raise HTTPException(409, "Include the interested students in the event first.")
                record.event_id = event.id
            record.state = data.state
            record.teacher_note = data.teacher_note
            record.updated = time.time()
            audit(db, "activity.reviewed", user.id, record.id, state=data.state)
            db.flush()
            return request_view(db, user, record)

    return router
