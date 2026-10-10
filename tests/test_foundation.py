from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from school2036.config import Settings
from school2036.storage import LocalStorage
from school_api.main import create_app
from sqlalchemy.exc import OperationalError


def test_liveness_does_not_require_database():
    with TestClient(create_app(Settings(_env_file=None, environment="test"))) as client:
        assert client.get("/api/v1/health/live").json() == {"status": "ok", "version": "0.1.0"}


def test_database_failure_never_opens_setup():
    with patch(
        "sqlalchemy.orm.Session.get", side_effect=OperationalError("", {}, Exception("secret"))
    ):
        with TestClient(create_app(Settings(_env_file=None, environment="test"))) as client:
            response = client.get("/api/v1/setup/status")
            assert response.status_code == 503
            assert "setup_required" not in response.text
            assert "secret" not in response.text


def test_missing_marker_requires_recovery():
    with patch("sqlalchemy.orm.Session.get", return_value=None):
        with TestClient(create_app(Settings(_env_file=None, environment="test"))) as client:
            assert client.get("/api/v1/setup/status").status_code == 503


def test_production_rejects_development_defaults():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="production")


def test_r2_requires_credentials():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, storage_backend="r2")


@pytest.mark.parametrize("key", ["../secret", "/etc/passwd", "safe/../../secret", "bad\\key", "."])
def test_storage_rejects_escape(tmp_path: Path, key: str):
    with pytest.raises(ValueError):
        LocalStorage(tmp_path).put(key, b"test", "text/plain")


def test_storage_rejects_symlink_escape(tmp_path: Path):
    root = tmp_path / "media"
    root.mkdir()
    (root / "escape").symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError):
        LocalStorage(root).put("escape/private.txt", b"test", "text/plain")


def test_local_storage_roundtrip(tmp_path: Path):
    storage = LocalStorage(tmp_path)
    storage.put("resources/one.txt", b"lesson", "text/plain")
    assert storage.get("resources/one.txt") == b"lesson"
    storage.delete("resources/one.txt")
    with pytest.raises(FileNotFoundError):
        storage.get("resources/one.txt")


def test_r2_signing_is_bounded_and_upload_content_type_is_signed():
    from school2036.storage import R2Storage

    with patch("school2036.storage.boto3.client") as client:
        storage = R2Storage(
            Settings(
                _env_file=None,
                storage_backend="r2",
                r2_account_id="test-account",
                r2_bucket="private-test-bucket",
                r2_access_key_id="test-access",
                r2_secret_access_key="test-secret",
            )
        )
        storage.sign_upload("staging/test", "text/plain")
        client.return_value.generate_presigned_url.assert_called_with(
            "put_object",
            Params={
                "Bucket": "private-test-bucket",
                "Key": "staging/test",
                "ContentType": "text/plain",
            },
            ExpiresIn=300,
        )
        for expires in [0, -1, 301]:
            with pytest.raises(ValueError):
                storage.sign_upload("staging/test", "text/plain", expires)
            with pytest.raises(ValueError):
                storage.sign_download("objects/test", expires)
