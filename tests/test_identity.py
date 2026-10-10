import time

from conftest import PASSWORD
from school2036.models import AuthSession, InstallationState
from school2036.operator import create_user, reset_password
from school2036.security import digest
from sqlalchemy import select


def login(client, user="alice", password=PASSWORD):
    response = client.post("/api/v1/auth/login", json={"login": user, "password": password})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return response.json()


def test_login_cookie_csrf_origin_and_logout(system):
    client, app, config = system
    assert client.get("/api/v1/auth/me").status_code == 401
    result = login(client)
    assert result["name"] == "Alice"
    assert client.get("/api/v1/auth/me").json() == result
    raw = client.cookies.get(config.session_cookie)
    with app.state.sessions() as db:
        assert db.get(AuthSession, digest(raw))
        assert not db.get(AuthSession, raw)
    csrf = client.headers.pop("X-CSRF-Token")
    assert client.post("/api/v1/auth/logout").status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    assert (
        client.post("/api/v1/auth/logout", headers={"Origin": "https://evil.example"}).status_code
        == 403
    )
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get("/api/v1/auth/me").status_code == 401


def test_bad_credentials_and_rate_limit(system):
    client, _, _ = system
    for _ in range(10):
        response = client.post("/api/v1/auth/login", json={"login": "alice", "password": "wrong"})
        assert response.status_code == 401
    assert (
        client.post("/api/v1/auth/login", json={"login": "alice", "password": PASSWORD}).status_code
        == 429
    )


def test_session_expiry_and_password_reset(system):
    client, app, config = system
    login(client)
    with app.state.sessions.begin() as db:
        db.scalar(select(AuthSession)).last_seen = time.time() - 1801
    assert client.get("/api/v1/auth/me").status_code == 401
    login(client)
    reset_password(config, app.state.sessions, "alice", PASSWORD + " new")
    assert client.get("/api/v1/auth/me").status_code == 401
    login(client, password=PASSWORD + " new")


def test_missing_marker_and_state_fail_closed(system):
    client, app, config = system
    config.installation_marker.unlink()
    assert (
        client.post("/api/v1/auth/login", json={"login": "alice", "password": PASSWORD}).status_code
        == 503
    )
    assert client.get("/api/v1/setup/status").status_code == 503
    with app.state.sessions.begin() as db:
        db.delete(db.get(InstallationState, 1))
    assert client.get("/api/v1/setup/status").status_code == 503
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        create_user(config, app.state.sessions, "charlie", "Charlie", PASSWORD)


def test_product_and_public_setup_endpoints_removed(system):
    client, _, _ = system
    assert not client.get("/api/v1/setup/status").json()["setup_available"]
    for path in [
        "/setup/authorize",
        "/setup/finalize",
        "/auth/demo-login",
        "/accounts",
        "/school",
        "/ai/tasks",
    ]:
        assert client.post("/api/v1" + path, json={}).status_code == 404
