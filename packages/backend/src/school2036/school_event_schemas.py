"""Calendar payloads use explicit offsets; browser-local times are never guessed."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator

from school2036.study_schemas import StudyInput


class EventFields(StudyInput):
    @field_validator("starts_at", "ends_at", check_fields=False)
    @classmethod
    def utc_time(cls, value):
        if value is None:
            return value
        if not 2000 <= value.year <= 2100:
            raise ValueError("Choose a date between 2000 and 2100")
        return value.astimezone(UTC)

    @field_validator("student_ids", check_fields=False)
    @classmethod
    def unique_students(cls, value):
        if value is not None and len(value) != len(set(value)):
            raise ValueError("Select each student only once")
        return value

    @model_validator(mode="after")
    def chronological(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        return self


class SchoolEventInput(EventFields):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=4000)
    location: str = Field(default="", max_length=200)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    student_ids: list[UUID] = Field(min_length=1, max_length=100)


class SchoolEventEdit(EventFields):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, max_length=200)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    student_ids: list[UUID] | None = Field(default=None, min_length=1, max_length=100)
    state: Literal["scheduled", "cancelled"] | None = None

    @model_validator(mode="after")
    def nonempty_patch(self):
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Provide at least one field; event fields cannot be null")
        return self


class SchoolEventView(BaseModel):
    id: str
    teacher_id: str
    organizer_name: str
    title: str
    description: str
    location: str
    starts_at: datetime
    ends_at: datetime
    state: Literal["scheduled", "cancelled"]
    student_ids: list[str]
    can_manage: bool
    created: float
    updated: float
