"""Opted-in peer topics and teacher-reviewed activity requests."""

import sqlalchemy as sa
from alembic import op

revision = "g0402036"
down_revision = "g0302036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "activity_interest",
        sa.Column("teacher_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
        sa.Column("topic", sa.String(80), primary_key=True),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.create_table(
        "activity_request",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("teacher_id", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("creator_id", sa.String(36), sa.ForeignKey("account.id")),
        sa.Column("topic", sa.String(80), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("teacher_note", sa.Text(), nullable=False),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("school_event.id")),
        sa.Column("evidence_count", sa.Integer(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.CheckConstraint("source IN ('student', 'ai')", name="activity_request_source"),
        sa.CheckConstraint(
            "state IN ('pending', 'accepted', 'declined')", name="activity_request_state"
        ),
        sa.CheckConstraint("evidence_count >= 0", name="activity_request_evidence"),
    )
    op.create_index("ix_activity_request_teacher_id", "activity_request", ["teacher_id"])
    op.create_table(
        "activity_participant",
        sa.Column(
            "request_id", sa.String(36), sa.ForeignKey("activity_request.id"), primary_key=True
        ),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
    )
    op.create_index("ix_activity_participant_student_id", "activity_participant", ["student_id"])


def downgrade():
    raise RuntimeError("Preserve activity requests; restore a verified backup instead")
