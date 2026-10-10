"""Identity infrastructure. Legacy columns remain compatible with existing databases."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from school2036.database import Base


class InstallationState(Base):
    __tablename__ = "installation_state"
    __table_args__ = (CheckConstraint("id = 1", name="installation_singleton"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    initialized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deployment_id: Mapped[str | None] = mapped_column(String(64))
    bootstrap_hash: Mapped[str | None] = mapped_column(String(64))
    bootstrap_expires: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    draft: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    receipt: Mapped[str | None] = mapped_column(String(64))
    finalize_key: Mapped[str | None] = mapped_column(String(64))
    finalizer_hash: Mapped[str | None] = mapped_column(String(64))


class School(Base):
    __tablename__ = "school"
    __table_args__ = (CheckConstraint("id = 1", name="school_singleton"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    settings: Mapped[dict] = mapped_column(JSON)


class Person(Base):
    __tablename__ = "person"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class Account(Base):
    __tablename__ = "account"
    id: Mapped[str] = mapped_column(ForeignKey("person.id"), primary_key=True)
    login: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    roles: Mapped[list] = mapped_column(JSON)
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    mfa_secret: Mapped[str | None] = mapped_column(Text)
    mfa_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_step: Mapped[int] = mapped_column(Integer, default=-1)
    activation_hash: Mapped[str | None] = mapped_column(String(64))
    activation_expires: Mapped[float] = mapped_column(Float, default=0)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class AuthSession(Base):
    __tablename__ = "auth_session"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("account.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    created: Mapped[float] = mapped_column(Float)
    expires: Mapped[float] = mapped_column(Float)
    last_seen: Mapped[float] = mapped_column(Float)
    authenticated: Mapped[float] = mapped_column(Float, default=0)


class AuditEvent(Base):
    __tablename__ = "audit_event"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    at: Mapped[float] = mapped_column(Float, index=True)
    actor: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(80))
    target: Mapped[str | None] = mapped_column(String(100))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class RateLimit(Base):
    __tablename__ = "rate_limit"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window: Mapped[int] = mapped_column(Integer)
    attempts: Mapped[int] = mapped_column(Integer)


class OutboxJob(Base):
    __tablename__ = "outbox_job"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(60))
    actor: Mapped[str | None] = mapped_column(String(36))
    payload: Mapped[dict] = mapped_column(JSON)
    state: Mapped[str] = mapped_column(String(16), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available: Mapped[float] = mapped_column(Float)
    error: Mapped[str | None] = mapped_column(String(100))


class FileObject(Base):
    """Personal uploads, independent of legacy course attachments."""

    __tablename__ = "personal_file"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    media_type: Mapped[str] = mapped_column(String(100))
    expected_size: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    staging_key: Mapped[str] = mapped_column(String(200), unique=True)
    final_key: Mapped[str | None] = mapped_column(String(200), unique=True)
    state: Mapped[str] = mapped_column(String(20), default="pending")
    error: Mapped[str] = mapped_column(String(200), default="")
    expires: Mapped[float] = mapped_column(Float)


class StudyLesson(Base):
    """An immutable transcript; source identifiers never leave the backend."""

    __tablename__ = "study_lesson"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    subject: Mapped[str] = mapped_column(String(80))
    transcript: Mapped[str] = mapped_column(Text)
    file_id: Mapped[str | None] = mapped_column(ForeignKey("personal_file.id"))
    source_kind: Mapped[str] = mapped_column(
        String(20), default="transcript", server_default="transcript"
    )
    state: Mapped[str] = mapped_column(String(20), default="queued")
    source_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    error: Mapped[str] = mapped_column(String(200), default="")
    created: Mapped[float] = mapped_column(Float)


class StudyAccess(Base):
    __tablename__ = "study_access"
    lesson_id: Mapped[str] = mapped_column(ForeignKey("study_lesson.id"), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True)


class StudyConversation(Base):
    __tablename__ = "study_conversation"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    lesson_ids: Mapped[list] = mapped_column(JSON)
    created: Mapped[float] = mapped_column(Float)
    updated: Mapped[float] = mapped_column(Float)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class StudyMessage(Base):
    __tablename__ = "study_message"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("study_conversation.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    created: Mapped[float] = mapped_column(Float)


class StudyRun(Base):
    __tablename__ = "study_run"
    __table_args__ = (
        # The request key represents one logical send, including a network retry.
        UniqueConstraint("conversation_id", "request_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("study_conversation.id"), index=True)
    message_id: Mapped[str] = mapped_column(ForeignKey("study_message.id"))
    request_id: Mapped[str] = mapped_column(String(36))
    session_hash: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(20), default="queued")
    error: Mapped[str] = mapped_column(String(200), default="")
    created: Mapped[float] = mapped_column(Float)
    updated: Mapped[float] = mapped_column(Float)


class SchoolRelationship(Base):
    """Operator-approved responsibility for one student, never inferred by role alone."""

    __tablename__ = "school_relationship"
    __table_args__ = (
        CheckConstraint("staff_id <> student_id", name="school_relationship_not_self"),
        CheckConstraint(
            "kind IN ('teacher', 'advisor', 'parent')", name="school_relationship_kind"
        ),
    )
    staff_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True, index=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)


class SchoolPublication(Base):
    __tablename__ = "school_publication"
    __table_args__ = (UniqueConstraint("teacher_id", "student_id", "lesson_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("study_lesson.id"))
    created: Mapped[float] = mapped_column(Float)


class SchoolAssignment(Base):
    __tablename__ = "school_assignment"
    __table_args__ = (
        CheckConstraint(
            "state IN ('assigned', 'submitted', 'returned', 'reviewed')",
            name="school_assignment_state",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("study_lesson.id"))
    title: Mapped[str] = mapped_column(String(160))
    instructions: Mapped[str] = mapped_column(Text)
    due_at: Mapped[float | None] = mapped_column(Float)
    state: Mapped[str] = mapped_column(String(16), default="assigned")
    answer: Mapped[str] = mapped_column(Text, default="")
    feedback: Mapped[str] = mapped_column(Text, default="")
    created: Mapped[float] = mapped_column(Float)
    submitted_at: Mapped[float | None] = mapped_column(Float)


class SchoolMessage(Base):
    __tablename__ = "school_message"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("account.id"))
    content: Mapped[str] = mapped_column(Text)
    created: Mapped[float] = mapped_column(Float)


class SchoolProposal(Base):
    __tablename__ = "school_proposal"
    __table_args__ = (
        CheckConstraint(
            "state IN ('pending_advisor', 'pending_parent', 'approved', 'declined', "
            "'revision_requested')",
            name="school_proposal_state",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    advisor_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("account.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(24), default="pending_advisor")
    advisor_note: Mapped[str] = mapped_column(Text, default="")
    parent_note: Mapped[str] = mapped_column(Text, default="")
    created: Mapped[float] = mapped_column(Float)
    updated: Mapped[float] = mapped_column(Float)


class SchoolEvent(Base):
    __tablename__ = "school_event"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="school_event_chronological"),
        CheckConstraint("state IN ('scheduled', 'cancelled')", name="school_event_state"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16), default="scheduled")
    created: Mapped[float] = mapped_column(Float)
    updated: Mapped[float] = mapped_column(Float)


class SchoolEventStudent(Base):
    __tablename__ = "school_event_student"
    event_id: Mapped[str] = mapped_column(ForeignKey("school_event.id"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True, index=True)


class ActivityInterest(Base):
    """Opt-in sharing of one topic with a currently linked teacher's peer group."""

    __tablename__ = "activity_interest"
    teacher_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True)
    topic: Mapped[str] = mapped_column(String(80), primary_key=True)
    created: Mapped[float] = mapped_column(Float)


