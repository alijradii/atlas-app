import time

from conftest import PASSWORD
from fastapi.testclient import TestClient
from school2036.models import AuditEvent, AuthSession
from school2036.security import digest
from sqlalchemy import select
from test_identity import login

NEW_PASSWORD = "new synthetic private password 2036"


def peer_client(app, config, user="alice"):
    client = TestClient(app, headers={"Origin": config.public_origin})
    login(client, user)
    return client


def test_account_sessions_are_private_and_never_expose_tokens(system):
    client, app, config = system
    assert client.get("/api/v1/account/sessions").status_code == 401
    login(client)
    other = peer_client(app, config)
    bob = peer_client(app, config, "bob")
    try:
        result = client.get("/api/v1/account/sessions")
        assert result.status_code == 200
        values = result.json()
        assert len(values) == 2
        assert sum(value["current"] for value in values) == 1
        assert all(set(value) == {"current", "created", "last_seen", "expires"} for value in values)
        assert client.cookies.get(config.session_cookie) not in result.text
        assert digest(client.cookies.get(config.session_cookie)) not in result.text
        assert len(bob.get("/api/v1/account/sessions").json()) == 1
        with app.state.sessions.begin() as db:
            db.get(AuthSession, digest(other.cookies.get(config.session_cookie))).last_seen = (
                time.time() - 1801
            )
        assert len(client.get("/api/v1/account/sessions").json()) == 1
    finally:
        other.close()
        bob.close()


def test_password_change_rotates_current_and_revokes_others_only_for_actor(system):
    client, app, config = system
    original = login(client)
    old_raw = client.cookies.get(config.session_cookie)
    other = peer_client(app, config)
    bob = peer_client(app, config, "bob")
    try:
        result = client.post(
            "/api/v1/account/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )
        assert result.status_code == 200, result.text
        assert "HttpOnly" in result.headers["set-cookie"]
        assert client.cookies.get(config.session_cookie) != old_raw
        assert result.json()["csrf"] != original["csrf"]
        assert client.get("/api/v1/auth/me").json() == result.json()
        assert other.get("/api/v1/auth/me").status_code == 401
        assert bob.get("/api/v1/auth/me").status_code == 200
        assert client.post("/api/v1/account/sessions/revoke-others").status_code == 403
        client.headers["X-CSRF-Token"] = result.json()["csrf"]
        assert client.post("/api/v1/account/sessions/revoke-others").status_code == 200
        with app.state.sessions() as db:
            assert db.get(AuthSession, digest(old_raw)) is None
            logs = db.scalars(select(AuditEvent)).all()
            assert any(value.action == "account.password_changed" for value in logs)
            assert all(NEW_PASSWORD not in str(value.detail) for value in logs)
        assert (
            other.post(
                "/api/v1/auth/login", json={"login": "alice", "password": PASSWORD}
            ).status_code
            == 401
        )
        login(other, password=NEW_PASSWORD)
    finally:
        other.close()
        bob.close()


def test_revoke_other_sessions_preserves_current_and_other_accounts(system):
    client, app, config = system
    original = login(client)
    raw = client.cookies.get(config.session_cookie)
    other = peer_client(app, config)
    bob = peer_client(app, config, "bob")
    try:
        result = client.post("/api/v1/account/sessions/revoke-others")
        assert result.status_code == 200
        assert result.json() == {"revoked": 1}
        assert client.cookies.get(config.session_cookie) == raw
        assert client.get("/api/v1/auth/me").json() == original
        assert other.get("/api/v1/auth/me").status_code == 401
        assert bob.get("/api/v1/auth/me").status_code == 200
        assert client.post("/api/v1/account/sessions/revoke-others").json() == {"revoked": 0}
    finally:
        other.close()
        bob.close()


def test_account_mutations_require_auth_csrf_origin_and_current_password(system):
    client, _, _ = system
    body = {"current_password": PASSWORD, "new_password": NEW_PASSWORD}
    assert client.post("/api/v1/account/password", json=body).status_code == 401
    assert client.post("/api/v1/account/sessions/revoke-others").status_code == 401
    login(client)
    csrf = client.headers.pop("X-CSRF-Token")
    for endpoint, payload in [("password", body), ("sessions/revoke-others", None)]:
        assert client.post("/api/v1/account/" + endpoint, json=payload).status_code == 403
        assert (
            client.post(
                "/api/v1/account/" + endpoint,
                json=payload,
                headers={"X-CSRF-Token": csrf, "Origin": "https://evil.example"},
            ).status_code
            == 403
        )
    client.headers["X-CSRF-Token"] = csrf
    assert (
        client.post(
            "/api/v1/account/password", json={**body, "current_password": "wrong password"}
        ).status_code
        == 400
    )
    assert client.get("/api/v1/auth/me").status_code == 200
    assert (
        client.post("/api/v1/account/password", json={**body, "new_password": PASSWORD}).status_code
        == 422
    )


def test_password_policy_and_error_responses_do_not_echo_secrets(system):
    client, _, _ = system
    login(client)
    for value in ["short password", "x" * 129, "\ud800" + "x" * 15]:
        # Explicit JSON permits testing malformed Unicode without the HTTP client's encoder.
        import json

        result = client.post(
            "/api/v1/account/password",
            content=json.dumps({"current_password": PASSWORD, "new_password": value}),
            headers={"Content-Type": "application/json"},
        )
        assert result.status_code == 422
        assert PASSWORD not in result.text
        assert '"input"' not in result.text
    result = client.post(
        "/api/v1/account/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD, "account_id": "bob"},
    )
    assert result.status_code == 422


def test_password_failure_limit_applies_across_sessions(system):
    client, app, config = system
    login(client)
    other = peer_client(app, config)
    try:
        for index in range(10):
            actor = client if index % 2 else other
            assert (
                actor.post(
                    "/api/v1/account/password",
                    json={"current_password": "wrong", "new_password": NEW_PASSWORD},
                ).status_code
                == 400
            )
        result = client.post(
            "/api/v1/account/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )
        assert result.status_code == 429
        assert result.headers["retry-after"] == "900"
        assert client.get("/api/v1/auth/me").status_code == 200
    finally:
        other.close()
