"""Add fictional, persisted examples to the four existing local hackathon accounts.

This is an explicit development operator tool, not a public endpoint or startup seed.
"""

import argparse
import hashlib
import json
import time
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

from sqlalchemy import select
from sqlalchemy.engine import make_url

from school2036.backup import secure_write
from school2036.config import get_settings
from school2036.database import create_session_factory
from school2036.identity import audit, check_marker, locked_state, revoke
from school2036.jobs import enqueue
from school2036.media import new_upload
from school2036.models import (
    Account,
    AuditEvent,
    FileObject,
    Person,
    SchoolAssignment,
    SchoolMessage,
    SchoolProposal,
    SchoolPublication,
    SchoolRelationship,
    StudyLesson,
)
from school2036.schemas import UploadInput
from school2036.security import password_hash, verify_password
from school2036.storage import create_storage

NAMES = {
    "student": "Lina Haddad",
    "teacher": "Elie Daher",
    "advisor": "Maya Nassar",
    "parent": "Karim Haddad",
}
TRANSCRIPT = """[00:00] Fictional Atlas demonstration session: Newton's second law.
[00:12] A net force changes an object's velocity. Acceleration equals net force divided by mass.
[00:30] For a four kilogram cart with a net force of ten newtons, acceleration is 2.5 metres per
second squared.
[00:50] Mass describes the amount of matter and is measured in kilograms. Weight is a force,
measured in newtons.
[01:10] On Earth, weight equals mass times 9.8 metres per second squared. A sixty kilogram
student's weight is 588 newtons.
[01:30] If the same net force pushes twice the mass, acceleration halves. Always identify the
net force before using F = ma.
[01:50] Try the calculation independently, include units, then compare your reasoning with the
example.
"""
REVIEW_TRANSCRIPT = """Fictional Atlas demonstration notes: planning a physics study session.
First, distinguish mass in kilograms from weight in newtons. Next, write F = ma and identify the
unknown.
Work through one example independently before asking for help. Explain each step and keep the units.
Review these notes before preparing them for the study assistant. This is synthetic example
material, not a recording of a real student.
"""


def seed_id(label):
    return str(uuid5(NAMESPACE_URL, "https://atlas.local/hackathon-demo/v1/" + label))


def _demo_receipt(config, receipt: Path):
    """Require local development and a private operator credential receipt."""
    if config.environment != "development":
        raise ValueError("Demo examples require the development environment")
    if make_url(config.database_url.get_secret_value()).host not in {"127.0.0.1", "localhost"}:
        raise ValueError("Demo examples require a loopback database")
    if receipt.is_symlink() or not receipt.is_file() or receipt.stat().st_mode & 0o077:
        raise ValueError("Use a private, regular demo-account receipt with mode 0600")
    try:
        credentials = json.loads(receipt.read_text())
    except OSError, ValueError:
        raise ValueError("The local demo-account receipt is unavailable") from None
    if not isinstance(credentials, dict) or set(credentials) != set(NAMES):
        raise ValueError("The receipt must identify exactly the four demo accounts")
    return credentials


def _demo_accounts(db, credentials):
    accounts = {}
    for role in NAMES:
        record = credentials[role]
        if (
            not isinstance(record, dict)
            or record.get("login") not in {f"demo.{role}", role}
            or not isinstance(record.get("password"), str)
        ):
            raise ValueError("The receipt may only contain the designated demo logins")
        account = db.scalar(select(Account).where(Account.login == record["login"]))
        if (
            account is None
            or account.status != "active"
            or role not in account.roles
            or not verify_password(record["password"], account.password_hash)
        ):
            raise ValueError("All four active demo accounts and matching credentials are required")
        if record["login"] == role and (
            record.get("account_id") != account.id
            or not db.scalar(
                select(AuditEvent.id)
                .where(
                    AuditEvent.action == "operator.demo_login_simplified",
                    AuditEvent.target == account.id,
                )
                .limit(1)
            )
        ):
            raise ValueError("Simple demo logins require the original operator rename receipt")
        accounts[role] = account.id
    for role in ("teacher", "advisor", "parent"):
        if not db.get(SchoolRelationship, (accounts[role], accounts["student"], role)):
            raise ValueError("Existing demo student relationships are required")
    return accounts


