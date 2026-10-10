from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    media_type: Literal[
        "text/plain",
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "video/mp4",
        "video/webm",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
    ]
    size: int = Field(ge=1, le=50 * 1024 * 1024)
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")

    @field_validator("filename")
    @classmethod
    def unicode_filename(cls, value):
        try:
            value.encode("utf-8")
        except UnicodeError:
            raise ValueError("Use valid Unicode characters in the filename") from None
        return value

    @model_validator(mode="after")
    def document_size(self):
        if not self.media_type.startswith(("audio/", "video/")) and self.size > 10 * 1024 * 1024:
            raise ValueError("Documents and images must be at most 10 MiB")
        return self


class UploadView(BaseModel):
    media_type: str
    id: str
    filename: str
    size: int
    state: Literal[
        "pending", "queued", "quarantined", "accepted", "rejected", "deleting", "deleted"
    ]
    url: str | None = None
    expires: float
    error: str = ""