class ActivityRequest(Base):
    __tablename__ = "activity_request"
    __table_args__ = (
        CheckConstraint("source IN ('student', 'ai')", name="activity_request_source"),
        CheckConstraint(
            "state IN ('pending', 'accepted', 'declined')", name="activity_request_state"
        ),
        CheckConstraint("evidence_count >= 0", name="activity_request_evidence"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    creator_id: Mapped[str | None] = mapped_column(ForeignKey("account.id"))
    topic: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16))
    state: Mapped[str] = mapped_column(String(16), default="pending")
    teacher_note: Mapped[str] = mapped_column(Text, default="")
    event_id: Mapped[str | None] = mapped_column(ForeignKey("school_event.id"))
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    created: Mapped[float] = mapped_column(Float)
    updated: Mapped[float] = mapped_column(Float)


class ActivityParticipant(Base):
    __tablename__ = "activity_participant"
    request_id: Mapped[str] = mapped_column(ForeignKey("activity_request.id"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True, index=True)


class SchoolReport(Base):
    __tablename__ = "school_report"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("account.id"), index=True)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("study_conversation.id"))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    created: Mapped[float] = mapped_column(Float)


class SchoolReportRecipient(Base):
    __tablename__ = "school_report_recipient"
    report_id: Mapped[str] = mapped_column(ForeignKey("school_report.id"), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("account.id"), primary_key=True, index=True)
