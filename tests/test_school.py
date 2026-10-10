"""School workflows against real PostgreSQL: roles, relationships and state transitions."""

import time
from uuid import uuid4

import pytest
from conftest import PASSWORD
from fastapi.testclient import TestClient
from school2036.models import Account, StudyAccess, StudyLesson
from school2036.operator import create_user, set_relationship, set_roles
from sqlalchemy import select
from test_identity import login

BASE = "/api/v1/school"


@pytest.fixture
def school(system):
    _, app, config = system
    roles = {
        "alice": "teacher",
        "bob": "student",
        "advisor": "advisor",
        "parent": "parent",
        "outsider": "teacher",
        "otherstudent": "student",
        "otherparent": "parent",
    }
    for name, role in roles.items():
        if name not in ("alice", "bob"):
            create_user(config, app.state.sessions, name, name.title(), PASSWORD)
        set_roles(config, app.state.sessions, name, [role])
    for name, kind in (("alice", "teacher"), ("advisor", "advisor"), ("parent", "parent")):
        set_relationship(config, app.state.sessions, name, "bob", kind)
    with app.state.sessions() as db:
        ids = {a.login: a.id for a in db.scalars(select(Account))}
    clients = {}
    for name in roles:
        clients[name] = TestClient(app, headers={"Origin": config.public_origin})
        login(clients[name], name)
    yield clients, ids, app, config
    for client in clients.values():
        client.close()


def ready_lesson(school, owner="alice", state="ready"):
    _, ids, app, _ = school
    key = str(uuid4())
    with app.state.sessions.begin() as db:
        db.add(
            StudyLesson(
                id=key,
                owner=ids[owner],
                title="Newton's laws",
                subject="Physics",
                transcript="A force causes an acceleration proportional to its mass.",
                state=state,
                source_id=uuid4().hex if state == "ready" else None,
                error="",
                created=time.time(),
            )
        )
    return key


