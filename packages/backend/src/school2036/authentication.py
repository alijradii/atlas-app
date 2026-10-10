import hmac
import time

from fastapi import HTTPException

from school2036.identity import (
    check_marker,
    locked_state,
)
from school2036.models import Account, AuthSession
from school2036.security import digest


def authenticate(config, db, request):
    state = locked_state(db)
    check_marker(config, state)
    raw = request.cookies.get(config.session_cookie, "")
    current = db.get(AuthSession, digest(raw))
    now = time.time()
    if (
        not current
        or current.kind == "mfa"
        or current.expires < now
        or current.last_seen + 1800 < now
    ):
        raise HTTPException(401, "Please sign in again")
    if current.kind != "user" or not current.account_id:
        raise HTTPException(403, "Please sign in again")
    if not state.initialized:
        raise HTTPException(423, "Setup must be completed first")
    if request.method not in ("GET", "HEAD") and not hmac.compare_digest(
        request.headers.get("X-CSRF-Token", ""), digest("csrf:" + raw)
    ):
        raise HTTPException(403, "Invalid request verification token")
    account = db.get(Account, current.account_id) if current.account_id else None
    if current.account_id and (not account or account.status != "active"):
        raise HTTPException(401, "Account is unavailable")
    current.last_seen = now
    return current, account, raw
