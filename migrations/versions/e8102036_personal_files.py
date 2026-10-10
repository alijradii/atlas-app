"""Add independent personal uploads without changing legacy records."""

import sqlalchemy as sa
from alembic import op

revision = "e8102036"
down_revision = "d740a19e2036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "personal_file",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner", sa.String(36), sa.ForeignKey("account.id"), nullable=False),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("expected_size", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("staging_key", sa.String(200), nullable=False, unique=True),
        sa.Column("final_key", sa.String(200), unique=True),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("error", sa.String(200), nullable=False),
        sa.Column("expires", sa.Float(), nullable=False),
    )
    op.create_index("ix_personal_file_owner", "personal_file", ["owner"])


def downgrade():
    raise RuntimeError("Preserve uploaded files; restore a verified backup instead")