def simplify_demo_logins(config, sessions, receipt: Path):
    """Explicit hackathon-only rename, never a public password-policy exception.

    The user requested these four local accounts with the shared password `password`.
    No new identities or roles are created; IDs and all persisted data survive.
    """
    credentials = _demo_receipt(config, receipt)
    pending = receipt.with_name(receipt.name + ".pending-" + uuid4().hex)
    prepared = False
    committed = False
    changed = 0
    try:
        with sessions.begin() as db:
            check_marker(config, locked_state(db))
            accounts = _demo_accounts(db, credentials)
            for role, account_id in accounts.items():
                occupied = db.scalar(select(Account).where(Account.login == role))
                if occupied and occupied.id != account_id:
                    raise ValueError(
                        "A requested simple login is already in use; no changes applied"
                    )
            updated = {}
            for role, account_id in accounts.items():
                account = db.get(Account, account_id)
                if account.login != role or not verify_password("password", account.password_hash):
                    account.login = role
                    account.password_hash = password_hash("password")
                    account.activation_hash = None
                    account.activation_expires = 0
                    revoke(db, account.id)
                    audit(db, "operator.demo_login_simplified", target=account.id)
                    changed += 1
                updated[role] = {
                    "login": role,
                    "password": "password",
                    "account_id": account.id,
                }
            secure_write(pending, json.dumps(updated, indent=2).encode())
            prepared = True
        committed = True
        pending.replace(receipt)
    finally:
        # A failed DB transaction leaves the old receipt intact. If replacing the
        # receipt fails after commit, retain the private pending receipt for recovery.
        if prepared and not committed:
            pending.unlink(missing_ok=True)
    return changed


