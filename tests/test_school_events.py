"""Persisted calendar permissions against real PostgreSQL and current relationships."""

from uuid import uuid4

import pytest
from school2036.models import Account, SchoolEvent, SchoolEventStudent
from school2036.operator import set_relationship
from sqlalchemy import select
from test_school import school as school

BASE = "/api/v1/school/events"


def payload(ids, **updates):
    return {
        "title": "Physics workshop",
        "description": "Bring your questions about forces.",
        "location": "Science room",
        "starts_at": "2026-10-12T15:00:00+03:00",
        "ends_at": "2026-10-12T16:00:00+03:00",
        "student_ids": [ids["bob"]],
    } | updates


def create(school):
    clients, ids, _, _ = school
    response = clients["alice"].post(BASE, json=payload(ids))
    assert response.status_code == 201, response.text
    return response.json()


def test_calendar_is_persisted_and_shared_with_only_responsible_accounts(school):
    clients, ids, app, config = school
    event = create(school)
    assert event["starts_at"] == "2026-10-12T12:00:00Z"
    assert event["ends_at"] == "2026-10-12T13:00:00Z"
    assert event["organizer_name"] == "Alice"
    with app.state.sessions() as db:
        assert db.get(SchoolEvent, event["id"]).title == "Physics workshop"
        assert db.get(SchoolEventStudent, (event["id"], ids["bob"])) is not None
    for name in ("alice", "bob", "parent", "advisor"):
        listed = clients[name].get(BASE)
        assert listed.status_code == 200, listed.text
        assert [row["id"] for row in listed.json()] == [event["id"]]
        view = clients[name].get(f"{BASE}/{event['id']}").json()
        assert view["can_manage"] == (name == "alice")
    for name in ("outsider", "otherstudent", "otherparent"):
        assert clients[name].get(BASE).json() == []
        assert clients[name].get(f"{BASE}/{event['id']}").status_code == 404
    set_relationship(config, app.state.sessions, "outsider", "bob", "teacher")
    assert clients["outsider"].get(f"{BASE}/{event['id']}").status_code == 200
    assert clients["outsider"].get(BASE).json()[0]["can_manage"] is False


def test_only_organizing_teacher_manages_events(school):
    clients, ids, _, _ = school
    event = create(school)
    for name in ("bob", "parent", "advisor"):
        assert clients[name].post(BASE, json=payload(ids)).status_code == 403
        assert clients[name].patch(f"{BASE}/{event['id']}", json={"title": "x"}).status_code == 403
    assert clients["outsider"].post(BASE, json=payload(ids)).status_code == 404
    assert (
        clients["alice"]
        .post(BASE, json=payload(ids, student_ids=[ids["otherstudent"]]))
        .status_code
        == 404
    )
    assert (
        clients["outsider"].patch(f"{BASE}/{event['id']}", json={"state": "cancelled"}).status_code
        == 404
    )
    changed = clients["alice"].patch(
        f"{BASE}/{event['id']}", json={"title": "Updated workshop", "state": "cancelled"}
    )
    assert changed.status_code == 200, changed.text
    assert clients["bob"].get(BASE).json()[0]["state"] == "cancelled"
    assert clients["bob"].get(BASE).json()[0]["title"] == "Updated workshop"
    assert clients["alice"].delete(f"{BASE}/{event['id']}").status_code == 405


@pytest.mark.parametrize("role", ["parent", "advisor", "teacher"])
def test_relationship_revocation_removes_event_read_access(school, role):
    clients, _, app, config = school
    event = create(school)
    staff = "alice" if role == "teacher" else role
    set_relationship(config, app.state.sessions, staff, "bob", role, remove=True)
    hidden = ("bob", "parent", "advisor") if role == "teacher" else (role,)
    for name in hidden:
        assert clients[name].get(BASE).json() == []
        assert clients[name].get(f"{BASE}/{event['id']}").status_code == 404
    # Organizer retains management of their historical record, including cancellation.
    assert (
        clients["alice"].patch(f"{BASE}/{event['id']}", json={"state": "cancelled"}).status_code
        == 200
    )


