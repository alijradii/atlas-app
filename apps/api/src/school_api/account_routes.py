"""Authenticated self-service controls; account recovery remains an operator action."""

import time

from fastapi import APIRouter, HTTPException, Request, Response
from school2036.account_schemas import AccountSessionView, PasswordChange, SessionRevokeView
from school2036.authentication import authenticate
from school2036.identity import audit, issue_session, revoke, throttle
from school2036.models import AuthSession, Person
from school2036.schemas import SessionView
from school2036.security import digest, password_hash, verify_password
from sqlalchemy import delete, select


def account_router(config, sessions):
    router = APIRouter(prefix="/api/v1/account", tags=["account"])

    @router.get("/sessions", response_model=list[AccountSessionView])
    def list_sessions(request: Request):
        with sessions.begin() as db:
            current, actor, _ = authenticate(config, db, request)
            now = time.time()
            values = db.scalars(
                select(AuthSession)
                .where(
                    AuthSession.account_id == actor.id,
                    AuthSession.kind == "user",
                    AuthSession.expires > now,
                    AuthSession.last_seen > now - 1800,
                )
                .order_by(AuthSession.created.desc())
            )
            return [
                AccountSessionView(
                    current=value.token_hash == current.token_hash,
                    created=value.created,
                    last_seen=value.last_seen,
                    expires=min(value.expires, value.last_seen + 1800),
                )
                for value in values
            ]

    @router.post("/sessions/revoke-others", response_model=SessionRevokeView)
    def revoke_others(request: Request):
        with sessions.begin() as db:
            current, actor, _ = authenticate(config, db, request)
            result = db.execute(
                delete(AuthSession).where(
                    AuthSession.account_id == actor.id,
                    AuthSession.token_hash != current.token_hash,
                )
            )
            audit(db, "account.other_sessions_revoked", actor.id, revoked=result.rowcount)
            return SessionRevokeView(revoked=result.rowcount)

    @router.post("/password", response_model=SessionView)
    def change_password(data: PasswordChange, request: Request, response: Response):
        host = request.client.host if request.client else "unknown"
        throttle(sessions, "password-change:ip", host, 40)
        # Commit the short authentication check before using the separate rate-limit
        # transaction. Reauthenticate under the shared identity lock before mutation.
        with sessions.begin() as db:
            _, actor, _ = authenticate(config, db, request)
            actor_id = actor.id
        throttle(sessions, "password-change:account", actor_id, 10)
        with sessions.begin() as db:
            _, actor, _ = authenticate(config, db, request)
            if not verify_password(data.current_password, actor.password_hash):
                audit(db, "account.password_change_denied", actor.id)
                db.commit()
                raise HTTPException(400, "Your current password is incorrect")
            if data.new_password == data.current_password:
                raise HTTPException(422, "Choose a new password different from your current one")
            actor.password_hash = password_hash(data.new_password)
            actor.activation_hash = None
            actor.activation_expires = 0
            revoke(db, actor.id)
            current, raw = issue_session(db, response, config, actor)
            audit(db, "account.password_changed", actor.id)
            return SessionView(
                csrf=digest("csrf:" + raw),
                account_id=actor.id,
                login=actor.login,
                name=db.get(Person, actor.id).name,
                kind=current.kind,
            )

    return router
