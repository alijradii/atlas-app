"""Owned lesson transcripts, explicit reader grants and durable study conversations."""

import sqlalchemy as sa
from alembic import op

revision = "f9102036"
down_revision = "e8102036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "study_lesson",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("subject", sa.String(80), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("source_id", sa.String(128), unique=True),
        sa.Column("error", sa.String(200), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.create_index("ix_study_lesson_owner", "study_lesson", ["owner"])
    op.create_table(
        "study_access",
        sa.Column("lesson_id", sa.String(36), sa.ForeignKey("study_lesson.id"), primary_key=True),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("account.id"), primary_key=True),
    )
    op.create_table(
        "study_conversation",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("lesson_ids", sa.JSON(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_study_conversation_owner", "study_conversation", ["owner"])
    op.create_table(
        "study_message",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "conversation_id", sa.String(36), sa.ForeignKey("study_conversation.id"), nullable=False
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", sa.JSON(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.create_index("ix_study_message_conversation_id", "study_message", ["conversation_id"])
    op.create_table(
        "study_run",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "conversation_id", sa.String(36), sa.ForeignKey("study_conversation.id"), nullable=False
        ),
        sa.Column("message_id", sa.String(36), sa.ForeignKey("study_message.id"), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("session_hash", sa.String(64), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("error", sa.String(200), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.UniqueConstraint("conversation_id", "request_id"),
    )
    op.create_index("ix_study_run_conversation_id", "study_run", ["conversation_id"])


def downgrade():
    raise RuntimeError("Preserve study records; restore a verified backup instead")
