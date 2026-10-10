"""Peer opt-ins are persisted, revocable and never inferred from private conversations."""

import asyncio
import json

import httpx
import pytest
from conftest import PASSWORD
from fastapi.testclient import TestClient
from school2036.activities import suggest_activity
from school2036.activity_schemas import ActivitySuggestionText
from school2036.models import Account, ActivityInterest, ActivityParticipant, ActivityRequest
from school2036.operator import create_user, set_relationship, set_roles
from school2036.study_providers import ProviderUnavailable
from sqlalchemy import select
from test_identity import login
from test_school import school as school

BASE = "/api/v1/school/activity-requests"
INTERESTS = "/api/v1/school/activity-interests"


def create(school):
    clients, ids, _, _ = school
    response = clients["bob"].post(
        BASE,
        json={
            "teacher_id": ids["alice"],
            "topic": "  ROBOTICS   ",
            "title": "Build a robot together",
            "description": "A small peer workshop",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def opt_in(school, name="bob", *, topic="robotics", interested=True):
    clients, ids, _, _ = school
    response = clients[name].put(
        INTERESTS,
        json={
            "teacher_id": ids["alice"],
            "topic": topic,
            "interested": interested,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def three_students(school):
    clients, ids, app, config = school
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher")
    create_user(config, app.state.sessions, "thirdstudent", "Third student", PASSWORD)
    set_roles(config, app.state.sessions, "thirdstudent", ["student"])
    set_relationship(config, app.state.sessions, "alice", "thirdstudent", "teacher")
    third = TestClient(app, headers={"Origin": config.public_origin})
    login(third, "thirdstudent")
    clients["thirdstudent"] = third
    with app.state.sessions() as db:
        ids["thirdstudent"] = db.scalar(select(Account.id).where(Account.login == "thirdstudent"))
    for name in ("bob", "otherstudent", "thirdstudent"):
        opt_in(school, name)


def fake_suggestion(monkeypatch, calls):
    async def model(config, topic, count):
        calls.append((topic, count))
        return ActivitySuggestionText(title="Robot workshop", description="Build in small groups.")

    monkeypatch.setattr("school_api.activity_routes.suggest_activity", model)


def test_request_board_joins_persistence_and_private_audience(school):
    clients, ids, app, config = school
    item = create(school)
    assert item["topic"] == "robotics" and item["interested_count"] == 1
    assert item["joined"] and not item["participant_ids"]
    assert not item["can_manage"] and item["can_join"]
    for name in ("alice", "bob", "parent", "advisor"):
        rows = clients[name].get(BASE).json()
        assert len(rows) == 1, rows
        assert rows[0]["participant_ids"] == ([ids["bob"]] if name == "alice" else [])
    for name in ("otherstudent", "outsider", "otherparent"):
        assert clients[name].get(BASE).json() == []
        assert clients[name].put(
            f"{BASE}/{item['id']}/interest", json={"interested": True}
        ).status_code in (403, 404)
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher")
    assert clients["otherstudent"].get(BASE).json()[0]["interested_count"] == 1
    for _ in range(2):
        joined = clients["otherstudent"].put(
            f"{BASE}/{item['id']}/interest", json={"interested": True}
        )
        assert joined.status_code == 200, joined.text
        assert joined.json()["interested_count"] == 2
    assert clients["parent"].get(BASE).json()[0]["participant_ids"] == []
    with app.state.sessions() as db:
        assert db.get(ActivityRequest, item["id"]).title == "Build a robot together"
        assert db.get(ActivityParticipant, (item["id"], ids["bob"])) is not None
    left = clients["bob"].put(f"{BASE}/{item['id']}/interest", json={"interested": False})
    assert left.json()["interested_count"] == 1
    assert clients["parent"].get(BASE).json() == []


def test_interest_is_explicit_unique_normalized_and_scoped(school):
    clients, ids, app, config = school
    create(school)
    assert clients["alice"].get(INTERESTS).json() == []  # A request is not topic consent.
    opt_in(school, topic=" ROBOTICS ")
    opt_in(school, topic="robotics")
    rows = clients["alice"].get(INTERESTS).json()
    assert rows[0]["interested_count"] == 1 and not rows[0]["can_suggest"]
    assert "student_ids" not in rows[0]
    for name in ("otherstudent", "otherparent", "outsider"):
        assert clients[name].get(INTERESTS).json() == []
    assert clients["parent"].get(INTERESTS).json()[0]["interested_count"] == 1
    for name in ("alice", "parent", "advisor"):
        assert (
            clients[name]
            .put(
                INTERESTS,
                json={
                    "teacher_id": ids["alice"],
                    "topic": "robotics",
                    "interested": True,
                },
            )
            .status_code
            == 403
        )
    set_relationship(config, app.state.sessions, "alice", "bob", "teacher", remove=True)
    for name in ("alice", "bob", "parent", "advisor"):
        assert clients[name].get(INTERESTS).json() == []
    assert clients["bob"].get(BASE).json() == []
    with app.state.sessions() as db:
        assert db.get(ActivityInterest, (ids["alice"], ids["bob"], "robotics")) is not None


def test_role_or_account_removal_excludes_evidence_and_requests(school):
    clients, ids, app, _ = school
    create(school)
    opt_in(school)
    with app.state.sessions.begin() as db:
        db.get(Account, ids["bob"]).status = "disabled"
    assert clients["alice"].get(INTERESTS).json() == []
    assert clients["alice"].get(BASE).json()[0]["interested_count"] == 0
    assert clients["parent"].get(BASE).json() == []


def test_review_requires_organizer_and_real_matching_event(school):
    clients, ids, _, _ = school
    item = create(school)
    review = f"{BASE}/{item['id']}"
    for name in ("bob", "parent", "advisor"):
        assert clients[name].patch(review, json={"state": "declined"}).status_code == 403
    assert clients["outsider"].patch(review, json={"state": "declined"}).status_code == 404
    assert clients["alice"].patch(review, json={"state": "accepted"}).status_code == 422
    event = clients["alice"].post(
        "/api/v1/school/events",
        json={
            "title": "Robot workshop",
            "student_ids": [ids["bob"]],
            "starts_at": "2026-10-12T13:00:00Z",
            "ends_at": "2026-10-12T14:00:00Z",
        },
    )
    assert event.status_code == 201, event.text
    accepted = clients["alice"].patch(
        review,
        json={
            "state": "accepted",
            "event_id": event.json()["id"],
            "teacher_note": "See you Monday.",
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["event_id"] == event.json()["id"]
    assert clients["parent"].get(BASE).json()[0]["teacher_note"] == "See you Monday."
    assert clients["bob"].put(f"{review}/interest", json={"interested": True}).status_code == 409
    assert clients["alice"].patch(review, json={"state": "declined"}).status_code == 409


def test_ai_uses_three_distinct_opted_in_students_and_never_enrolls_them(school, monkeypatch):
    clients, ids, app, config = school
    calls = []
    fake_suggestion(monkeypatch, calls)
    assert clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 409
    opt_in(school)
    opt_in(school)
    assert clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 409
    assert calls == []
    three_students(school)
    assert clients["alice"].get(INTERESTS).json()[0]["can_suggest"]
    for name in ("bob", "parent", "advisor"):
        assert clients[name].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 403
    assert (
        clients["outsider"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 409
    )
    response = clients["alice"].post(BASE + "/suggest", json={"topic": "ROBOTICS"})
    assert response.status_code == 200, response.text
    row = response.json()
    assert row["source"] == "ai" and row["state"] == "pending"
    assert row["evidence_count"] == 3 and row["event_id"] is None
    assert row["interested_count"] == 0 and row["participant_ids"] == []
    again = clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"})
    assert again.json()["id"] == row["id"]
    assert calls == [("robotics", 3)]
    assert clients["bob"].get(BASE).json()[0]["id"] == row["id"]
    assert clients["alice"].get("/api/v1/school/events").json() == []
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher", remove=True)
    assert clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 409


def test_ai_rechecks_evidence_after_provider_returns(school, monkeypatch):
    clients, ids, app, _ = school
    three_students(school)

    async def withdrawing_model(config, topic, count):
        with app.state.sessions.begin() as db:
            db.delete(db.get(ActivityInterest, (ids["alice"], ids["bob"], "robotics")))
        return ActivitySuggestionText(title="Workshop", description="Build something.")

    monkeypatch.setattr("school_api.activity_routes.suggest_activity", withdrawing_model)
    response = clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"})
    assert response.status_code == 409
    assert clients["alice"].get(BASE).json() == []


def test_ai_failures_consume_bounded_budget_without_fake_suggestions(school, monkeypatch):
    clients, _, _, _ = school
    three_students(school)

    async def unavailable(*args):
        raise ProviderUnavailable("unavailable", "Try later")

    monkeypatch.setattr("school_api.activity_routes.suggest_activity", unavailable)
    for _ in range(3):
        assert (
            clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 503
        )
    assert clients["alice"].post(BASE + "/suggest", json={"topic": "robotics"}).status_code == 429
    assert clients["alice"].get(BASE).json() == []


def test_real_provider_adapter_sends_only_aggregate_context_and_validates_json():
    from pydantic import SecretStr
    from school2036.config import Settings

    config = Settings(_env_file=None, gemini_api_key=SecretStr("synthetic-test-key"))
    captured = []

    def transport(request):
        data = json.loads(request.content)
        captured.append(json.loads(data["contents"][0]["parts"][0]["text"]))
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "title": "Robot workshop",
                                            "description": "Work on a small robot together.",
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    result = asyncio.run(
        suggest_activity(config, "robotics", 3, transport=httpx.MockTransport(transport))
    )
    assert result.title == "Robot workshop"
    assert captured == [{"shared_topic": "robotics", "unique_opted_in_students": 3}]

    def invalid(request):
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "title": "x",
                                            "description": "x",
                                            "student_ids": ["invented"],
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    with pytest.raises(ProviderUnavailable):
        asyncio.run(suggest_activity(config, "robotics", 3, transport=httpx.MockTransport(invalid)))


def test_acceptance_cannot_exclude_interested_peer_or_use_cancelled_event(school):
    clients, ids, app, config = school
    item = create(school)
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher")
    clients["otherstudent"].put(f"{BASE}/{item['id']}/interest", json={"interested": True})
    event = (
        clients["alice"]
        .post(
            "/api/v1/school/events",
            json={
                "title": "Robot workshop",
                "student_ids": [ids["bob"]],
                "starts_at": "2026-10-12T13:00:00Z",
                "ends_at": "2026-10-12T14:00:00Z",
            },
        )
        .json()
    )
    body = {"state": "accepted", "event_id": event["id"]}
    assert clients["alice"].patch(f"{BASE}/{item['id']}", json=body).status_code == 409
    clients["alice"].patch(
        f"/api/v1/school/events/{event['id']}",
        json={
            "student_ids": [ids["bob"], ids["otherstudent"]],
            "state": "cancelled",
        },
    )
    assert clients["alice"].patch(f"{BASE}/{item['id']}", json=body).status_code == 404
    decline = clients["alice"].patch(
        f"{BASE}/{item['id']}",
        json={
            "state": "declined",
            "teacher_note": "We need a supervisor before organizing this.",
        },
    )
    assert decline.status_code == 200, decline.text
    assert clients["bob"].get(BASE).json()[0]["state"] == "declined"


def test_topic_withdrawal_revokes_parent_aggregate_visibility(school):
    clients, _, app, config = school
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher")
    opt_in(school)
    opt_in(school, "otherstudent")
    assert clients["parent"].get(INTERESTS).json()[0]["interested_count"] == 2
    opt_in(school, interested=False)
    assert clients["parent"].get(INTERESTS).json() == []
    assert clients["alice"].get(INTERESTS).json()[0]["interested_count"] == 1
