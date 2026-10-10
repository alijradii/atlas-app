"""Typed school workflows; all identity and relationship authority stays on the server."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from school2036.study_schemas import StudyInput

SchoolRole = Literal["student", "teacher", "advisor", "parent"]


class PublicationInput(StudyInput):
    lesson_id: UUID
    student_id: UUID


class PublicationView(BaseModel):
    id: str
    teacher_id: str
    student_id: str
    lesson_id: str
    title: str
    subject: str
    created: float


class AssignmentInput(StudyInput):
    student_id: UUID
    lesson_id: UUID | None = None
    title: str = Field(min_length=1, max_length=160)
    instructions: str = Field(min_length=1, max_length=8000)
    due_at: float | None = Field(default=None, ge=0, le=4102444800, allow_inf_nan=False)


class SubmissionInput(StudyInput):
    answer: str = Field(min_length=1, max_length=8000)


class FeedbackInput(StudyInput):
    feedback: str = Field(min_length=1, max_length=8000)
    return_for_revision: bool = False


class AssignmentView(BaseModel):
    id: str
    teacher_id: str
    student_id: str
    lesson_id: str | None
    title: str
    instructions: str
    due_at: float | None
    state: Literal["assigned", "submitted", "returned", "reviewed"]
    answer: str
    feedback: str
    created: float
    submitted_at: float | None


class AdvisorMessageInput(StudyInput):
    student_id: UUID
    advisor_id: UUID
    content: str = Field(min_length=1, max_length=4000)


class AdvisorMessageView(BaseModel):
    id: str
    student_id: str
    advisor_id: str
    sender_id: str
    content: str
    created: float


class ProposalEditInput(StudyInput):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=8000)


class ProposalInput(ProposalEditInput):
    student_id: UUID
    advisor_id: UUID
    parent_id: UUID | None = None


class ProposalReviewInput(StudyInput):
    decision: Literal["approve", "revise", "decline"]
    note: str = Field(min_length=1, max_length=4000)


class ProposalDecisionInput(StudyInput):
    decision: Literal["approve", "decline"]
    note: str = Field(min_length=1, max_length=4000)


class ProposalView(BaseModel):
    id: str
    student_id: str
    advisor_id: str
    parent_id: str | None
    title: str
    description: str
    state: Literal[
        "pending_advisor", "pending_parent", "approved", "declined", "revision_requested"
    ]
    advisor_note: str
    parent_note: str
    created: float
    updated: float


class SchoolPersonView(BaseModel):
    account_id: str
    name: str
    login: str
    relationship: SchoolRole
    student_ids: list[str] = Field(default_factory=list)
    responsibilities: list[Literal["teacher", "advisor", "parent"]] = Field(default_factory=list)


class SchoolWorkspace(BaseModel):
    account_id: str
    name: str
    roles: list[SchoolRole]
    people: list[SchoolPersonView]
    publications: list[PublicationView]
    assignments: list[AssignmentView]
    messages: list[AdvisorMessageView]
    proposals: list[ProposalView]
