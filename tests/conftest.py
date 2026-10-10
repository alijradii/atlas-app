"""Isolated PostgreSQL schemas; never use the application's configured database URL."""

import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from school2036.config import Settings
from school2036.operator import create_user
from school_api.main import create_app
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

PASSWORD = "synthetic secure password 2036"


@pytest.fixture
def system(tmp_path):
    url = make_url(
        os.getenv(
            "SCHOOL_TEST_DATABASE_URL",
            "postgresql+psycopg://school:school@127.0.0.1:5432/school2036",
        )
    )
    if url.host not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Tests require a localhost PostgreSQL database")
    schema = "test_" + uuid4().hex
    root = create_engine(url)
    with root.begin() as db:
        db.execute(text(f'CREATE SCHEMA "{schema}"'))
    config = Settings(
        _env_file=None,
        environment="test",
        storage_backend="local",
        scanner_host="",
        media_quota_bytes=100 * 1024 * 1024,
        database_url=url.update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(
            hide_password=False
        ),
        installation_marker=tmp_path / "installation.json",
        encryption_key_file=tmp_path / "identity.key",
        local_storage_path=tmp_path / "media",
    )
    try:
        migration = Config("alembic.ini")
        migration.attributes["settings"] = config
        command.upgrade(migration, "head")
        app = create_app(config)
        create_user(config, app.state.sessions, "alice", "Alice", PASSWORD)
        create_user(config, app.state.sessions, "bob", "Bob", PASSWORD)
        with TestClient(app, headers={"Origin": config.public_origin}) as client:
            yield client, app, config
    finally:
        with root.begin() as db:
            db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        root.dispose()
