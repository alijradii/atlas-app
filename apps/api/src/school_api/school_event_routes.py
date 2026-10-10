"""Human-owned calendar: visibility follows current school responsibilities."""

import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.models import Person, SchoolEvent, SchoolEventStudent, SchoolRelationship
from school2036.school import relationship_exists, require_relationship, role, valid_relationships
from school2036.school_event_schemas import SchoolEventEdit, SchoolEventInput, SchoolEventView
from school2036.study import require_study_id
from sqlalchemy import and_, delete, func, or_, select


def school_event_router(config, sessions):
    router = APIRouter(prefix="/api/v1/school/events", tags=["school"])

    def visible_audience(user):
        own = and_(SchoolEvent.teacher_id == user.id, "teacher" in user.roles)
        responsibility = (
            valid_relationships()
            .where(
                SchoolRelationship.staff_id == user.id,
                SchoolRelationship.student_id == SchoolEventStudent.student_id,
            )
            .exists()
        )
        return or_(
            own,
            and_(
                relationship_exists(
                    SchoolEvent.teacher_id, SchoolEventStudent.student_id, "teacher"
                ),
                or_(
                    and_(SchoolEventStudent.student_id == user.id, "student" in user.roles),
                    responsibility,
                ),
            ),
        )

    def views(db, user, event_id=None):
        # First bound the event set, then fetch visible audience rows in one query.
        # Parents/advisors do not receive unrelated students' identities.
        visible = (
            select(SchoolEvent.id).join(SchoolEventStudent).where(visible_audience(user)).distinct()
        )
        events = select(SchoolEvent.id).where(SchoolEvent.id.in_(visible))
        if event_id:
            events = events.where(SchoolEvent.id == event_id)
        events = events.order_by(SchoolEvent.starts_at, SchoolEvent.id).limit(200)
        records = db.execute(
            select(SchoolEvent, SchoolEventStudent.student_id, Person.name)
            .join(SchoolEventStudent)
            .join(Person, Person.id == SchoolEvent.teacher_id)
            .where(SchoolEvent.id.in_(events), visible_audience(user))
            .order_by(SchoolEvent.starts_at, SchoolEvent.id, SchoolEventStudent.student_id)
        )
        result = {}
        for event, student_id, name in records:
            if event.id not in result:
                result[event.id] = {
                    key: getattr(event, key)
                    for key in (
                        "id",
                        "teacher_id",
                        "title",
                        "description",
                        "location",
                        "starts_at",
                        "ends_at",
                        "state",
                        "created",
                        "updated",
                    )
                } | {
                    "organizer_name": name,
                    "student_ids": [],
                    "can_manage": event.teacher_id == user.id and "teacher" in user.roles,
                }
            result[event.id]["student_ids"].append(student_id)
        return list(result.values())

    def validate_audience(db, user, student_ids):
        for student_id in student_ids:
            require_relationship(db, user.id, str(student_id), "teacher")

    def set_audience(db, event_id, student_ids):
        db.execute(delete(SchoolEventStudent).where(SchoolEventStudent.event_id == event_id))
        db.add_all(
            SchoolEventStudent(event_id=event_id, student_id=str(student_id))
            for student_id in student_ids
        )
        db.flush()

    @router.get("", response_model=list[SchoolEventView])
    def list_events(request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            return views(db, user)

    @router.get("/{event_id}", response_model=SchoolEventView)
    def get_event(event_id: str, request: Request):
        require_study_id(event_id, "Event not found")
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            result = views(db, user, event_id)
            if not result:
                raise HTTPException(404, "Event not found")
            return result[0]

    @router.post("", response_model=SchoolEventView, status_code=201)
    def create_event(data: SchoolEventInput, request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "teacher")
            validate_audience(db, user, data.student_ids)
            if (
                db.scalar(
                    select(func.count())
                    .select_from(SchoolEvent)
                    .where(SchoolEvent.teacher_id == user.id)
                )
                >= 200
            ):
                raise HTTPException(429, "Event limit reached. Contact your administrator.")
            now = time.time()
            event = SchoolEvent(
                id=str(uuid4()),
                teacher_id=user.id,
                state="scheduled",
                created=now,
                updated=now,
                **data.model_dump(exclude={"student_ids"}),
            )
            db.add(event)
            db.flush()
            set_audience(db, event.id, data.student_ids)
            audit(db, "school.event_created", user.id, event.id)
            return views(db, user, event.id)[0]

    @router.patch("/{event_id}", response_model=SchoolEventView)
    def edit_event(event_id: str, data: SchoolEventEdit, request: Request):
        require_study_id(event_id, "Event not found")
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "teacher")
            event = db.scalar(
                select(SchoolEvent).where(SchoolEvent.id == event_id).with_for_update()
            )
            if event is None or event.teacher_id != user.id:
                raise HTTPException(404, "Event not found")
            updates = data.model_dump(exclude_unset=True, exclude={"student_ids"})
            start = updates.get("starts_at", event.starts_at)
            end = updates.get("ends_at", event.ends_at)
            if end <= start:
                raise HTTPException(422, "The event must end after it starts")
            if data.student_ids is not None:
                validate_audience(db, user, data.student_ids)
                set_audience(db, event.id, data.student_ids)
            for key, value in updates.items():
                setattr(event, key, value)
            event.updated = time.time()
            audit(db, "school.event_updated", user.id, event.id, state=event.state)
            db.flush()
            return views(db, user, event.id)[0]

    return router
