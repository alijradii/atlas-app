"""Link study material to private uploads and distinguish extracted sources."""

import sqlalchemy as sa
from alembic import op

revision = "g0202036"
down_revision = "g0102036"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("study_lesson", sa.Column("file_id", sa.String(36), nullable=True))
    op.create_foreign_key("study_lesson_file", "study_lesson", "personal_file", ["file_id"], ["id"])
    op.add_column(
        "study_lesson",
        sa.Column("source_kind", sa.String(20), nullable=False, server_default="transcript"),
    )


def downgrade():
    op.drop_column("study_lesson", "source_kind")
    op.drop_constraint("study_lesson_file", "study_lesson", type_="foreignkey")
    op.drop_column("study_lesson", "file_id")
