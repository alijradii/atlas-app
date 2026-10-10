"""Student-reviewed reports share a bounded document, never a private conversation."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from school2036.study_schemas import StudyInput


class SchoolReportInput(StudyInput):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=8000)
    recipient_ids: list[UUID] = Field(min_length=1, max_length=30)
    conversation_id: UUID | None = None

    @field_validator("recipient_ids")
    @classmethod
    def unique_recipients(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Choose each recipient only once")
        return value


class SchoolReportView(BaseModel):
    id: str
    student_id: str
    student_name: str
    title: str
    body: str
    recipient_ids: list[str]
    conversation_id: str | None
    created: float


class SchoolReportDraft(BaseModel):
    title: str
    body: str
    conversation_id: str
    requires_review: Literal[True] = True


class ReportModelResponse(StudyInput):
    title: str = Field(min_length=1, max_length=160)
    student_quotes: list[str] = Field(min_length=1, max_length=5)
    ai_suggestions: list[str] = Field(max_length=5)
    next_steps: list[str] = Field(max_length=5)

    @field_validator("student_quotes", "ai_suggestions", "next_steps")
    @classmethod
    def bounded_statements(cls, values):
        for value in values:
            if not value.strip() or len(value) > 500:
                raise ValueError("Use short, nonempty statements")
            cls.database_text(value)
        return values