@pytest.mark.parametrize(
    "target,change", [("alice", "disabled"), ("alice", "roles"), ("bob", "roles")]
)
def test_inactive_account_or_removed_role_revokes_inherited_visibility(school, target, change):
    clients, ids, app, _ = school
    event = create(school)
    with app.state.sessions.begin() as db:
        account = db.get(Account, ids[target])
        if change == "roles":
            account.roles = []
        else:
            account.status = "disabled"
    for name in ("parent", "advisor"):
        assert clients[name].get(BASE).json() == []
        assert clients[name].get(f"{BASE}/{event['id']}").status_code == 404


def test_audience_is_private_and_removing_a_student_revokes_access(school):
    clients, ids, app, config = school
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "teacher")
    event = (
        clients["alice"]
        .post(BASE, json=payload(ids, student_ids=[ids["bob"], ids["otherstudent"]]))
        .json()
    )
    assert set(event["student_ids"]) == {ids["bob"], ids["otherstudent"]}
    assert clients["parent"].get(BASE).json()[0]["student_ids"] == [ids["bob"]]
    assert clients["bob"].get(BASE).json()[0]["student_ids"] == [ids["bob"]]
    assert clients["otherstudent"].get(BASE).json()[0]["student_ids"] == [ids["otherstudent"]]
    response = clients["alice"].patch(
        f"{BASE}/{event['id']}", json={"student_ids": [ids["otherstudent"]]}
    )
    assert response.status_code == 200, response.text
    for name in ("bob", "parent", "advisor"):
        assert clients[name].get(f"{BASE}/{event['id']}").status_code == 404
    assert clients["otherstudent"].get(f"{BASE}/{event['id']}").status_code == 200


@pytest.mark.parametrize(
    "updates",
    [
        {"title": "   "},
        {"starts_at": "2026-10-12T15:00:00"},
        {"ends_at": "2026-10-12T11:00:00Z"},
        {"student_ids": []},
        {"student_ids": ["not-an-id"]},
        {"starts_at": "2201-01-01T00:00:00Z"},
        {"description": "bad\u0000text"},
        {"state": "cancelled"},
    ],
)
def test_event_input_rejects_invalid_values(school, updates):
    clients, ids, _, _ = school
    assert clients["alice"].post(BASE, json=payload(ids, **updates)).status_code == 422
    assert clients["alice"].get(BASE).json() == []


def test_patch_validation_and_failed_audience_change_are_atomic(school):
    clients, ids, app, _ = school
    event = create(school)
    for updates in (
        {},
        {"title": None},
        {"ends_at": "2026-10-12T11:00:00Z"},
        {"teacher_id": ids["outsider"]},
        {"state": "invalid"},
        {"student_ids": []},
    ):
        assert clients["alice"].patch(f"{BASE}/{event['id']}", json=updates).status_code == 422
    assert (
        clients["alice"]
        .post(BASE, json=payload(ids, student_ids=[ids["bob"], ids["bob"]]))
        .status_code
        == 422
    )
    failed = clients["alice"].patch(
        f"{BASE}/{event['id']}",
        json={
            "title": "Must roll back",
            "student_ids": [ids["bob"], ids["otherstudent"]],
        },
    )
    assert failed.status_code == 404
    with app.state.sessions() as db:
        assert db.get(SchoolEvent, event["id"]).title == "Physics workshop"
        assert list(db.scalars(select(SchoolEventStudent.student_id))) == [ids["bob"]]
    assert clients["alice"].get(f"{BASE}/{uuid4()}").status_code == 404
    assert clients["alice"].get(f"{BASE}/invalid").status_code == 404


def test_calendar_requires_authentication(system):
    client, _, _ = system
    assert client.get(BASE).status_code == 401
    assert client.post(BASE, json=payload({"bob": str(uuid4())})).status_code == 401
