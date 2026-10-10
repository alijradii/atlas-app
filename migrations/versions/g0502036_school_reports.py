"""Explicitly shared student reports, separate from private conversations."""

import sqlalchemy as sa
from alembic import op

revision = "g0502036"
down_revision = "g0402036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "school_report",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("study_conversation.id")),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.create_index("ix_school_report_student_id", "school_report", ["student_id"])
    op.create_table(
        "school_report_recipient",
        sa.Column("report_id", sa.String(36), sa.ForeignKey("school_report.id"), primary_key=True),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
    )
    op.create_index(
        "ix_school_report_recipient_account_id", "school_report_recipient", ["account_id"]
    )


def downgrade():
    raise RuntimeError("Preserve explicitly shared reports; restore a verified backup instead")
