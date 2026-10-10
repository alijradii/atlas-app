"""Teacher-owned events with an explicit, revocable student audience."""

import sqlalchemy as sa
from alembic import op

revision = "g0302036"
down_revision = "g0202036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "school_event",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("teacher_id", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.CheckConstraint("ends_at > starts_at", name="school_event_chronological"),
        sa.CheckConstraint("state IN ('scheduled', 'cancelled')", name="school_event_state"),
    )
    op.create_index("ix_school_event_teacher_id", "school_event", ["teacher_id"])
    op.create_index("ix_school_event_starts_at", "school_event", ["starts_at"])
    op.create_table(
        "school_event_student",
        sa.Column("event_id", sa.String(36), sa.ForeignKey("school_event.id"), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
    )
    op.create_index("ix_school_event_student_student_id", "school_event_student", ["student_id"])


def downgrade():
    raise RuntimeError("Preserve event records; restore a verified backup instead")
