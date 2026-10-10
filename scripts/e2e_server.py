"""Disposable browser-test schema and synthetic local credentials."""

import os
import shutil
import threading
from pathlib import Path
from uuid import uuid4

import uvicorn
from alembic import command
from alembic.config import Config
from school2036.config import Settings
from school2036.operator import create_user
from school_api.main import create_app
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

url = make_url(
    os.getenv(
        "SCHOOL_TEST_DATABASE_URL", "postgresql+psycopg://school:school@127.0.0.1:5432/school2036"
    )
)
if url.host not in {"127.0.0.1", "localhost"}:
    raise SystemExit("Browser tests require localhost PostgreSQL")
schema = "browser_" + uuid4().hex
root = create_engine(url)
folder = Path(".data/e2e") / schema
with root.begin() as db:
    db.execute(text(f'CREATE SCHEMA "{schema}"'))
config = Settings(
    _env_file=None,
    environment="test",
    rag_api_key="synthetic-browser-rag-key-not-a-secret",
    gemini_api_key="synthetic-browser-model-key-not-a-secret",
    storage_backend="local",
    scanner_host="",
    media_quota_bytes=100 * 1024 * 1024,
    public_origin="http://localhost:3100",
    database_url=url.update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(
        hide_password=False
    ),
    installation_marker=folder / "installation.json",
    encryption_key_file=folder / "identity.key",
    local_storage_path=folder / "media",
)
try:
    migration = Config("alembic.ini")
    migration.attributes["settings"] = config
    command.upgrade(migration, "head")
    app = create_app(config)
    create_user(
        config, app.state.sessions, "browser", "Browser Test", "synthetic browser password 2036"
    )
    create_user(
        config, app.state.sessions, "study-peer", "Study Peer", "synthetic browser password 2036"
    )
    from e2e_study import BrowserStudyProviders
    from school2036 import study_jobs
    from school2036.jobs import drain_one

    providers = BrowserStudyProviders()
    study_jobs.StudyProviders = lambda _config: providers
    stopped = threading.Event()

    def drain():
        while not stopped.wait(0.1):
            drain_one(app.state.sessions, config)

    worker = threading.Thread(target=drain, daemon=True)
    worker.start()
    try:
        uvicorn.run(app, host="127.0.0.1", port=8100, access_log=False)
    finally:
        stopped.set()
        worker.join(timeout=5)
finally:
    with root.begin() as db:
        db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    root.dispose()
    shutil.rmtree(folder, ignore_errors=True)
