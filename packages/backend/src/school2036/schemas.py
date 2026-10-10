from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    login: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class SessionView(BaseModel):
    csrf: str
    account_id: str
    login: str
    name: str
    kind: Literal["user"]


class UploadInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filename: str = Field(min_length=1, max_length=200, pattern=r"^[^/\\\x00-\x1f]+$")
    media_type: Literal["text/plain", "application/pdf", "image/png", "image/jpeg"]
    size: int = Field(ge=1, le=10 * 1024 * 1024)
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")


class UploadView(BaseModel):
    id: str
    filename: str
    size: int
    state: Literal[
        "pending", "queued", "quarantined", "accepted", "rejected", "deleting", "deleted"
    ]
    url: str | None = None
    expires: float
    error: str = ""
