"""Create a durable singleton installation marker. No public setup mutations yet."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    table = op.create_table(
        "installation_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("initialized", sa.Boolean(), nullable=False),
        sa.CheckConstraint("id = 1", name="installation_singleton"),
    )
    op.bulk_insert(table, [{"id": 1, "initialized": False}])


def downgrade() -> None:
    raise RuntimeError(
        "Installation state cannot be discarded by downgrade; restore a verified backup"
    )
