"""Development example seed boundaries, using disposable PostgreSQL and no provider calls."""

import json

import pytest
from conftest import PASSWORD
from pydantic import SecretStr
from school2036.demo_seed import NAMES, seed_demo, seed_id
from school2036.jobs import drain_one
from school2036.models import (
    Account,
    FileObject,
    OutboxJob,
    Person,
    SchoolAssignment,
    SchoolProposal,
    SchoolPublication,
    StudyLesson,
)
from school2036.operator import create_user, set_relationship, set_roles
from school2036.storage import LocalStorage
from sqlalchemy import func, select
from test_identity import login
from test_study import Providers, process


@pytest.fixture
def demo(system, tmp_path):
    _, app, config = system
    credentials = {}
    for role in NAMES:
        login = f"demo.{role}"
        create_user(config, app.state.sessions, login, f"Demo {role.title()}", PASSWORD)
        set_roles(config, app.state.sessions, login, [role])
        credentials[role] = {"login": login, "password": PASSWORD}
    for role in ("teacher", "advisor", "parent"):
        set_relationship(config, app.state.sessions, f"demo.{role}", "demo.student", role)
    receipt = tmp_path / "demo.json"
    receipt.write_text(json.dumps(credentials))
    receipt.chmod(0o600)
    config = config.model_copy(update={"environment": "development"})
    return system, config, receipt


def test_seed_is_additive_preserves_credentials_and_progress_and_never_creates_fake_ready(demo):
    (_, app, _), config, receipt = demo
    with app.state.sessions() as db:
        before = {a.login: a.password_hash for a in db.scalars(select(Account))}
        outsider = db.scalar(select(Account).where(Account.login == "alice"))
        outsider_id = outsider.id
    first = seed_demo(config, app.state.sessions, receipt)
    assert first["added"] == 10
    with app.state.sessions.begin() as db:
        assert db.scalar(select(func.count()).select_from(OutboxJob)) == 0
        assert db.scalar(select(func.count()).select_from(SchoolPublication)) == 0
        assert all(
            x.state == "review" and x.source_id is None for x in db.scalars(select(StudyLesson))
        )
        work = db.get(SchoolAssignment, seed_id("force-practice"))
        work.state, work.answer = "submitted", "My real attempt after seeding"
        plan = db.get(SchoolProposal, seed_id("cs-plan"))
        plan.state, plan.advisor_note = "pending_parent", "My actual decision"
        student = db.scalar(select(Account).where(Account.login == "demo.student"))
        db.get(Person, student.id).name = "My chosen name"
    second = seed_demo(config, app.state.sessions, receipt)
    assert second["added"] == 0
    with app.state.sessions() as db:
        assert {a.login: a.password_hash for a in db.scalars(select(Account))} == before
        assert db.get(Person, outsider_id).name == "Alice"
        assert db.get(Person, student.id).name == "My chosen name"
        assert (
            db.get(SchoolAssignment, seed_id("force-practice")).answer
            == "My real attempt after seeding"
        )
        assert db.get(SchoolProposal, seed_id("cs-plan")).advisor_note == "My actual decision"
        teacher = db.scalar(select(Account).where(Account.login == "demo.teacher"))
        assert db.get(Person, teacher.id).name == "Elie Daher"


def test_queue_uses_normal_ingestion_and_only_publishes_after_provider_receipt(demo):
    system, config, receipt = demo
    _, app, _ = system
    first = seed_demo(config, app.state.sessions, receipt, queue_study=True)
    assert first["lesson_state"] == "queued"
    seed_demo(config, app.state.sessions, receipt, queue_study=True)
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(OutboxJob)) == 1
        assert db.get(StudyLesson, first["lesson_id"]).source_id is None
        assert db.scalar(select(func.count()).select_from(SchoolPublication)) == 0
    provider = Providers()
    process(system, "study.ingest", first["lesson_id"], provider)
    assert any(call[0] == "upload" for call in provider.calls)
    result = seed_demo(config, app.state.sessions, receipt)
    assert result["lesson_state"] == "ready" and result["added"] == 1
    with app.state.sessions() as db:
        assert (
            db.get(SchoolPublication, seed_id("physics-publication")).lesson_id
            == first["lesson_id"]
        )

    with app.state.sessions.begin() as db:
        db.delete(db.get(SchoolPublication, seed_id("physics-publication")))
    assert seed_demo(config, app.state.sessions, receipt)["added"] == 0
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolPublication)) == 0


