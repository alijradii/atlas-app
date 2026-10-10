"""Private account controls; session identifiers never leave the server."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=15, max_length=128)

    @field_validator("current_password", "new_password")
    @classmethod
    def valid_unicode(cls, value):
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("Password must contain valid Unicode characters") from None
        return value


class AccountSessionView(BaseModel):
    current: bool
    created: float
    last_seen: float
    expires: float


class SessionRevokeView(BaseModel):
    revoked: int
