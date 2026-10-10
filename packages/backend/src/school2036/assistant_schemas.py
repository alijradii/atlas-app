"""Bounded public contract; clients cannot provide roles, selectors, credentials or tools."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=2000)
    screen: str = Field(default="/workspace", max_length=100)
    history: list[AssistantTurn] = Field(default_factory=list, max_length=8)

    @field_validator("message")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a question")
        return value.strip()


class GuidanceView(BaseModel):
    route: str
    anchor: str
    title: str
    description: str


class AssistantView(BaseModel):
    answer: str
    guidance: GuidanceView | None = None
    suggestions: list[str] = Field(default_factory=list)


class ModelAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(min_length=1, max_length=4000)
    target: str | None = Field(default=None, max_length=40)
    suggestions: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("suggestions")
    @classmethod
    def short_suggestions(cls, values: list[str]) -> list[str]:
        if any(not value.strip() or len(value) > 160 for value in values):
            raise ValueError("Invalid suggestions")
        return values
