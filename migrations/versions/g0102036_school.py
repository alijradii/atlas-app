"""Explicit school responsibilities and human-owned learning workflows."""

import sqlalchemy as sa
from alembic import op

revision = "g0102036"
down_revision = "f9102036"
branch_labels = None
depends_on = None


def account(name, *, nullable=False, primary_key=False):
    return sa.Column(
        name, sa.String(36), sa.ForeignKey("account.id"), nullable=nullable, primary_key=primary_key
    )


def upgrade():
    op.create_table(
        "school_relationship",
        account("staff_id", primary_key=True),
        account("student_id", primary_key=True),
        sa.Column("kind", sa.String(16), primary_key=True),
        sa.CheckConstraint("staff_id <> student_id", name="school_relationship_not_self"),
        sa.CheckConstraint(
            "kind IN ('teacher', 'advisor', 'parent')", name="school_relationship_kind"
        ),
    )
    op.create_table(
        "school_publication",
        sa.Column("id", sa.String(36), primary_key=True),
        account("teacher_id"),
        account("student_id"),
        sa.Column("lesson_id", sa.String(36), sa.ForeignKey("study_lesson.id"), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.UniqueConstraint("teacher_id", "student_id", "lesson_id"),
    )
    op.create_table(
        "school_assignment",
        sa.Column("id", sa.String(36), primary_key=True),
        account("teacher_id"),
        account("student_id"),
        sa.Column("lesson_id", sa.String(36), sa.ForeignKey("study_lesson.id")),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("due_at", sa.Float()),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("submitted_at", sa.Float()),
        sa.CheckConstraint(
            "state IN ('assigned', 'submitted', 'returned', 'reviewed')",
            name="school_assignment_state",
        ),
    )
    op.create_table(
        "school_message",
        sa.Column("id", sa.String(36), primary_key=True),
        account("student_id"),
        account("advisor_id"),
        account("sender_id"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.create_table(
        "school_proposal",
        sa.Column("id", sa.String(36), primary_key=True),
        account("student_id"),
        account("advisor_id"),
        account("parent_id", nullable=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("advisor_note", sa.Text(), nullable=False),
        sa.Column("parent_note", sa.Text(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.CheckConstraint(
            "state IN ('pending_advisor', 'pending_parent', 'approved', 'declined', "
            "'revision_requested')",
            name="school_proposal_state",
        ),
    )
    for table, columns in {
        "school_relationship": ("student_id",),
        "school_publication": ("teacher_id", "student_id"),
        "school_assignment": ("teacher_id", "student_id"),
        "school_message": ("student_id", "advisor_id"),
        "school_proposal": ("student_id", "advisor_id", "parent_id"),
    }.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    raise RuntimeError("Preserve learning records; restore a verified backup instead")
