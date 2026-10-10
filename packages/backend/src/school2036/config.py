from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SCHOOL_", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr = SecretStr(
        "postgresql+psycopg://school:school@127.0.0.1:5432/school2036"
    )
    redis_url: SecretStr = SecretStr("redis://127.0.0.1:6379/0")
    storage_backend: Literal["local", "r2"] = "local"
    local_storage_path: Path = Path(".data/media")
    public_origin: str = "http://localhost:3000"
    installation_marker: Path = Path(".data/installation.json")
    encryption_key_file: Path = Path(".data/identity.key")
    scanner_host: str = ""
    scanner_port: int = 3310
    media_quota_bytes: int = 500 * 1024 * 1024
    r2_account_id: str = ""
    r2_bucket: str = ""
    r2_access_key_id: SecretStr = SecretStr("")
    r2_secret_access_key: SecretStr = SecretStr("")

    rag_url: str = "http://127.0.0.1:8081"
    rag_api_key: SecretStr = SecretStr("")
    gemini_api_key: SecretStr = SecretStr("")
    study_model: str = "gemini-2.5-flash"
    study_daily_requests: int = 50

    @property
    def session_cookie(self) -> str:
        return "__Host-school_session" if self.environment == "production" else "school_session"

    @model_validator(mode="after")
    def validate_deployment(self) -> Settings:
        if self.storage_backend == "r2" and not all(
            [
                self.r2_account_id,
                self.r2_bucket,
                self.r2_access_key_id.get_secret_value(),
                self.r2_secret_access_key.get_secret_value(),
            ]
        ):
            raise ValueError(
                "R2 requires account, bucket, access key, and secret key configuration"
            )
        if self.environment == "production":
            if not self.public_origin.startswith("https://"):
                raise ValueError("Production requires an HTTPS public origin")
            from sqlalchemy.engine import make_url

            url = make_url(self.database_url.get_secret_value())
            if not url.password or len(url.password) < 24 or "REPLACE" in url.password:
                raise ValueError(
                    "Production requires a unique database password of at least 24 characters"
                )
            if any(
                "REPLACE" in value
                for value in [
                    self.r2_account_id,
                    self.r2_bucket,
                    self.r2_access_key_id.get_secret_value(),
                    self.r2_secret_access_key.get_secret_value(),
                ]
            ):
                raise ValueError("Replace all example R2 credentials before production")
            if not self.scanner_host:
                raise ValueError("Production requires a private upload scanner")
            if self.storage_backend != "r2":
                raise ValueError("Production media must use private R2 storage")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
