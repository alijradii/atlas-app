"""Explicit, teacher-scoped peer interests and reviewed activity requests."""

import unicodedata
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from school2036.study_schemas import StudyInput


class TopicInput(StudyInput):
    topic: str = Field(min_length=2, max_length=80)

    @field_validator("topic")
    @classmethod
    def normalize_topic(cls, value):
        value = " ".join(unicodedata.normalize("NFKC", value).casefold().split())
        if not 2 <= len(value) <= 80:
            raise ValueError("Use a topic between 2 and 80 characters")
        return value


class ActivityInterestInput(TopicInput):
    teacher_id: UUID
    interested: bool


class ActivityRequestInput(TopicInput):
    teacher_id: UUID
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)


class ActivityJoinInput(StudyInput):
    interested: bool


class ActivityReviewInput(StudyInput):
    state: Literal["accepted", "declined"]
    teacher_note: str = Field(default="", max_length=2000)
    event_id: UUID | None = None

    @model_validator(mode="after")
    def accepted_event(self):
        if self.state == "accepted" and self.event_id is None:
            raise ValueError("Create an event before accepting the request")
        if self.state == "declined" and self.event_id is not None:
            raise ValueError("A declined request cannot have an event")
        return self


class ActivitySuggestionInput(TopicInput):
    pass


class ActivitySuggestionText(StudyInput):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)


class ActivityInterestView(BaseModel):
    teacher_id: str
    organizer_name: str
    topic: str
    interested_count: int
    joined: bool
    can_suggest: bool


class ActivityRequestView(BaseModel):
    id: str
    teacher_id: str
    organizer_name: str
    title: str
    description: str
    topic: str
    source: Literal["student", "ai"]
    state: Literal["pending", "accepted", "declined"]
    teacher_note: str
    event_id: str | None
    interested_count: int
    joined: bool
    participant_ids: list[str]
    evidence_count: int
    can_manage: bool
    can_join: bool
    created: float
    updated: float
