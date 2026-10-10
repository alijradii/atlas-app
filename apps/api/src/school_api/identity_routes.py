from fastapi import APIRouter, HTTPException, Request, Response
from school2036.authentication import authenticate
from school2036.identity import audit, check_marker, issue_session, locked_state, throttle
from school2036.models import Account, AuthSession, Person
from school2036.schemas import Credentials, SessionView
from school2036.security import digest, verify_password
from sqlalchemy import delete, select


def identity_router(config, sessions):
    router = APIRouter(prefix="/api/v1")

    def rate(request, scope, login=""):
        host = request.client.host if request.client else "unknown"
        throttle(sessions, scope + ":ip", host, 40)
        if login:
            throttle(sessions, scope, login)

    def auth(db, request):
        return authenticate(config, db, request)

    def view(db, current, account, raw):
        return SessionView(
            csrf=digest("csrf:" + raw),
            account_id=current.account_id,
            login=account.login if account else None,
            name=db.get(Person, account.id).name if account else None,
            kind=current.kind,
        )

    @router.post("/auth/login", response_model=SessionView, tags=["identity"])
    def login(data: Credentials, request: Request, response: Response):
        normalized = data.login.strip().lower()
        rate(request, "login", normalized)
        with sessions.begin() as db:
            state = locked_state(db)
            check_marker(config, state)
            if not state.initialized:
                raise HTTPException(423, "Setup must be completed first")
            account = db.scalar(select(Account).where(Account.login == normalized))
            valid = verify_password(data.password, account.password_hash if account else None)
            if not valid or not account or account.status != "active":
                audit(db, "login.denied")
                db.commit()
                raise HTTPException(401, "Invalid sign-in credentials")
            old = request.cookies.get(config.session_cookie, "")
            db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(old)))
            current, raw = issue_session(db, response, config, account)
            audit(db, "login.accepted", account.id)
            return view(db, current, account, raw)

    @router.get("/auth/me", response_model=SessionView, tags=["identity"])
    def me(request: Request):
        with sessions.begin() as db:
            current, account, raw = auth(db, request)
            return view(db, current, account, raw)

    @router.post("/auth/logout", tags=["identity"])
    def logout(request: Request, response: Response) -> dict:
        with sessions.begin() as db:
            current, account, _ = auth(db, request)
            db.delete(current)
            audit(db, "session.revoked", account.id if account else None)
        response.delete_cookie(
            config.session_cookie,
            path="/",
            secure=config.environment == "production",
            httponly=True,
            samesite="strict",
        )
        return {"status": "ok"}

    return router