@pytest.mark.parametrize("invalid", ["production", "remote", "receipt", "password", "permission"])
def test_seed_refuses_unsafe_environment_receipts_before_any_writes(demo, invalid):
    (_, app, _), config, receipt = demo
    if invalid == "production":
        config.environment = "production"
    elif invalid == "remote":
        config.database_url = SecretStr("postgresql://user:pass@remote.example/db")
    elif invalid == "permission":
        receipt.chmod(0o644)
    else:
        value = json.loads(receipt.read_text())
        if invalid == "receipt":
            value["student"]["login"] = "alice"
        else:
            value["parent"]["password"] = "incorrect receipt password"
        receipt.write_text(json.dumps(value))
    with pytest.raises(ValueError):
        seed_demo(config, app.state.sessions, receipt)
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolAssignment)) == 0
        assert db.scalar(select(func.count()).select_from(StudyLesson)) == 0
        student = db.scalar(select(Account).where(Account.login == "demo.student"))
        assert db.get(Person, student.id).name == "Demo Student"


def test_missing_relationship_does_not_regrant_authority_or_seed_records(demo):
    (_, app, _), config, receipt = demo
    set_relationship(
        config, app.state.sessions, "demo.parent", "demo.student", "parent", remove=True
    )
    with pytest.raises(ValueError, match="relationships"):
        seed_demo(config, app.state.sessions, receipt)
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(StudyLesson)) == 0


def test_seed_preserves_an_existing_manually_published_demo_lesson(demo):
    system, config, receipt = demo
    _, app, _ = system
    first = seed_demo(config, app.state.sessions, receipt, queue_study=True)
    process(system, "study.ingest", first["lesson_id"], Providers())
    with app.state.sessions.begin() as db:
        lesson = db.get(StudyLesson, first["lesson_id"])
        student = db.scalar(select(Account).where(Account.login == "demo.student"))
        db.add(
            SchoolPublication(
                id=seed_id("manual-publication"),
                teacher_id=lesson.owner,
                student_id=student.id,
                lesson_id=lesson.id,
                created=1,
            )
        )
    assert seed_demo(config, app.state.sessions, receipt)["added"] == 0
    with app.state.sessions.begin() as db:
        assert db.scalar(select(func.count()).select_from(SchoolPublication)) == 1
        db.delete(db.get(SchoolPublication, seed_id("manual-publication")))
    assert seed_demo(config, app.state.sessions, receipt)["added"] == 0
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SchoolPublication)) == 0


def test_demo_files_use_real_verification_are_private_and_never_recreate_deleted_uploads(demo):
    (client, app, _), config, receipt = demo
    result = seed_demo(config, app.state.sessions, receipt, with_files=True)
    assert set(result["files"].values()) == {"queued"}
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(FileObject)) == 4
        assert db.scalar(select(func.count()).select_from(OutboxJob)) == 4
        assert all(f.final_key is None for f in db.scalars(select(FileObject)))
    for _ in NAMES:
        assert drain_one(app.state.sessions, config)
    result = seed_demo(config, app.state.sessions, receipt, with_files=True)
    assert set(result["files"].values()) == {"accepted"}
    login(client, "demo.student")
    files = client.get("/api/v1/files").json()
    assert len(files) == 1 and files[0]["filename"] == "demo-physics-study-notes.txt"
    file_id = files[0]["id"]
    assert b"Fictional Atlas" in client.get(f"/api/v1/files/{file_id}/download").content
    assert client.delete(f"/api/v1/files/{file_id}").status_code == 200
    assert drain_one(app.state.sessions, config)
    result = seed_demo(config, app.state.sessions, receipt, with_files=True)
    assert result["files"]["student"] == "deleted"
    assert client.get("/api/v1/files").json() == []
    login(client, "demo.teacher")
    assert client.get(f"/api/v1/files/{file_id}/download").status_code == 404
    assert len(client.get("/api/v1/files").json()) == 1
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(FileObject)) == 4


