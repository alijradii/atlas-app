"""Local operator account provisioning; no public registration or bootstrap endpoints."""

import argparse
import getpass
import sys
from uuid import uuid4

from cryptography.fernet import Fernet
from sqlalchemy import delete, select

from school2036.backup import secure_write
from school2036.config import get_settings
from school2036.database import create_session_factory
from school2036.identity import (
    add_account,
    audit,
    check_marker,
    locked_state,
    revoke,
    write_marker,
)
from school2036.models import Account, School, SchoolRelationship
from school2036.school import ROLES, STAFF_ROLES
from school2036.security import password_hash


def create_user(config, sessions, login, name, password):
    login = login.strip().lower()
    if not 3 <= len(login) <= 100 or not 1 <= len(name.strip()) <= 200:
        raise ValueError("Use a login of 3–100 characters and a name of 1–200 characters")
    if not 15 <= len(password) <= 128:
        raise ValueError("Use a password of 15–128 characters")
    with sessions.begin() as db:
        state = locked_state(db)
        if state.deployment_id:
            check_marker(config, state)
        elif config.installation_marker.exists() or state.initialized:
            raise ValueError("Deployment mismatch: investigate before creating accounts")
        if not config.encryption_key_file.exists():
            secure_write(config.encryption_key_file, Fernet.generate_key())
        account = add_account(db, name.strip(), login, [], [])
        account.password_hash = password_hash(password)
        account.status = "active"
        if not state.initialized:
            state.deployment_id = state.deployment_id or str(uuid4())
            state.initialized = True
            state.bootstrap_hash = None
            state.bootstrap_expires = 0
            if not db.get(School, 1):
                db.add(School(id=1, name="Application", settings={}))
        audit(db, "operator.account_created", target=account.id)
        account_id = account.id
        db.commit()
        # A crash here fails closed. Reconcile the explicit deployment ID to recover.
        write_marker(config, state)
        return account_id


def reset_password(config, sessions, login, password):
    if not 15 <= len(password) <= 128:
        raise ValueError("Use a password of 15–128 characters")
    with sessions.begin() as db:
        state = locked_state(db)
        check_marker(config, state)
        if not state.initialized:
            raise ValueError("Installation is not initialized")
        account = db.scalar(select(Account).where(Account.login == login.strip().lower()))
        if not account or account.status != "active":
            raise ValueError("Only active accounts can have their password reset")
        account.password_hash = password_hash(password)
        account.activation_hash = None
        account.activation_expires = 0
        revoke(db, account.id)
        audit(db, "operator.password_reset", target=account.id)


def set_roles(config, sessions, login, roles):
    """Only a trusted machine operator may change application roles."""
    selected = sorted(set(roles))
    if not set(selected) <= ROLES:
        raise ValueError("Roles must be student, teacher, advisor or parent")
    with sessions.begin() as db:
        check_marker(config, locked_state(db))
        account = db.scalar(select(Account).where(Account.login == login.strip().lower()))
        if account is None or account.status != "active":
            raise ValueError("An active account is required")
        account.roles = selected
        # Do not reactivate old authority if the operator grants a role again later.
        db.execute(
            delete(SchoolRelationship).where(
                SchoolRelationship.staff_id == account.id,
                SchoolRelationship.kind.not_in(selected),
            )
        )
        if "student" not in selected:
            db.execute(
                delete(SchoolRelationship).where(SchoolRelationship.student_id == account.id)
            )
        revoke(db, account.id)
        audit(db, "operator.roles_changed", target=account.id, roles=selected)


def set_relationship(config, sessions, staff_login, student_login, kind, *, remove=False):
    """Approve or revoke responsibility for an explicit student; no IP/network assumptions."""
    if kind not in STAFF_ROLES:
        raise ValueError("Relationship must be teacher, advisor or parent")
    with sessions.begin() as db:
        check_marker(config, locked_state(db))
        staff = db.scalar(select(Account).where(Account.login == staff_login.strip().lower()))
        student = db.scalar(select(Account).where(Account.login == student_login.strip().lower()))
        if staff is None or student is None or staff.id == student.id:
            raise ValueError("Two distinct existing accounts are required")
        key = (staff.id, student.id, kind)
        existing = db.get(SchoolRelationship, key)
        if remove:
            if existing:
                db.delete(existing)
        else:
            if (
                staff.status != "active"
                or student.status != "active"
                or kind not in staff.roles
                or "student" not in student.roles
            ):
                raise ValueError("Active accounts with the matching roles are required")
            if existing is None:
                db.add(SchoolRelationship(staff_id=staff.id, student_id=student.id, kind=kind))
        audit(
            db,
            "operator.relationship_revoked" if remove else "operator.relationship_granted",
            target=student.id,
            staff=staff.id,
            kind=kind,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-user")
    create.add_argument("--login", required=True)
    create.add_argument("--name", required=True)
    reset = commands.add_parser("reset-password")
    reset.add_argument("--login", required=True)
    reconcile = commands.add_parser("reconcile-installed")
    reconcile.add_argument("--deployment-id", required=True)
    reconcile.add_argument("--reason", required=True)
    roles = commands.add_parser("set-roles")
    roles.add_argument("--login", required=True)
    roles.add_argument("--roles", nargs="*", choices=sorted(ROLES), required=True)
    relationship = commands.add_parser("set-relationship")
    relationship.add_argument("--staff", required=True)
    relationship.add_argument("--student", required=True)
    relationship.add_argument("--kind", choices=sorted(STAFF_ROLES), required=True)
    relationship.add_argument("--remove", action="store_true")
    args = parser.parse_args()
    config = get_settings()
    engine, sessions = create_session_factory(config)
    try:
        if args.command == "set-roles":
            set_roles(config, sessions, args.login, args.roles)
        elif args.command == "set-relationship":
            set_relationship(
                config, sessions, args.staff, args.student, args.kind, remove=args.remove
            )
        elif args.command == "reconcile-installed":
            with sessions.begin() as db:
                state = locked_state(db)
                if not state.initialized or state.deployment_id != args.deployment_id:
                    raise ValueError("Only a verified initialized database can be reconciled")
                if len(args.reason.strip()) < 5:
                    raise ValueError("A recovery reason is required")
                audit(db, "operator.marker_reconciled", reason=args.reason)
                db.commit()
                write_marker(config, state)
        else:
            password = getpass.getpass("Password (15–128 characters): ")
            if password != getpass.getpass("Confirm password: "):
                raise ValueError("Passwords do not match")
            if args.command == "create-user":
                create_user(config, sessions, args.login, args.name, password)
            else:
                reset_password(config, sessions, args.login, password)
        print("Account operation completed.")
    except ValueError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from None
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