def seed_demo(config, sessions, receipt: Path, *, queue_study=False, with_files=False):
    """Add missing examples; never reset passwords, existing work or indexed sources."""
    credentials = _demo_receipt(config, receipt)
    if with_files and config.storage_backend != "local":
        raise ValueError("Demo file examples require local development storage")
    now = time.time()
    added = 0
    with sessions.begin() as db:
        check_marker(config, locked_state(db))
        # Validate the entire receipt and responsibility graph before any write.
        accounts = _demo_accounts(db, credentials)
        student, teacher, advisor, parent = (accounts[role] for role in NAMES)
        for role, name in NAMES.items():
            person = db.get(Person, accounts[role])
            # A later operator/user rename is meaningful and must survive reruns.
            if person.name == f"Demo {role.title()}":
                person.name = name

        def add(model, label, **fields):
            nonlocal added
            key = seed_id(label)
            existing = db.get(model, key)
            if existing:
                # Refuse a stable-ID collision rather than modifying somebody else's record.
                for field in ("owner", "teacher_id", "student_id", "advisor_id", "parent_id"):
                    if field in fields and getattr(existing, field) != fields[field]:
                        raise ValueError("Demo record ownership mismatch; no changes applied")
                return existing
            record = model(id=key, **fields)
            db.add(record)
            db.flush()
            added += 1
            return record

        lesson = add(
            StudyLesson,
            "physics-session",
            owner=teacher,
            title="Demo · Newton’s second law",
            subject="Physics",
            transcript=TRANSCRIPT,
            source_kind="transcript",
            state="review",
            error="",
            created=now - 86400,
        )
        add(
            StudyLesson,
            "student-review-notes",
            owner=student,
            title="Demo · My physics study notes",
            subject="Physics",
            transcript=REVIEW_TRANSCRIPT,
            source_kind="transcript",
            state="review",
            error="",
            created=now - 3600,
        )
        if queue_study and lesson.state == "review" and lesson.transcript == TRANSCRIPT:
            lesson.state = "queued"
            enqueue(
                db, "study.ingest", teacher, {"lesson_id": lesson.id}, seed_id("physics-ingest")
            )
        # A real provider receipt is mandatory. Run again after the worker finishes.
        previously_published = db.scalar(
            select(AuditEvent.id)
            .where(
                AuditEvent.action == "operator.demo_publication_seeded",
                AuditEvent.target == seed_id("physics-publication"),
            )
            .limit(1)
        )
        if lesson.state == "ready" and lesson.source_id and not previously_published:
            existing_publication = db.scalar(
                select(SchoolPublication).where(
                    SchoolPublication.teacher_id == teacher,
                    SchoolPublication.student_id == student,
                    SchoolPublication.lesson_id == lesson.id,
                )
            )
            if not existing_publication:
                add(
                    SchoolPublication,
                    "physics-publication",
                    teacher_id=teacher,
                    student_id=student,
                    lesson_id=lesson.id,
                    created=now,
                )
            audit(db, "operator.demo_publication_seeded", teacher, seed_id("physics-publication"))
        work = [
            (
                "force-practice",
                "Newton’s second law",
                "assigned",
                "",
                "",
                (
                    "A 4 kg cart has a net force of 10 N. Find its acceleration and "
                    "explain your steps."
                ),
            ),
            (
                "weight-submission",
                "Mass and weight",
                "submitted",
                "Weight = 60 × 9.8 = 588 N. Mass stays 60 kg; weight depends on gravity.",
                "",
                (
                    "Find the weight on Earth of a student whose mass is 60 kg. "
                    "Explain mass versus weight."
                ),
            ),
            (
                "energy-feedback",
                "Energy in everyday motion",
                "reviewed",
                (
                    "The moving bicycle has kinetic energy. Braking transfers some "
                    "energy to thermal energy."
                ),
                (
                    "You identified the transfer clearly. Next time, name the system "
                    "whose energy you are tracking."
                ),
                "Describe the energy transfers when a moving bicycle slows down.",
            ),
        ]
        for label, title, state, answer, feedback, instructions in work:
            add(
                SchoolAssignment,
                label,
                teacher_id=teacher,
                student_id=student,
                title=f"Demo · {title}",
                instructions="Fictional practice example. " + instructions,
                lesson_id=None,
                due_at=now + 86400 if state == "assigned" else None,
                state=state,
                answer=answer,
                feedback=feedback,
                created=now - 172800,
                submitted_at=now - 3600 if state in {"submitted", "reviewed"} else None,
            )
        messages = [
            (
                "question",
                student,
                "Demo conversation: do universities consider Design & Technology for engineering?",
                now - 7200,
            ),
            (
                "reply",
                advisor,
                (
                    "It can show practical problem-solving. Keep Mathematics and "
                    "Physics strong, then compare the actual entry requirements of the"
                    " courses you are considering."
                ),
                now - 3600,
            ),
        ]
        for label, sender, content, created in messages:
            add(
                SchoolMessage,
                label,
                student_id=student,
                advisor_id=advisor,
                sender_id=sender,
                content=content,
                created=created,
            )
        plans = [
            ("cs-plan", "Computer Science", "pending_advisor", "", ""),
            (
                "physics-plan",
                "Physics project",
                "pending_parent",
                (
                    "A small mechanics project fits Lina’s interests. I recommend "
                    "starting with a weekly hour."
                ),
                "",
            ),
            (
                "study-plan",
                "Weekly study routine",
                "approved",
                "Two short independent practice sessions each week is a manageable start.",
                "Agreed. We will keep Tuesday and Thursday evenings available.",
            ),
        ]
        for label, title, state, advisor_note, parent_note in plans:
            add(
                SchoolProposal,
                label,
                student_id=student,
                advisor_id=advisor,
                parent_id=parent,
                title=f"Demo · {title}",
                description=(
                    "Fictional learning proposal: explore this option together and "
                    "agree on a manageable next step."
                ),
                state=state,
                advisor_note=advisor_note,
                parent_note=parent_note,
                created=now - 172800,
                updated=now - 3600,
            )
        audit(
            db,
            "operator.demo_examples_seeded",
            target="hackathon-demo-v1",
            added=added,
            queue_study=queue_study,
        )
        result = {"added": added, "lesson_state": lesson.state, "lesson_id": lesson.id}
    if with_files:
        result["files"] = _seed_demo_files(config, sessions, accounts)
    return result


