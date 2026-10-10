"""A student explicitly shares a reviewed report, never their private study history."""

import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.models import (
    AuditEvent,
    Person,
    SchoolRelationship,
    SchoolReport,
    SchoolReportRecipient,
    StudyMessage,
)
from school2036.school import role, valid_relationships
from school2036.school_report_schemas import SchoolReportDraft, SchoolReportInput, SchoolReportView
from school2036.study import conversation_for, require_study_id
from school2036.study_providers import ProviderUnavailable
from school2036.study_reports import draft_report
from sqlalchemy import and_, func, or_, select


def school_report_router(config, sessions):
    router = APIRouter(prefix="/api/v1", tags=["school"])

    def recipient_link(student_id, recipient_id):
        return (
            valid_relationships()
            .where(
                SchoolRelationship.student_id == student_id,
                SchoolRelationship.staff_id == recipient_id,
            )
            .exists()
        )

    def views(db, user, report_id=None):
        visible = or_(
            SchoolReport.student_id == user.id,
            and_(
                SchoolReportRecipient.account_id == user.id,
                recipient_link(SchoolReport.student_id, user.id),
            ),
        )
        ids = select(SchoolReport.id).join(SchoolReportRecipient).where(visible).distinct()
        chosen = select(SchoolReport.id).where(SchoolReport.id.in_(ids))
        if report_id:
            chosen = chosen.where(SchoolReport.id == report_id)
        chosen = chosen.order_by(SchoolReport.created.desc(), SchoolReport.id).limit(200)
        rows = db.execute(
            select(SchoolReport, SchoolReportRecipient.account_id, Person.name)
            .join(SchoolReportRecipient)
            .join(Person, Person.id == SchoolReport.student_id)
            .where(SchoolReport.id.in_(chosen), visible)
            .order_by(
                SchoolReport.created.desc(), SchoolReport.id, SchoolReportRecipient.account_id
            )
        )
        reports = {}
        for report, recipient_id, student_name in rows:
            if report.id not in reports:
                reports[report.id] = {
                    "id": report.id,
                    "student_id": report.student_id,
                    "student_name": student_name,
                    "title": report.title,
                    "body": report.body,
                    "created": report.created,
                    "conversation_id": report.conversation_id
                    if report.student_id == user.id
                    else None,
                    "recipient_ids": [],
                }
            reports[report.id]["recipient_ids"].append(recipient_id)
        return list(reports.values())

    @router.get("/school/reports", response_model=list[SchoolReportView])
    def list_reports(request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            return views(db, user)

    @router.get("/school/reports/{report_id}", response_model=SchoolReportView)
    def get_report(report_id: str, request: Request):
        require_study_id(report_id, "Report not found")
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            result = views(db, user, report_id)
            if not result:
                raise HTTPException(404, "Report not found")
            return result[0]

    @router.post("/school/reports", response_model=SchoolReportView, status_code=201)
    def share_report(data: SchoolReportInput, request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            if data.conversation_id:
                conversation_for(db, user.id, str(data.conversation_id))
            for recipient_id in data.recipient_ids:
                if not db.scalar(select(recipient_link(user.id, str(recipient_id)))):
                    raise HTTPException(404, "This recipient relationship is not available")
            count = db.scalar(
                select(func.count())
                .select_from(SchoolReport)
                .where(SchoolReport.student_id == user.id)
            )
            if count >= 200:
                raise HTTPException(429, "Report limit reached. Contact your administrator.")
            report = SchoolReport(
                id=str(uuid4()),
                student_id=user.id,
                conversation_id=str(data.conversation_id) if data.conversation_id else None,
                title=data.title,
                body=data.body,
                created=time.time(),
            )
            db.add(report)
            db.flush()
            db.add_all(
                SchoolReportRecipient(report_id=report.id, account_id=str(recipient_id))
                for recipient_id in data.recipient_ids
            )
            db.flush()
            audit(
                db, "school.report_shared", user.id, report.id, recipients=len(data.recipient_ids)
            )
            return views(db, user, report.id)[0]

    @router.post(
        "/study/conversations/{conversation_id}/report-draft", response_model=SchoolReportDraft
    )
    async def report_draft(conversation_id: str, request: Request):
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            conversation_for(db, user.id, conversation_id)
            messages = list(
                reversed(
                    list(
                        db.scalars(
                            select(StudyMessage)
                            .where(StudyMessage.conversation_id == conversation_id)
                            .order_by(StudyMessage.created.desc(), StudyMessage.id.desc())
                            .limit(40)
                        )
                    )
                )
            )
            if not any(message.role == "user" and message.content.strip() for message in messages):
                raise HTTPException(409, "Start a conversation before drafting a report")
            history = [{"role": message.role, "content": message.content} for message in messages]
            attempts = (
                select(func.count())
                .select_from(AuditEvent)
                .where(
                    AuditEvent.actor == user.id,
                    AuditEvent.action == "school.report_draft_requested",
                )
            )
            if (
                db.scalar(attempts.where(AuditEvent.at > time.time() - 60)) >= 3
                or db.scalar(attempts.where(AuditEvent.at > time.time() - 86400))
                >= config.study_daily_requests
            ):
                raise HTTPException(429, "Report drafting limit reached. Please try again later.")
            # Commit attempts, including failures, before calling the model outside a DB lock.
            audit(db, "school.report_draft_requested", user.id, conversation_id)
        try:
            result = await draft_report(config, history)
        except ProviderUnavailable as error:
            raise HTTPException(503, error.message) from None
        with sessions.begin() as db:
            user = authenticate(config, db, request)[1]
            role(user, "student")
            conversation_for(db, user.id, conversation_id)
        return {**result, "conversation_id": conversation_id, "requires_review": True}

    return router
