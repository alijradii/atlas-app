"""Transactional identity operations shared by HTTP and operator tools."""

import json
import os
import time
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from school2036.models import (
    Account,
    AuditEvent,
    AuthSession,
    InstallationState,
    Person,
    RateLimit,
)
from school2036.security import digest, token


def audit(db, action, actor=None, target=None, **detail):
    db.add(
        AuditEvent(
            id=str(uuid4()),
            at=time.time(),
            actor=actor,
            action=action,
            target=target,
            detail=detail,
        )
    )


def locked_state(db):
    # Shared serialization point for setup, recovery, succession and permission changes.
    state = db.scalar(select(InstallationState).where(InstallationState.id == 1).with_for_update())
    if not state:
        raise HTTPException(503, "Installation state requires operator attention")
    return state


def read_marker(config):
    try:
        return json.loads(config.installation_marker.read_text())
    except OSError, ValueError:
        raise HTTPException(503, "Deployment marker requires operator attention") from None


def check_marker(config, state):
    marker = read_marker(config)
    if marker != {"deployment_id": state.deployment_id, "initialized": state.initialized}:
        raise HTTPException(503, "Installation mismatch: operator recovery required")


def write_marker(config, state):
    path = config.installation_marker
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + token())
    try:
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            json.dump(
                {"deployment_id": state.deployment_id, "initialized": state.initialized}, stream
            )
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def throttle(sessions, scope, value, limit=10):
    # Database backed: applies across API processes and does not depend on Redis availability.
    now = int(time.time() // 900)
    key = digest(scope + ":" + value)
    with sessions.begin() as db:
        stmt = insert(RateLimit).values(key=key, window=now, attempts=1)
        from sqlalchemy import case

        stmt = stmt.on_conflict_do_update(
            index_elements=[RateLimit.key],
            set_={
                "window": now,
                "attempts": case((RateLimit.window == now, RateLimit.attempts + 1), else_=1),
            },
        ).returning(RateLimit.attempts)
        attempts = db.scalar(stmt)
    if attempts > limit:
        raise HTTPException(
            429, "Too many attempts. Try again in 15 minutes.", headers={"Retry-After": "900"}
        )


def issue_session(db, response, config, account=None, kind="bootstrap"):
    raw = token()
    now = time.time()
    if account:
        kind = "user"
    session = AuthSession(
        token_hash=digest(raw),
        account_id=account.id if account else None,
        kind=kind,
        created=now,
        expires=now + (1800 if kind != "user" else 28800),
        last_seen=now,
        authenticated=now if kind == "user" else 0,
    )
    db.add(session)
    response.set_cookie(
        config.session_cookie,
        raw,
        httponly=True,
        secure=config.environment == "production",
        samesite="strict",
        max_age=28800,
        path="/",
    )
    return session, raw


def revoke(db, account_id):
    db.execute(delete(AuthSession).where(AuthSession.account_id == account_id))


def add_account(db, name, login, roles, capabilities):
    if db.scalar(select(Account).where(Account.login == login)):
        raise HTTPException(409, "Login already exists")
    person = Person(id=str(uuid4()), name=name)
    db.add(person)
    db.flush()
    account = Account(
        id=person.id,
        login=login,
        roles=sorted(set(roles)),
        capabilities=sorted(set(capabilities)),
        status="pending",
    )
    db.add(account)
    db.flush()
    return account