def assignment(school):
    clients, ids, _, _ = school
    response = clients["alice"].post(
        BASE + "/assignments",
        json={
            "student_id": ids["bob"],
            "title": "Force and motion",
            "instructions": "Explain F = ma.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def proposal(school):
    clients, ids, _, _ = school
    response = clients["bob"].post(
        BASE + "/proposals",
        json={
            "student_id": ids["bob"],
            "advisor_id": ids["advisor"],
            "parent_id": ids["parent"],
            "title": "Engineering pathway",
            "description": "I want to study engineering.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_workspace_requires_auth_and_never_accepts_browser_roles(system):
    client, _, _ = system
    assert client.get(BASE + "/workspace").status_code == 401
    login(client)
    view = client.get(BASE + "/workspace").json()
    assert view["roles"] == [] and view["people"] == []
    assert client.post(BASE + "/roles", json={"roles": ["teacher"]}).status_code == 404
    assert (
        client.post(
            BASE + "/assignments",
            json={"student_id": str(uuid4()), "title": "x", "instructions": "x"},
        ).status_code
        == 403
    )


def test_teacher_publication_grants_and_revokes_study_access(school):
    clients, ids, _, _ = school
    lesson = ready_lesson(school)
    student = clients["bob"]
    assert student.get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    response = clients["alice"].post(
        BASE + "/publications", json={"student_id": ids["bob"], "lesson_id": lesson}
    )
    assert response.status_code == 201, response.text
    publication = response.json()["id"]
    duplicate = clients["alice"].post(
        BASE + "/publications", json={"student_id": ids["bob"], "lesson_id": lesson}
    )
    assert duplicate.json()["id"] == publication
    assert student.get(f"/api/v1/study/lessons/{lesson}").status_code == 200
    assert clients["otherstudent"].get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    assert clients["parent"].get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    conversation = student.post("/api/v1/study/conversations", json={"lesson_ids": [lesson]})
    assert conversation.status_code == 201
    conversation_id = conversation.json()["id"]
    assert clients["outsider"].delete(BASE + f"/publications/{publication}").status_code == 404
    assert clients["alice"].delete(BASE + f"/publications/{publication}").status_code == 204
    assert student.get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    assert student.get(f"/api/v1/study/conversations/{conversation_id}").status_code == 404
    assert student.get(BASE + "/workspace").json()["publications"] == []


def test_unpublish_preserves_separately_granted_manual_access(school):
    clients, ids, app, _ = school
    lesson = ready_lesson(school)
    with app.state.sessions.begin() as db:
        db.add(StudyAccess(lesson_id=lesson, account_id=ids["bob"]))
    response = clients["alice"].post(
        BASE + "/publications", json={"student_id": ids["bob"], "lesson_id": lesson}
    )
    assert response.status_code == 201
    clients["alice"].delete(BASE + "/publications/" + response.json()["id"])
    assert clients["bob"].get(f"/api/v1/study/lessons/{lesson}").status_code == 200


def test_only_owned_ready_lessons_can_be_published_to_linked_students(school):
    clients, ids, _, _ = school
    lesson = ready_lesson(school)
    for client, target, expected in [
        ("outsider", "bob", 404),
        ("alice", "otherstudent", 404),
        ("bob", "bob", 403),
    ]:
        assert (
            clients[client]
            .post(BASE + "/publications", json={"student_id": ids[target], "lesson_id": lesson})
            .status_code
            == expected
        )
    assert (
        clients["alice"]
        .post(
            BASE + "/publications",
            json={"student_id": ids["bob"], "lesson_id": ready_lesson(school, state="queued")},
        )
        .status_code
        == 409
    )
    assert (
        clients["alice"]
        .post(
            BASE + "/publications",
            json={"student_id": ids["bob"], "lesson_id": ready_lesson(school, owner="bob")},
        )
        .status_code
        == 404
    )


def test_assignment_submit_return_resubmit_review_and_parent_read_only(school):
    clients, _, _, _ = school
    key = assignment(school)
    path = BASE + f"/assignments/{key}"
    assert clients["alice"].post(path + "/feedback", json={"feedback": "Great"}).status_code == 409
    assert (
        clients["otherstudent"].post(path + "/submit", json={"answer": "private"}).status_code
        == 404
    )
    assert clients["parent"].post(path + "/submit", json={"answer": "mine"}).status_code == 403
    response = clients["bob"].post(path + "/submit", json={"answer": "F = ma"})
    assert response.status_code == 200 and response.json()["state"] == "submitted"
    assert clients["bob"].post(path + "/submit", json={"answer": "overwrite"}).status_code == 409
    assert (
        clients["outsider"].post(path + "/feedback", json={"feedback": "oops"}).status_code == 404
    )
    response = clients["alice"].post(
        path + "/feedback", json={"feedback": "Explain the units too.", "return_for_revision": True}
    )
    assert response.json()["state"] == "returned"
    clients["bob"].post(path + "/submit", json={"answer": "Force in newtons = kg × m/s²"})
    response = clients["alice"].post(path + "/feedback", json={"feedback": "Complete"})
    assert response.json()["state"] == "reviewed"
    parent = clients["parent"].get(BASE + "/workspace").json()
    assert parent["assignments"][0]["feedback"] == "Complete"
    for name in ("advisor", "otherparent", "outsider", "otherstudent"):
        assert clients[name].get(BASE + "/workspace").json()["assignments"] == []


def test_assignment_with_lesson_publishes_atomically(school):
    clients, ids, _, _ = school
    lesson = ready_lesson(school)
    response = clients["alice"].post(
        BASE + "/assignments",
        json={
            "student_id": ids["bob"],
            "lesson_id": lesson,
            "title": "Practice",
            "instructions": "Explain",
        },
    )
    assert response.status_code == 201
    view = clients["bob"].get(BASE + "/workspace").json()
    assert len(view["publications"]) == 1
    assert clients["bob"].get(f"/api/v1/study/lessons/{lesson}").status_code == 200


def test_advisor_messages_are_private_to_actual_pair(school):
    clients, ids, _, _ = school
    body = {"student_id": ids["bob"], "advisor_id": ids["advisor"], "content": "Private question"}
    response = clients["bob"].post(BASE + "/messages", json=body)
    assert response.status_code == 201 and response.json()["sender_id"] == ids["bob"]
    assert (
        clients["advisor"].post(BASE + "/messages", json={**body, "content": "Reply"}).status_code
        == 201
    )
    assert len(clients["advisor"].get(BASE + "/workspace").json()["messages"]) == 2
    for name in ("alice", "parent", "outsider", "otherstudent"):
        assert clients[name].get(BASE + "/workspace").json()["messages"] == []
        assert clients[name].post(BASE + "/messages", json=body).status_code == 403
    assert (
        clients["advisor"]
        .post(BASE + "/messages", json={**body, "student_id": ids["otherstudent"]})
        .status_code
        == 404
    )


def test_proposals_need_advisor_then_designated_parent_and_cannot_self_approve(school):
    clients, _, _, _ = school
    key = proposal(school)
    path = BASE + f"/proposals/{key}"
    decision = {"decision": "approve", "note": "Agreed"}
    assert clients["parent"].post(path + "/decision", json=decision).status_code == 409
    assert clients["bob"].post(path + "/review", json=decision).status_code == 403
    assert clients["otherparent"].post(path + "/decision", json=decision).status_code == 404
    assert clients["alice"].get(BASE + "/workspace").json()["proposals"] == []
    response = clients["advisor"].post(path + "/review", json=decision)
    assert response.json()["state"] == "pending_parent"
    assert clients["advisor"].post(path + "/decision", json=decision).status_code == 403
    response = clients["parent"].post(path + "/decision", json=decision)
    assert response.json()["state"] == "approved"
    assert clients["parent"].post(path + "/decision", json=decision).status_code == 409
    assert clients["bob"].get(BASE + "/workspace").json()["proposals"][0]["state"] == "approved"


def test_proposal_revision_resets_to_advisor_and_parent_cannot_be_omitted(school):
    clients, ids, _, _ = school
    body = {
        "student_id": ids["bob"],
        "advisor_id": ids["advisor"],
        "title": "Plan",
        "description": "Why",
    }
    assert clients["bob"].post(BASE + "/proposals", json=body).status_code == 422
    assert (
        clients["bob"]
        .post(BASE + "/proposals", json={**body, "parent_id": ids["otherparent"]})
        .status_code
        == 404
    )
    key = proposal(school)
    path = BASE + f"/proposals/{key}"
    edit = {"title": "Improved plan", "description": "Include practical work"}
    assert clients["bob"].put(path, json=edit).status_code == 409
    assert (
        clients["advisor"]
        .post(path + "/review", json={"decision": "revise", "note": "Add practical work"})
        .json()["state"]
        == "revision_requested"
    )
    assert clients["advisor"].put(path, json=edit).status_code == 403
    response = clients["bob"].put(path, json=edit)
    assert response.json()["state"] == "pending_advisor"
    assert response.json()["description"] == edit["description"]


def test_relationship_revocation_hides_history_and_removes_source_access(school):
    clients, ids, app, config = school
    lesson = ready_lesson(school)
    clients["alice"].post(
        BASE + "/publications", json={"student_id": ids["bob"], "lesson_id": lesson}
    )
    assignment_id = assignment(school)
    proposal_id = proposal(school)
    clients["bob"].post(
        BASE + "/messages",
        json={"student_id": ids["bob"], "advisor_id": ids["advisor"], "content": "Private"},
    )
    for name, kind in (("alice", "teacher"), ("advisor", "advisor")):
        set_relationship(config, app.state.sessions, name, "bob", kind, remove=True)
    view = clients["bob"].get(BASE + "/workspace").json()
    assert all(
        view[field] == [] for field in ("publications", "assignments", "messages", "proposals")
    )
    assert clients["bob"].get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    assert (
        clients["bob"]
        .post(BASE + f"/assignments/{assignment_id}/submit", json={"answer": "x"})
        .status_code
        == 404
    )
    assert (
        clients["parent"]
        .post(
            BASE + f"/proposals/{proposal_id}/decision", json={"decision": "approve", "note": "yes"}
        )
        .status_code
        == 404
    )


def test_role_loss_invalidates_existing_sessions_and_relationships(school):
    clients, ids, app, config = school
    lesson = ready_lesson(school)
    clients["alice"].post(
        BASE + "/publications", json={"student_id": ids["bob"], "lesson_id": lesson}
    )
    set_roles(config, app.state.sessions, "alice", [])
    assert clients["alice"].get(BASE + "/workspace").status_code == 401
    assert clients["bob"].get(f"/api/v1/study/lessons/{lesson}").status_code == 404
    set_roles(config, app.state.sessions, "alice", ["teacher"])
    # Granting the role again does not resurrect relationships or publication authority.
    assert clients["bob"].get(f"/api/v1/study/lessons/{lesson}").status_code == 404


def test_disabled_participant_and_direct_role_change_fail_closed(school):
    clients, ids, app, _ = school
    assignment(school)
    with app.state.sessions.begin() as db:
        db.get(Account, ids["alice"]).roles = []
    assert clients["bob"].get(BASE + "/workspace").json()["assignments"] == []
    with app.state.sessions.begin() as db:
        db.get(Account, ids["alice"]).roles = ["teacher"]
        db.get(Account, ids["alice"]).status = "disabled"
    assert clients["bob"].get(BASE + "/workspace").json()["assignments"] == []


def test_advisor_gets_only_own_advisee_parent_choices(school):
    clients, ids, _, _ = school
    people = clients["advisor"].get(BASE + "/workspace").json()["people"]
    parent = next(p for p in people if p["relationship"] == "parent")
    assert parent["account_id"] == ids["parent"] and parent["student_ids"] == [ids["bob"]]
    assert not any(p["account_id"] == ids["otherparent"] for p in people)


def test_input_validation_csrf_and_malformed_ids(school):
    clients, ids, _, _ = school
    client = clients["alice"]
    payload = {"student_id": ids["bob"], "title": "x", "instructions": "x"}
    for bad in ({"instructions": "\x00"}, {"due_at": -1}, {"teacher_id": ids["outsider"]}):
        assert client.post(BASE + "/assignments", json={**payload, **bad}).status_code == 422
    assert (
        client.post(
            BASE + "/assignments", json=payload, headers={"X-CSRF-Token": "bad"}
        ).status_code
        == 403
    )
    assert client.delete(BASE + "/publications/not-a-uuid").status_code == 404
    assert (
        client.post(BASE + "/assignments/not-a-uuid/feedback", json={"feedback": "x"}).status_code
        == 404
    )


def test_operator_rejects_self_links_invalid_roles_and_missing_authority(school):
    _, _, app, config = school
    with pytest.raises(ValueError):
        set_roles(config, app.state.sessions, "alice", ["admin"])
    with pytest.raises(ValueError):
        set_relationship(config, app.state.sessions, "alice", "alice", "teacher")
    with pytest.raises(ValueError):
        set_relationship(config, app.state.sessions, "bob", "otherstudent", "teacher")


def test_parent_revocation_hides_proposal_but_not_student_advisor_conversation(school):
    clients, ids, app, config = school
    key = proposal(school)
    clients["bob"].post(
        BASE + "/messages",
        json={
            "student_id": ids["bob"],
            "advisor_id": ids["advisor"],
            "content": "Student's own message",
        },
    )
    set_relationship(config, app.state.sessions, "parent", "bob", "parent", remove=True)
    assert clients["parent"].get(BASE + "/workspace").json()["proposals"] == []
    assert (
        clients["parent"]
        .post(
            BASE + f"/proposals/{key}/decision",
            json={"decision": "approve", "note": "No longer authorized"},
        )
        .status_code
        == 404
    )
    assert len(clients["bob"].get(BASE + "/workspace").json()["messages"]) == 1


def test_advisor_can_decide_when_student_has_no_parent_link(school):
    clients, ids, app, config = school
    set_relationship(config, app.state.sessions, "parent", "bob", "parent", remove=True)
    response = clients["advisor"].post(
        BASE + "/proposals",
        json={
            "student_id": ids["bob"],
            "advisor_id": ids["advisor"],
            "title": "Adult learner plan",
            "description": "Independent study",
        },
    )
    assert response.status_code == 201
    key = response.json()["id"]
    response = clients["advisor"].post(
        BASE + f"/proposals/{key}/review", json={"decision": "approve", "note": "Ready to proceed"}
    )
    assert response.json()["state"] == "approved"


def test_workspace_query_count_does_not_grow_per_assignment(school):
    from school2036.models import SchoolAssignment
    from sqlalchemy import event

    clients, ids, app, _ = school
    with app.state.sessions.begin() as db:
        for i in range(30):
            db.add(
                SchoolAssignment(
                    id=str(uuid4()),
                    teacher_id=ids["alice"],
                    student_id=ids["bob"],
                    title=f"Work {i}",
                    instructions="Practice",
                    state="assigned",
                    answer="",
                    feedback="",
                    created=time.time(),
                )
            )
    queries = []

    def count(_conn, _cursor, statement, _parameters, _context, _many):
        queries.append(statement)

    event.listen(app.state.engine, "before_cursor_execute", count)
    try:
        response = clients["parent"].get(BASE + "/workspace")
    finally:
        event.remove(app.state.engine, "before_cursor_execute", count)
    assert response.status_code == 200
    assert len(response.json()["assignments"]) == 30
    assert len(queries) <= 15, f"Unexpected per-record queries: {len(queries)}"


def test_multi_role_contacts_preserve_explicit_responsibilities(school):
    clients, ids, app, config = school
    set_roles(config, app.state.sessions, "alice", ["teacher", "advisor"])
    set_relationship(config, app.state.sessions, "alice", "bob", "advisor")
    set_relationship(config, app.state.sessions, "alice", "otherstudent", "advisor")
    login(clients["alice"], "alice")
    people = clients["alice"].get(BASE + "/workspace").json()["people"]
    student = next(p for p in people if p["account_id"] == ids["bob"])
    other = next(p for p in people if p["account_id"] == ids["otherstudent"])
    assert set(student["responsibilities"]) == {"teacher", "advisor"}
    assert other["responsibilities"] == ["advisor"]
    assert len([p for p in people if p["account_id"] == ids["bob"]]) == 1
