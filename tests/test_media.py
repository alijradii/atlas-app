import hashlib
import time
from unittest.mock import patch

import pytest
from school2036.jobs import drain_one
from school2036.media import reconcile_media
from school2036.models import FileObject
from school2036.storage import create_storage
from test_identity import login

DATA = b"Private test file\n"


def start(client, data=DATA, **overrides):
    payload = {
        "filename": "note.txt",
        "media_type": "text/plain",
        "size": len(data),
        "checksum": hashlib.sha256(data).hexdigest(),
        **overrides,
    }
    return client.post("/api/v1/uploads", json=payload)


def upload(client, data=DATA):
    response = start(client, data)
    assert response.status_code == 200, response.text
    value = response.json()
    assert client.put(value["url"], content=data).status_code == 200
    response = client.post(f"/api/v1/uploads/{value['id']}/complete")
    assert response.status_code == 200, response.text
    return response.json()


def test_upload_download_delete_and_worker(system):
    client, app, config = system
    login(client)
    value = upload(client)
    assert value["state"] == "accepted"
    assert client.get("/api/v1/files").json()[0]["filename"] == "note.txt"
    response = client.get(f"/api/v1/files/{value['id']}/download")
    assert response.content == DATA
    assert response.headers["content-disposition"].startswith("attachment;")
    assert response.headers["cache-control"] == "no-store"
    assert client.delete(f"/api/v1/files/{value['id']}").status_code == 200
    assert client.get(f"/api/v1/files/{value['id']}/download").status_code == 404
    assert drain_one(app.state.sessions, config)
    assert client.get("/api/v1/files").json() == []
    assert list(config.local_storage_path.rglob("*.txt")) == []
    with app.state.sessions() as db:
        record = db.get(FileObject, value["id"])
        with pytest.raises(FileNotFoundError):
            create_storage(config).get(record.final_key)


def test_files_are_private_to_owner(system):
    client, _, _ = system
    assert start(client).status_code == 401
    login(client)
    value = upload(client)
    login(client, "bob")
    assert client.get("/api/v1/files").json() == []
    for method, path in [
        ("get", f"/uploads/{value['id']}"),
        ("post", f"/uploads/{value['id']}/complete"),
        ("put", f"/uploads/{value['id']}/bytes"),
        ("get", f"/files/{value['id']}/download"),
        ("delete", f"/files/{value['id']}"),
    ]:
        assert getattr(client, method)("/api/v1" + path).status_code == 404


def test_checksum_and_malware_rejection(system):
    client, _, _ = system
    login(client)
    value = start(client, checksum="0" * 64).json()
    client.put(value["url"], content=DATA)
    assert client.post(f"/api/v1/uploads/{value['id']}/complete").json()["state"] == "rejected"
    assert client.get(f"/api/v1/files/{value['id']}/download").status_code == 404
    assert upload(client, b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE")["state"] == "rejected"


def test_expiry_quota_and_request_limits(system):
    client, app, config = system
    login(client)
    assert start(client, filename="../secret").status_code == 422
    assert start(client, size=10 * 1024 * 1024 + 1).status_code == 422
    value = start(client).json()
    assert client.put(value["url"], content=b"wrong size").status_code == 422
    assert client.put(value["url"], content=b"x" * (50 * 1024 * 1024 + 1)).status_code == 413
    with app.state.sessions.begin() as db:
        db.get(FileObject, value["id"]).expires = time.time() - 1
    assert client.put(value["url"], content=DATA).status_code == 409
    assert client.post(f"/api/v1/uploads/{value['id']}/complete").status_code == 410
    config.media_quota_bytes = 1
    assert start(client).status_code == 413


def test_scanner_failure_never_releases_file_and_retry_uses_captured_bytes(system):
    client, app, config = system
    login(client)
    config.scanner_host = "scanner.invalid"
    value = upload(client)
    assert value["state"] == "queued"
    with patch("school2036.media.scan_with_clamd", side_effect=OSError("secret scanner error")):
        assert drain_one(app.state.sessions, config)
    status = client.get(f"/api/v1/uploads/{value['id']}").json()
    assert status["state"] == "quarantined"
    assert "secret" not in status["error"]
    assert client.get(f"/api/v1/files/{value['id']}/download").status_code == 404
    with app.state.sessions.begin() as db:
        record = db.get(FileObject, value["id"])
        create_storage(config).put(record.staging_key, b"Changed after capture", "text/plain")
        from school2036.media import process_upload

        with patch("school2036.media.scan_with_clamd"):
            process_upload(db, config, record.id)
    assert client.get(f"/api/v1/files/{value['id']}/download").content == DATA


def test_abandoned_upload_cleanup(system):
    client, app, config = system
    login(client)
    value = start(client).json()
    client.put(value["url"], content=DATA)
    with app.state.sessions.begin() as db:
        record = db.get(FileObject, value["id"])
        record.expires = time.time() - 86401
        reconcile_media(db, config)
        assert record.state == "deleted"
        with pytest.raises(FileNotFoundError):
            create_storage(config).get(record.staging_key)


def test_real_scanner_when_enabled():
    import os

    from school2036.config import Settings
    from school2036.media import scan_with_clamd

    if os.getenv("SCHOOL_TEST_SCANNER") != "1":
        pytest.skip("Set SCHOOL_TEST_SCANNER=1 with the local scanner running")
    config = Settings(_env_file=None, environment="test", scanner_host="127.0.0.1")
    scan_with_clamd(config, DATA)
    eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    with pytest.raises(ValueError, match="malware"):
        scan_with_clamd(config, eicar)
