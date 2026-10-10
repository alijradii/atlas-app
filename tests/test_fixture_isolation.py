"""The shared harness must never inherit a developer's live object storage."""

from unittest.mock import patch

from test_identity import login
from test_media import DATA, upload


def test_fixture_ignores_external_storage_and_scanner_environment(monkeypatch, request):
    monkeypatch.setenv("SCHOOL_STORAGE_BACKEND", "r2")
    monkeypatch.setenv("SCHOOL_SCANNER_HOST", "scanner.example.invalid")
    monkeypatch.setenv("SCHOOL_MEDIA_QUOTA_BYTES", "1")
    # Deliberately omit R2 credentials: isolated settings must not require them.
    for name in ["ACCOUNT_ID", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"]:
        monkeypatch.delenv("SCHOOL_R2_" + name, raising=False)
    with (
        patch("school2036.storage.boto3.client") as external_storage,
        patch("school2036.media.scan_with_clamd") as external_scanner,
    ):
        client, _, config = request.getfixturevalue("system")
        assert config.storage_backend == "local"
        assert config.scanner_host == ""
        assert config.media_quota_bytes == 100 * 1024 * 1024
        login(client)
        value = upload(client)
        assert value["state"] == "accepted"
        assert client.get(f"/api/v1/files/{value['id']}/download").content == DATA
        external_storage.assert_not_called()
        external_scanner.assert_not_called()
