"""Local operator account provisioning; no public registration or bootstrap endpoints."""

import argparse
import getpass
import sys
from uuid import uuid4

from cryptography.fernet import Fernet
from sqlalchemy import select

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
from school2036.models import Account, School
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
    args = parser.parse_args()
    config = get_settings()
    engine, sessions = create_session_factory(config)
    try:
        if args.command == "reconcile-installed":
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
