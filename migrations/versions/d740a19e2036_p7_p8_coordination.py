"""P7 timetable proposal snapshots and P8 individual project evidence."""

import sqlalchemy as sa
from alembic import op

revision = "d740a19e2036"
down_revision = "c63a2048e912"
branch_labels = None
depends_on = None


def identity():
    return [
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
    ]


def ref(name, target, nullable=False):
    return sa.Column(name, sa.String(36), sa.ForeignKey(target), nullable=nullable)


def upgrade():
    op.create_table(
        "schedule_proposal",
        *identity(),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        ref("actor", "account.id"),
        ref("decided_by", "account.id", True),
        sa.Column("decision", sa.String(500), nullable=False),
        sa.Column("at", sa.Float(), nullable=False),
    )
    op.create_table(
        "learning_project",
        *identity(),
        ref("course_id", "academic_structure.id"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("brief", sa.JSON(), nullable=False),
        sa.Column("shared_outcome", sa.Text(), nullable=False),
        ref("actor", "account.id"),
    )
    op.create_index("ix_learning_project_course_id", "learning_project", ["course_id"])
    op.create_table(
        "project_contribution",
        *identity(),
        ref("project_id", "learning_project.id"),
        ref("student_id", "person.id"),
        sa.Column("milestone", sa.String(40), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("assistance", sa.String(30), nullable=False),
        sa.Column("at", sa.Float(), nullable=False),
        sa.UniqueConstraint("project_id", "student_id", "milestone", "revision"),
    )
    op.create_index("ix_project_contribution_project_id", "project_contribution", ["project_id"])
    op.create_table(
        "project_review",
        *identity(),
        ref("contribution_id", "project_contribution.id"),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column("understanding", sa.Text(), nullable=False),
        ref("actor", "account.id"),
        sa.Column("at", sa.Float(), nullable=False),
        sa.UniqueConstraint("contribution_id", "revision"),
    )
    op.create_index("ix_project_review_contribution_id", "project_review", ["contribution_id"])


def downgrade():
    for table in [
        "project_review",
        "project_contribution",
        "learning_project",
        "schedule_proposal",
    ]:
        op.drop_table(table)
