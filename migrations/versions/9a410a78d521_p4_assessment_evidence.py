"""P4 immutable rubric editions and evidence history."""

import sqlalchemy as sa
from alembic import op

revision = "9a410a78d521"
down_revision = "d1d264e28e1d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "submission_version",
        sa.Column("declared_assistance", sa.String(20), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "submission_version",
        sa.Column("assistance_declaration", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("submission_version", "declared_assistance", server_default=None)
    op.alter_column("submission_version", "assistance_declaration", server_default=None)
    op.create_table(
        "assessment_rubric",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "course_id", sa.String(36), sa.ForeignKey("academic_structure.id"), nullable=False
        ),
    )
    op.create_index("ix_assessment_rubric_course_id", "assessment_rubric", ["course_id"])
    op.create_table(
        "rubric_version",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "rubric_id", sa.String(36), sa.ForeignKey("assessment_rubric.id"), nullable=False
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("actor", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("at", sa.Float(), nullable=False),
        sa.UniqueConstraint("rubric_id", "revision"),
    )
    op.create_index("ix_rubric_version_rubric_id", "rubric_version", ["rubric_id"])
    op.create_table(
        "evidence_version",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "submission_id", sa.String(36), sa.ForeignKey("submission_version.id"), nullable=False
        ),
        sa.Column(
            "rubric_version_id", sa.String(36), sa.ForeignKey("rubric_version.id"), nullable=False
        ),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("judgments", sa.JSON(), nullable=False),
        sa.Column("observed_assistance", sa.String(20), nullable=False),
        sa.Column("assistance_note", sa.Text(), nullable=False),
        sa.Column("accommodations", sa.Text(), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column("uncertainty", sa.Text(), nullable=False),
        sa.Column("next_steps", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("actor", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("at", sa.Float(), nullable=False),
        sa.UniqueConstraint("submission_id", "revision"),
    )
    op.create_index("ix_evidence_version_submission_id", "evidence_version", ["submission_id"])


def downgrade():
    op.drop_table("evidence_version")
    op.drop_table("rubric_version")
    op.drop_table("assessment_rubric")
    op.drop_column("submission_version", "assistance_declaration")
    op.drop_column("submission_version", "declared_assistance")
