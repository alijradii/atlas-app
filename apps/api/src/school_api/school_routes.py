"""Authenticated, relationship-scoped school workflows available from home or school."""

import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.models import (
    Account,
    Person,
    SchoolAssignment,
    SchoolMessage,
    SchoolProposal,
    SchoolPublication,
    SchoolRelationship,
    StudyLesson,
)
from school2036.school import (
    ROLES,
    record_view,
    related,
    relationship_exists,
    require_relationship,
    role,
    valid_relationships,
)
from school2036.school_schemas import (
    AdvisorMessageInput,
    AdvisorMessageView,
    AssignmentInput,
    AssignmentView,
    FeedbackInput,
    ProposalDecisionInput,
    ProposalEditInput,
    ProposalInput,
    ProposalReviewInput,
    ProposalView,
    PublicationInput,
    PublicationView,
    SchoolWorkspace,
    SubmissionInput,
)
from school2036.study import lesson_for, require_study_id
from sqlalchemy import func, or_, select


def school_router(config, sessions):
    router = APIRouter(prefix="/api/v1/school", tags=["school"])

    def actor(db, request):
        return authenticate(config, db, request)[1]

    def quota(db, model, condition, limit):
        if db.scalar(select(func.count()).select_from(model).where(condition)) >= limit:
            raise HTTPException(429, "Workspace limit reached. Contact your administrator.")

    def publication_view(db, value, lesson=None):
        lesson = lesson or db.get(StudyLesson, value.lesson_id)
        return {
            "id": value.id,
            "teacher_id": value.teacher_id,
            "student_id": value.student_id,
            "lesson_id": value.lesson_id,
            "title": lesson.title,
            "subject": lesson.subject,
            "created": value.created,
        }

    def publish(db, user, student_id, lesson_id):
        role(user, "teacher")
        require_relationship(db, user.id, student_id, "teacher")
        lesson = lesson_for(db, user.id, lesson_id, owner=True)
        if lesson.state != "ready" or not lesson.source_id:
            raise HTTPException(409, "Prepare this lesson before publishing it")
        value = db.scalar(
            select(SchoolPublication).where(
                SchoolPublication.teacher_id == user.id,
                SchoolPublication.student_id == student_id,
                SchoolPublication.lesson_id == lesson_id,
            )
        )
        if value is None:
            quota(db, SchoolPublication, SchoolPublication.teacher_id == user.id, 500)
            value = SchoolPublication(
                id=str(uuid4()),
                teacher_id=user.id,
                student_id=student_id,
                lesson_id=lesson_id,
                created=time.time(),
            )
            db.add(value)
            db.flush()
            audit(db, "school.lesson_published", user.id, value.id, student=student_id)
        return value

    def assignment_for(db, user, key):
        require_study_id(key, "Assignment not found")
        value = db.get(SchoolAssignment, key)
        if value is None or not related(db, value.teacher_id, value.student_id, "teacher"):
            raise HTTPException(404, "Assignment not found")
        if not (
            (user.id == value.teacher_id and "teacher" in user.roles)
            or (user.id == value.student_id and "student" in user.roles)
        ):
            raise HTTPException(404, "Assignment not found")
        return value

    def proposal_available(db, value):
        return related(db, value.advisor_id, value.student_id, "advisor") and (
            value.parent_id is None or related(db, value.parent_id, value.student_id, "parent")
        )

    def proposal_for(db, user, key):
        require_study_id(key, "Proposal not found")
        value = db.get(SchoolProposal, key)
        if (
            value is None
            or user.id not in (value.student_id, value.advisor_id, value.parent_id)
            or not proposal_available(db, value)
        ):
            raise HTTPException(404, "Proposal not found")
        return value

    @router.get("/workspace", response_model=SchoolWorkspace)
    def workspace(request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            links = list(
                db.scalars(
                    valid_relationships().where(
                        or_(
                            SchoolRelationship.staff_id == user.id,
                            SchoolRelationship.student_id == user.id,
                        )
                    )
                )
            )
            advisees = {
                link.student_id
                for link in links
                if link.staff_id == user.id and link.kind == "advisor"
            }
            parent_links = list(
                db.scalars(
                    valid_relationships().where(
                        SchoolRelationship.kind == "parent",
                        SchoolRelationship.student_id.in_(advisees),
                    )
                )
            )
            contact_ids = {
                link.student_id if link.staff_id == user.id else link.staff_id for link in links
            } | {link.staff_id for link in parent_links}
            contacts = {
                account.id: (account, person)
                for account, person in db.execute(
                    select(Account, Person)
                    .join(Person, Person.id == Account.id)
                    .where(Account.id.in_(contact_ids))
                )
            }
            people = []
            person_by_key = {}
            children = set()
            for link in links:
                other_id = link.student_id if link.staff_id == user.id else link.staff_id
                kind = "student" if link.staff_id == user.id else link.kind
                if link.staff_id == user.id and link.kind == "parent":
                    children.add(link.student_id)
                if (other_id, kind) not in person_by_key:
                    other, person = contacts[other_id]
                    people.append(
                        {
                            "account_id": other_id,
                            "login": other.login,
                            "name": person.name,
                            "relationship": kind,
                            "student_ids": [link.student_id],
                            "responsibilities": [link.kind],
                        }
                    )
                    person_by_key[(other_id, kind)] = people[-1]
                else:
                    person = person_by_key[(other_id, kind)]
                    if link.student_id not in person["student_ids"]:
                        person["student_ids"].append(link.student_id)
                    if link.kind not in person["responsibilities"]:
                        person["responsibilities"].append(link.kind)
            # Advisors need the designated parent choices for their own advisees,
            # not a searchable directory of unrelated families.
            for link in parent_links:
                existing = next(
                    (
                        p
                        for p in people
                        if p["account_id"] == link.staff_id and p["relationship"] == "parent"
                    ),
                    None,
                )
                if existing:
                    if link.student_id not in existing["student_ids"]:
                        existing["student_ids"].append(link.student_id)
                else:
                    other, person = contacts[link.staff_id]
                    people.append(
                        {
                            "account_id": other.id,
                            "login": other.login,
                            "name": person.name,
                            "relationship": "parent",
                            "student_ids": [link.student_id],
                            "responsibilities": [link.kind],
                        }
                    )
            publications = [
                publication_view(db, p, lesson)
                for p, lesson in db.execute(
                    select(SchoolPublication, StudyLesson)
                    .join(StudyLesson)
                    .where(
                        or_(
                            SchoolPublication.teacher_id == user.id,
                            SchoolPublication.student_id == user.id,
                        ),
                        StudyLesson.state != "deleted",
                        relationship_exists(
                            SchoolPublication.teacher_id, SchoolPublication.student_id, "teacher"
                        ),
                    )
                    .order_by(SchoolPublication.created.desc())
                    .limit(500)
                )
            ]
            assignments = [
                record_view(a, AssignmentView)
                for a in db.scalars(
                    select(SchoolAssignment)
                    .where(
                        or_(
                            SchoolAssignment.teacher_id == user.id,
                            SchoolAssignment.student_id == user.id,
                            SchoolAssignment.student_id.in_(children),
                        ),
                        relationship_exists(
                            SchoolAssignment.teacher_id, SchoolAssignment.student_id, "teacher"
                        ),
                    )
                    .order_by(SchoolAssignment.created.desc())
                    .limit(200)
                )
            ]
            messages = [
                record_view(m, AdvisorMessageView)
                for m in db.scalars(
                    select(SchoolMessage)
                    .where(
                        or_(
                            SchoolMessage.advisor_id == user.id, SchoolMessage.student_id == user.id
                        ),
                        relationship_exists(
                            SchoolMessage.advisor_id, SchoolMessage.student_id, "advisor"
                        ),
                    )
                    .order_by(SchoolMessage.created.desc(), SchoolMessage.id)
                    .limit(200)
                )
            ]
            proposals = [
                record_view(p, ProposalView)
                for p in db.scalars(
                    select(SchoolProposal)
                    .where(
                        or_(
                            SchoolProposal.advisor_id == user.id,
                            SchoolProposal.student_id == user.id,
                            SchoolProposal.parent_id == user.id,
                        ),
                        relationship_exists(
                            SchoolProposal.advisor_id, SchoolProposal.student_id, "advisor"
                        ),
                        or_(
                            SchoolProposal.parent_id.is_(None),
                            relationship_exists(
                                SchoolProposal.parent_id, SchoolProposal.student_id, "parent"
                            ),
                        ),
                    )
                    .order_by(SchoolProposal.updated.desc())
                    .limit(200)
                )
            ]
            return {
                "account_id": user.id,
                "name": db.get(Person, user.id).name,
                "roles": sorted(ROLES.intersection(user.roles)),
                "people": people,
                "publications": publications,
                "assignments": assignments,
                "messages": list(reversed(messages)),
                "proposals": proposals,
            }

    @router.post("/publications", response_model=PublicationView, status_code=201)
    def add_publication(data: PublicationInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            return publication_view(
                db, publish(db, user, str(data.student_id), str(data.lesson_id))
            )

    @router.delete("/publications/{publication_id}", status_code=204)
    def remove_publication(publication_id: str, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            role(user, "teacher")
            require_study_id(publication_id, "Publication not found")
            value = db.get(SchoolPublication, publication_id)
            if value is None or value.teacher_id != user.id:
                raise HTTPException(404, "Publication not found")
            # Owners may revoke even after the student relationship has been removed.
            db.delete(value)
            audit(db, "school.lesson_unpublished", user.id, publication_id)
        return Response(status_code=204)

    @router.post("/assignments", response_model=AssignmentView, status_code=201)
    def add_assignment(data: AssignmentInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            role(user, "teacher")
            student_id = str(data.student_id)
            require_relationship(db, user.id, student_id, "teacher")
            quota(db, SchoolAssignment, SchoolAssignment.teacher_id == user.id, 200)
            lesson_id = str(data.lesson_id) if data.lesson_id else None
            if lesson_id:
                publish(db, user, student_id, lesson_id)
            value = SchoolAssignment(
                id=str(uuid4()),
                teacher_id=user.id,
                student_id=student_id,
                lesson_id=lesson_id,
                title=data.title,
                instructions=data.instructions,
                due_at=data.due_at,
                state="assigned",
                answer="",
                feedback="",
                created=time.time(),
                submitted_at=None,
            )
            db.add(value)
            db.flush()
            audit(db, "school.assignment_created", user.id, value.id)
            return record_view(value, AssignmentView)

    @router.post("/assignments/{assignment_id}/submit", response_model=AssignmentView)
    def submit(assignment_id: str, data: SubmissionInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            role(user, "student")
            value = assignment_for(db, user, assignment_id)
            if value.student_id != user.id:
                raise HTTPException(403, "Only the assigned student can submit work")
            if value.state not in ("assigned", "returned"):
                raise HTTPException(409, "This work has already been submitted")
            value.answer, value.state, value.submitted_at = data.answer, "submitted", time.time()
            audit(db, "school.assignment_submitted", user.id, value.id)
            return record_view(value, AssignmentView)

    @router.post("/assignments/{assignment_id}/feedback", response_model=AssignmentView)
    def feedback(assignment_id: str, data: FeedbackInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            role(user, "teacher")
            value = assignment_for(db, user, assignment_id)
            if value.teacher_id != user.id:
                raise HTTPException(403, "Only the assigning teacher can review work")
            if value.state != "submitted":
                raise HTTPException(409, "Wait for the student's submission")
            value.feedback = data.feedback
            value.state = "returned" if data.return_for_revision else "reviewed"
            audit(db, "school.assignment_reviewed", user.id, value.id, state=value.state)
            return record_view(value, AssignmentView)

    @router.post("/messages", response_model=AdvisorMessageView, status_code=201)
    def add_message(data: AdvisorMessageInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            student_id, advisor_id = str(data.student_id), str(data.advisor_id)
            if user.id not in (student_id, advisor_id):
                raise HTTPException(403, "Only this student and their advisor can send messages")
            require_relationship(db, advisor_id, student_id, "advisor")
            quota(
                db,
                SchoolMessage,
                (SchoolMessage.sender_id == user.id)
                & (SchoolMessage.created > time.time() - 86400),
                100,
            )
            value = SchoolMessage(
                id=str(uuid4()),
                student_id=student_id,
                advisor_id=advisor_id,
                sender_id=user.id,
                content=data.content,
                created=time.time(),
            )
            db.add(value)
            db.flush()
            audit(db, "school.advisor_message_sent", user.id, value.id)
            return record_view(value, AdvisorMessageView)

    @router.post("/proposals", response_model=ProposalView, status_code=201)
    def add_proposal(data: ProposalInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            student_id, advisor_id = str(data.student_id), str(data.advisor_id)
            parent_id = str(data.parent_id) if data.parent_id else None
            if user.id not in (student_id, advisor_id):
                raise HTTPException(403, "Only the student or their advisor can propose a plan")
            require_relationship(db, advisor_id, student_id, "advisor")
            if parent_id:
                require_relationship(db, parent_id, student_id, "parent")
            elif db.scalar(
                valid_relationships()
                .where(
                    SchoolRelationship.student_id == student_id, SchoolRelationship.kind == "parent"
                )
                .limit(1)
            ):
                raise HTTPException(422, "Select a linked parent to review this proposal")
            quota(db, SchoolProposal, SchoolProposal.student_id == student_id, 100)
            now = time.time()
            value = SchoolProposal(
                id=str(uuid4()),
                student_id=student_id,
                advisor_id=advisor_id,
                parent_id=parent_id,
                title=data.title,
                description=data.description,
                state="pending_advisor",
                advisor_note="",
                parent_note="",
                created=now,
                updated=now,
            )
            db.add(value)
            db.flush()
            audit(db, "school.proposal_created", user.id, value.id)
            return record_view(value, ProposalView)

    @router.put("/proposals/{proposal_id}", response_model=ProposalView)
    def revise(proposal_id: str, data: ProposalEditInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            value = proposal_for(db, user, proposal_id)
            if user.id != value.student_id:
                raise HTTPException(403, "Only the student can revise their proposal")
            if value.state != "revision_requested":
                raise HTTPException(409, "This proposal is not awaiting revision")
            value.title, value.description = data.title, data.description
            value.state, value.updated = "pending_advisor", time.time()
            audit(db, "school.proposal_revised", user.id, value.id)
            return record_view(value, ProposalView)

    @router.post("/proposals/{proposal_id}/review", response_model=ProposalView)
    def review(proposal_id: str, data: ProposalReviewInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            value = proposal_for(db, user, proposal_id)
            if user.id != value.advisor_id:
                raise HTTPException(403, "Only the assigned advisor can review this proposal")
            if value.state != "pending_advisor":
                raise HTTPException(409, "This proposal is not awaiting advisor review")
            value.state = {
                "approve": "pending_parent" if value.parent_id else "approved",
                "revise": "revision_requested",
                "decline": "declined",
            }[data.decision]
            value.advisor_note, value.updated = data.note, time.time()
            audit(db, "school.proposal_reviewed", user.id, value.id, decision=data.decision)
            return record_view(value, ProposalView)

    @router.post("/proposals/{proposal_id}/decision", response_model=ProposalView)
    def decide(proposal_id: str, data: ProposalDecisionInput, request: Request):
        with sessions.begin() as db:
            user = actor(db, request)
            value = proposal_for(db, user, proposal_id)
            if user.id != value.parent_id:
                raise HTTPException(403, "Only the selected parent can decide this proposal")
            if value.state != "pending_parent":
                raise HTTPException(409, "Wait for advisor approval before deciding")
            value.state = "approved" if data.decision == "approve" else "declined"
            value.parent_note, value.updated = data.note, time.time()
            audit(db, "school.proposal_decided", user.id, value.id, decision=data.decision)
            return record_view(value, ProposalView)

    return router
