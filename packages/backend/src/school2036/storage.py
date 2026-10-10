from pathlib import Path, PurePosixPath
from typing import Protocol

import boto3
from botocore.config import Config

from school2036.config import Settings


def validate_key(key: str) -> None:
    parts = PurePosixPath(key).parts
    if not key or key.startswith("/") or ".." in parts or "\\" in key or "\x00" in key:
        raise ValueError("Invalid object key")


class ObjectStorage(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> None: ...
    def get(self, key: str, limit: int = 10 * 1024 * 1024) -> bytes: ...
    def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        validate_key(key)
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise ValueError("Object key escapes storage root")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str, limit: int = 10 * 1024 * 1024) -> bytes:
        with self._path(key).open("rb") as stream:
            data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Object exceeds the permitted size")
        return data

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class R2Storage:
    """Internal adapter only. Callers must authorize before storage/signing operations."""

    def __init__(self, settings: Settings):
        self.bucket = settings.r2_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.r2_secret_access_key.get_secret_value(),
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                connect_timeout=3,
                read_timeout=10,
                retries={"max_attempts": 2},
            ),
        )

    def put(self, key: str, data: bytes, content_type: str) -> None:
        validate_key(key)
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str, limit: int = 10 * 1024 * 1024) -> bytes:
        validate_key(key)
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        with response["Body"] as body:
            data = body.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Object exceeds the permitted size")
        return data

    def delete(self, key: str) -> None:
        validate_key(key)
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def sign_upload(self, key: str, content_type: str, expires: int = 300) -> str:
        validate_key(key)
        if not 1 <= expires <= 300:
            raise ValueError("Uploads must expire within five minutes")
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )

    def sign_download(self, key: str, expires: int = 60) -> str:
        validate_key(key)
        if not 1 <= expires <= 300:
            raise ValueError("Downloads must expire within five minutes")
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires,
        )


def create_storage(settings: Settings) -> ObjectStorage:
    if settings.storage_backend == "r2":
        return R2Storage(settings)
    return LocalStorage(settings.local_storage_path)
