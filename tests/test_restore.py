"""A real encrypted backup/restore of an isolated database and personal-file bytes."""

import os
from uuid import uuid4

from alembic import command
from alembic.config import Config
from conftest import PASSWORD
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from school2036.backup import backup, restore
from school2036.config import Settings
from school2036.operator import create_user
from school_api.main import create_app
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from test_identity import login
from test_media import DATA, upload


def test_encrypted_personal_media_restore(tmp_path):
    url = make_url(
        os.getenv(
            "SCHOOL_TEST_DATABASE_URL",
            "postgresql+psycopg://school:school@127.0.0.1:5432/school2036",
        )
    )
    if url.host not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Restore tests require localhost PostgreSQL")
    suffix = uuid4().hex
    source = "school2036_restore_src_" + suffix
    target = "school2036_restore_dst_" + suffix
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    with admin.connect() as db:
        db.execute(text(f'CREATE DATABASE "{source}"'))
    config = Settings(
        _env_file=None,
        environment="test",
        storage_backend="local",
        scanner_host="",
        media_quota_bytes=100 * 1024 * 1024,
        database_url=url.set(database=source).render_as_string(hide_password=False),
        installation_marker=tmp_path / "source/installation.json",
        encryption_key_file=tmp_path / "source/identity.key",
        local_storage_path=tmp_path / "source/media",
    )
    try:
        migration = Config("alembic.ini")
        migration.attributes["settings"] = config
        command.upgrade(migration, "head")
        app = create_app(config)
        create_user(config, app.state.sessions, "alice", "Alice", PASSWORD)
        with TestClient(app, headers={"Origin": config.public_origin}) as client:
            login(client)
            file = upload(client)
        key = tmp_path / "backup.key"
        key.write_bytes(Fernet.generate_key())
        archive = tmp_path / "backup.enc"
        backup(config, archive, key, "infra/compose.dev.yaml")
        assert DATA not in archive.read_bytes()
        destination = tmp_path / "restored"
        restore(config, archive, key, target, destination, "infra/compose.dev.yaml")
        restored = Settings(
            _env_file=None,
            environment="test",
            storage_backend="local",
            scanner_host="",
            media_quota_bytes=100 * 1024 * 1024,
            database_url=url.set(database=target).render_as_string(hide_password=False),
            installation_marker=destination / "installation.json",
            encryption_key_file=destination / "identity.key",
            local_storage_path=destination / "media",
        )
        restored_app = create_app(restored)
        with TestClient(restored_app, headers={"Origin": restored.public_origin}) as client:
            with restored_app.state.sessions() as db:
                assert db.scalar(text("SELECT count(*) FROM auth_session")) == 0
            login(client)
            assert client.get(f"/api/v1/files/{file['id']}/download").content == DATA
    finally:
        with admin.connect() as db:
            for name in [target, source]:
                db.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
        admin.dispose()
