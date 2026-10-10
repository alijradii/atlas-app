"""Identity infrastructure. Legacy columns remain compatible with existing databases."""

from sqlalchemy import JSON, Boolean, CheckConstraint, Float, ForeignKey, Integer, String, Text
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