def test_demo_file_staging_failure_resumes_the_same_upload(demo, monkeypatch):
    (_, app, _), config, receipt = demo
    original = LocalStorage.put
    with monkeypatch.context() as patch:

        def fail(*args, **kwargs):
            raise OSError("Storage unavailable")

        patch.setattr(LocalStorage, "put", fail)
        with pytest.raises(OSError, match="Storage unavailable"):
            seed_demo(config, app.state.sessions, receipt, with_files=True)
    with app.state.sessions() as db:
        first = db.scalar(select(FileObject))
        first_id = first.id
        assert first.state == "pending"
        assert db.scalar(select(func.count()).select_from(OutboxJob)) == 0
    assert LocalStorage.put is original
    result = seed_demo(config, app.state.sessions, receipt, with_files=True)
    assert set(result["files"].values()) == {"queued"}
    with app.state.sessions() as db:
        assert db.get(FileObject, first_id).state == "queued"
        assert db.scalar(select(func.count()).select_from(FileObject)) == 4


def test_demo_file_seed_refuses_remote_storage_before_changing_records(demo):
    (_, app, _), config, receipt = demo
    config.storage_backend = "r2"
    with pytest.raises(ValueError, match="local development storage"):
        seed_demo(config, app.state.sessions, receipt, with_files=True)
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(FileObject)) == 0
        assert db.scalar(select(func.count()).select_from(SchoolAssignment)) == 0


def test_simple_logins_preserve_ids_records_and_normal_password_policy(demo):
    from school2036.demo_seed import simplify_demo_logins
    from school2036.models import AuthSession
    from school2036.operator import reset_password

    (client, app, _), config, receipt = demo
    seed_demo(config, app.state.sessions, receipt)
    login(client, "demo.student")
    with app.state.sessions() as db:
        ids = {
            role: db.scalar(select(Account.id).where(Account.login == f"demo.{role}"))
            for role in NAMES
        }
        outsider = db.scalar(select(Account).where(Account.login == "alice"))
        outsider_hash = outsider.password_hash
    assert simplify_demo_logins(config, app.state.sessions, receipt) == 4
    assert receipt.stat().st_mode & 0o077 == 0
    stored = json.loads(receipt.read_text())
    assert all(stored[role]["account_id"] == ids[role] for role in NAMES)
    assert client.get("/api/v1/auth/me").status_code == 401
    for role in NAMES:
        assert login(client, role, "password")["account_id"] == ids[role]
    with app.state.sessions() as db:
        assert db.get(Account, outsider.id).password_hash == outsider_hash
        assert db.get(SchoolAssignment, seed_id("force-practice")).student_id == ids["student"]
        assert db.scalar(select(func.count()).select_from(AuthSession)) == 1
    assert simplify_demo_logins(config, app.state.sessions, receipt) == 0
    assert seed_demo(config, app.state.sessions, receipt)["added"] == 0
    with pytest.raises(ValueError, match="15"):
        reset_password(config, app.state.sessions, "student", "password")


def test_simple_logins_refuse_collisions_without_any_credential_changes(demo):
    from school2036.demo_seed import simplify_demo_logins

    (_, app, _), config, receipt = demo
    before_receipt = receipt.read_bytes()
    create_user(config, app.state.sessions, "teacher", "An unrelated teacher", PASSWORD)
    with app.state.sessions() as db:
        before = {
            account.id: (account.login, account.password_hash)
            for account in db.scalars(select(Account))
        }
    with pytest.raises(ValueError, match="already in use"):
        simplify_demo_logins(config, app.state.sessions, receipt)
    assert receipt.read_bytes() == before_receipt
    with app.state.sessions() as db:
        assert {
            account.id: (account.login, account.password_hash)
            for account in db.scalars(select(Account))
        } == before


def test_simple_logins_remain_development_only_and_alias_receipts_are_id_bound(demo):
    from school2036.demo_seed import simplify_demo_logins

    (_, app, _), config, receipt = demo
    production = config.model_copy(update={"environment": "production"})
    with pytest.raises(ValueError, match="development"):
        simplify_demo_logins(production, app.state.sessions, receipt)
    simplify_demo_logins(config, app.state.sessions, receipt)
    records = json.loads(receipt.read_text())
    records["student"]["account_id"] = records["teacher"]["account_id"]
    receipt.write_text(json.dumps(records))
    with pytest.raises(ValueError, match="original operator rename receipt"):
        seed_demo(config, app.state.sessions, receipt)
