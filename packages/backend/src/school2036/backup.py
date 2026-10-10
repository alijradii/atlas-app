"""Encrypted P1 backup and restore into a NEW PostgreSQL database only.

Requires PostgreSQL 18 client tools on PATH, or --compose to use the Compose postgres service.
No shell strings are executed; credentials stay in environment variables.
"""

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url

from school2036.config import get_settings
from school2036.database import create_session_factory
from school2036.identity import audit, check_marker, locked_state
from school2036.models import FileObject
from school2036.storage import LocalStorage, create_storage, validate_key


def client_command(config, compose, program, *args, data=None):
    url = make_url(config.database_url.get_secret_value())
    env = dict(os.environ)
    if compose:
        command = [
            "docker",
            "compose",
            "-f",
            compose,
            "exec",
            "-T",
            "postgres",
            program,
            "-U",
            url.username,
            *args,
        ]
    else:
        env.update(
            PGHOST=url.host or "localhost",
            PGPORT=str(url.port or 5432),
            PGUSER=url.username or "school",
            PGPASSWORD=url.password or "",
        )
        command = [program, *args]
    result = subprocess.run(command, input=data, capture_output=True, env=env)
    if result.returncode:
        # stderr can contain database identifiers; don't reproduce it in web/job logs.
        raise RuntimeError(f"{program} failed; inspect operator diagnostics securely")
    return result.stdout


def secure_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def backup(config, destination, key_file, compose=None):
    engine, sessions = create_session_factory(config)
    try:
        with sessions.begin() as db:
            state = locked_state(db)
            check_marker(config, state)
            if not state.initialized:
                raise ValueError("Finalize installation before taking the P1 school backup")
            dump = client_command(
                config,
                compose,
                "pg_dump",
                "--format=custom",
                "--no-owner",
                make_url(config.database_url.get_secret_value()).database,
            )
            configuration = config.model_dump(mode="json")
            for name in type(config).model_fields:
                value = getattr(config, name)
                if isinstance(value, SecretStr):
                    configuration[name] = value.get_secret_value()
            media = []
            storage = create_storage(config)
            for file in db.scalars(select(FileObject).where(FileObject.state == "accepted")):
                data = storage.get(file.final_key, file.expected_size)
                if hashlib.sha256(data).hexdigest() != file.checksum:
                    raise ValueError("Media checksum mismatch; backup cannot be accepted")
                media.append(
                    {
                        "key": file.final_key,
                        "checksum": file.checksum,
                        "type": file.media_type,
                        "bytes": base64.b64encode(data).decode(),
                    }
                )
            contents = {
                "format": 2,
                "configuration": configuration,
                "deployment_id": state.deployment_id,
                "database": base64.b64encode(dump).decode(),
                "marker": config.installation_marker.read_text(),
                "identity_key": config.encryption_key_file.read_text(),
                "media": media,
            }
            encrypted = Fernet(key_file.read_bytes()).encrypt(json.dumps(contents).encode())
            secure_write(destination, encrypted)
            audit(db, "operator.backup_created", target=destination.name)
    finally:
        engine.dispose()


def restore(config, source, key_file, database, output, compose=None):
    if not re.fullmatch(r"school2036_restore_[a-z0-9_]{1,40}", database):
        raise ValueError("Restore database must use the school2036_restore_ prefix")
    if output.exists():
        raise ValueError("Restore directory must not already exist")
    contents = json.loads(Fernet(key_file.read_bytes()).decrypt(source.read_bytes()))
    marker = json.loads(contents["marker"])
    if contents["format"] not in {1, 2} or not marker["initialized"]:
        raise ValueError("Only installed P1 backups are supported")
    if marker["deployment_id"] != contents["deployment_id"]:
        raise ValueError("Inconsistent backup deployment identity")
    Fernet(contents["identity_key"].encode())
    media = contents["media"] if contents["format"] == 2 else []
    for item in media:
        validate_key(item["key"])
        if not item["key"].startswith("objects/"):
            raise ValueError("Backup contains an invalid immutable media key")
        data = base64.b64decode(item["bytes"], validate=True)
        if hashlib.sha256(data).hexdigest() != item["checksum"]:
            raise ValueError("Backup media checksum does not match")
    # createdb fails if the destination already exists; never clean or overwrite a database.
    client_command(config, compose, "createdb", database)
    client_command(
        config,
        compose,
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        database,
        data=base64.b64decode(contents["database"], validate=True),
    )
    url = make_url(config.database_url.get_secret_value()).set(database=database)
    engine = create_engine(url)
    try:
        with engine.begin() as db:
            actual = db.execute(
                text("SELECT deployment_id, initialized FROM installation_state WHERE id=1")
            ).one()
            if actual.deployment_id != contents["deployment_id"] or not actual.initialized:
                raise ValueError("Restored database does not match its deployment marker")
            db.execute(text("DELETE FROM auth_session"))
            db.execute(text("UPDATE account SET activation_hash=NULL, activation_expires=0"))
            db.execute(
                text(
                    "UPDATE outbox_job SET state='cancelled' "
                    "WHERE state IN ('queued','running','retrying')"
                )
            )
            # Old backups may predate P6. Restores never replay model requests or retain consent.
            if db.scalar(text("SELECT to_regclass('ai_task')")):
                db.execute(
                    text(
                        "UPDATE ai_task SET state='cancelled', payload='{}', "
                        "error='Cancelled by restore; request fresh assistance' "
                        "WHERE state IN ('queued','running')"
                    )
                )
                db.execute(
                    text(
                        "UPDATE ai_source SET state='failed', sections='[]', embeddings='[]' "
                        "WHERE state IN ('queued','running')"
                    )
                )
                db.execute(
                    text(
                        "UPDATE ai_policy SET settings=jsonb_set(settings::jsonb, "
                        "'{mode}', '\"disabled\"')::json, revision=revision+1"
                    )
                )
    finally:
        engine.dispose()
    output.mkdir(mode=0o700, parents=True)
    storage = LocalStorage(output / "media")
    for item in media:
        storage.put(item["key"], base64.b64decode(item["bytes"], validate=True), item["type"])
    secure_write(output / "installation.json", contents["marker"].encode())
    secure_write(output / "identity.key", contents["identity_key"].encode())
    secure_write(
        output / "source-configuration.json", json.dumps(contents["configuration"]).encode()
    )
    secure_write(
        output / "RESTORE.json",
        json.dumps(
            {
                "database": database,
                "deployment_id": contents["deployment_id"],
                "outbound_jobs": "cancelled",
                "sessions": "revoked",
                "activation_codes": "revoked",
                "media_objects": len(media),
                "media_directory": str(output / "media"),
                "media_restore": (
                    "Use this isolated local media directory for rehearsal; "
                    "verify a separate R2 recovery bucket before production"
                ),
            }
        ).encode(),
    )
    return contents["deployment_id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["keygen", "backup", "restore"])
    parser.add_argument("--key-file", type=Path, required=True)
    parser.add_argument("--file", type=Path)
    parser.add_argument("--compose")
    parser.add_argument("--database")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.action == "keygen":
        secure_write(args.key_file, Fernet.generate_key())
    elif args.action == "backup":
        if not args.file:
            parser.error("backup requires --file")
        backup(get_settings(), args.file, args.key_file, args.compose)
    else:
        if not all([args.file, args.database, args.output]):
            parser.error("restore requires --file, --database and --output")
        restore(get_settings(), args.file, args.key_file, args.database, args.output, args.compose)
    print("Completed. Keep recovery keys separate from backup archives.")


if __name__ == "__main__":
    main()