def _seed_demo_files(config, sessions, accounts):
    """Follow normal staging and worker verification; resume safely after interruptions."""
    examples = {
        "teacher": ("demo-newtons-second-law-session.txt", TRANSCRIPT),
        "student": ("demo-physics-study-notes.txt", REVIEW_TRANSCRIPT),
        "advisor": (
            "demo-advisor-guidance.txt",
            "Fictional Atlas guidance example.\n"
            "Discuss what Lina enjoys before selecting a subject. Compare published entry "
            "requirements for each course. Keep Mathematics and Physics practice consistent.\n"
            "Agree on a small next step together; the advisor and family make the decisions.\n",
        ),
        "parent": (
            "demo-family-study-plan.txt",
            "Fictional Atlas family study plan.\n"
            "Keep Tuesday and Thursday evenings available for two short independent practice "
            "sessions. Ask Lina which part felt clear and which part needs another attempt.\n"
            "Review the physics-project proposal together before making a decision.\n",
        ),
    }
    result = {}
    storage = create_storage(config)
    for role, (filename, text) in examples.items():
        content = text.encode("utf-8")
        checksum = hashlib.sha256(content).hexdigest()
        owner = accounts[role]
        # First commit the staging record. If storage fails later, reruns can
        # resume the same pending upload instead of leaking untracked objects.
        with sessions.begin() as db:
            check_marker(config, locked_state(db))
            actor = db.get(Account, owner)
            if (
                actor.status != "active"
                or actor.login not in {f"demo.{role}", role}
                or role not in actor.roles
            ):
                raise ValueError("Demo account authorization changed; no file uploaded")
            receipt = db.scalar(
                select(AuditEvent)
                .where(
                    AuditEvent.action == "operator.demo_file_seeded",
                    AuditEvent.target == f"hackathon-demo-v1:{role}",
                )
                .limit(1)
            )
            if receipt:
                value = db.get(FileObject, receipt.detail["file_id"])
                if value is None:
                    result[role] = "removed"
                    continue
                if value.owner != owner or value.checksum != checksum or value.filename != filename:
                    raise ValueError("Demo file ownership or content mismatch")
            else:
                value = new_upload(
                    db,
                    config,
                    actor,
                    UploadInput(
                        filename=filename,
                        media_type="text/plain",
                        size=len(content),
                        checksum=checksum,
                    ),
                )
                audit(
                    db,
                    "operator.demo_file_seeded",
                    owner,
                    f"hackathon-demo-v1:{role}",
                    file_id=value.id,
                )
            file_id = value.id
        with sessions.begin() as db:
            check_marker(config, locked_state(db))
            value = db.scalar(select(FileObject).where(FileObject.id == file_id).with_for_update())
            actor = db.get(Account, owner)
            if (
                actor.status != "active"
                or actor.login not in {f"demo.{role}", role}
                or role not in actor.roles
            ):
                raise ValueError("Demo account authorization changed; no file uploaded")
            if value.state == "pending" and value.expires > time.time():
                storage.put(value.staging_key, content, value.media_type)
                value.state = "queued"
                enqueue(
                    db,
                    "personal_media.verify",
                    owner,
                    {"file_id": value.id},
                    seed_id(f"file-verify-{role}"),
                )
            result[role] = value.state
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, default=Path(".data/hackathon-accounts.json"))
    parser.add_argument(
        "--queue-study",
        action="store_true",
        help=(
            "Approve and queue one short synthetic lesson through the real RAG"
            " worker; may use provider credits"
        ),
    )
    parser.add_argument(
        "--with-files",
        action="store_true",
        help="Upload one small synthetic TXT file per demo account through normal verification",
    )
    parser.add_argument(
        "--simple-logins",
        action="store_true",
        help="Explicitly rename the four receipt-bound local demo accounts for hackathon sign-in",
    )
    args = parser.parse_args()
    if args.simple_logins and (args.queue_study or args.with_files):
        parser.error("Run --simple-logins separately from demo seeding")
    config = get_settings()
    engine, sessions = create_session_factory(config)
    try:
        if args.simple_logins:
            count = simplify_demo_logins(config, sessions, args.receipt)
            print(f"Updated {count} local demo accounts; private receipt refreshed.")
            return
        result = seed_demo(
            config, sessions, args.receipt, queue_study=args.queue_study, with_files=args.with_files
        )
        print(f"Added {result['added']} demo records. Lesson: {result['lesson_state']}.")
        if "files" in result:
            print(
                "Demo file states: "
                + ", ".join(f"{role}: {state}" for role, state in result["files"].items())
            )
        if result["lesson_state"] in {"queued", "indexing"}:
            print(
                "After the worker finishes, run again without --queue-study to "
                "publish the ready lesson."
            )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
