from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudyInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("*")
    @classmethod
    def database_text(cls, value):
        # PostgreSQL text cannot store NUL or unpaired Unicode surrogates. Apply
        # this to string fields only: conversation scopes are lists of UUIDs.
        if isinstance(value, str):
            if "\x00" in value:
                raise ValueError("Text cannot contain a NUL character")
            try:
                value.encode("utf-8")
            except UnicodeError:
                raise ValueError("Text must contain valid Unicode characters") from None
        return value


class LessonInput(StudyInput):
    title: str = Field(min_length=1, max_length=160)
    subject: str = Field(default="", max_length=80)
    transcript: str = Field(min_length=30, max_length=45000)


class FileLessonInput(StudyInput):
    file_id: UUID
    title: str = Field(min_length=1, max_length=160)
    subject: str = Field(default="", max_length=80)


class TranscriptApproval(StudyInput):
    transcript: str = Field(min_length=30, max_length=45000)


class LessonView(BaseModel):
    id: str
    title: str
    subject: str
    state: Literal["queued", "extracting", "review", "indexing", "ready", "failed"]
    error: str
    created: float
    owned: bool
    source_kind: Literal["transcript", "document", "recording"] = "transcript"
    has_file: bool = False


class LessonDetail(LessonView):
    transcript: str


class AccessInput(StudyInput):
    login: str = Field(min_length=1, max_length=100)


class AccessView(BaseModel):
    account_id: str
    login: str
    name: str


class ConversationInput(StudyInput):
    lesson_ids: list[UUID] = Field(min_length=1, max_length=8)


class ConversationView(BaseModel):
    id: str
    title: str
    lesson_ids: list[str]
    created: float
    updated: float


class MessageInput(StudyInput):
    content: str = Field(min_length=1, max_length=2000)
    request_id: UUID

    @field_validator("content")
    @classmethod
    def embedding_limit(cls, value):
        if len(value.encode()) > 2000:
            raise ValueError("Please shorten your question to 2,000 UTF-8 bytes")
        return value


class CitationView(BaseModel):
    index: int
    lesson_id: str
    title: str
    quote: str
    location: str


class MessageView(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created: float
    citations: list[CitationView]


class RunView(BaseModel):
    id: str
    state: Literal["queued", "retrieving", "answering", "completed", "failed", "cancelled"]
    error: str


class ConversationDetail(ConversationView):
    messages: list[MessageView]
    run: RunView | None


class StudyStatus(BaseModel):
    rag_configured: bool
    answer_configured: bool
