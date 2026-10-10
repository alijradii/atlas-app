"""School responsibility and access checks shared by routes and operator commands."""

from fastapi import HTTPException
from sqlalchemy import cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import aliased

from school2036.models import Account, SchoolPublication, SchoolRelationship

ROLES = frozenset({"student", "teacher", "advisor", "parent"})
STAFF_ROLES = ROLES - {"student"}


def role(user, kind):
    if kind not in user.roles:
        raise HTTPException(403, "Your account does not have this role")


def valid_relationships():
    """A saved link is ineffective if either account is disabled or loses its role."""
    staff, student = aliased(Account), aliased(Account)
    return (
        select(SchoolRelationship)
        .join(staff, staff.id == SchoolRelationship.staff_id)
        .join(student, student.id == SchoolRelationship.student_id)
        .where(
            staff.status == "active",
            student.status == "active",
            cast(student.roles, JSONB).contains(["student"]),
            cast(staff.roles, JSONB).op("?")(SchoolRelationship.kind),
        )
    )


def relationship_exists(staff_id, student_id, kind):
    return (
        valid_relationships()
        .where(
            SchoolRelationship.staff_id == staff_id,
            SchoolRelationship.student_id == student_id,
            SchoolRelationship.kind == kind,
        )
        .exists()
    )


def related(db, staff_id, student_id, kind):
    return db.scalar(select(relationship_exists(staff_id, student_id, kind)))


def require_relationship(db, staff_id, student_id, kind):
    if not related(db, staff_id, student_id, kind):
        raise HTTPException(404, "This student relationship is not available")


def published_lessons(account_id):
    teachers = (
        valid_relationships()
        .with_only_columns(SchoolRelationship.staff_id)
        .where(SchoolRelationship.kind == "teacher", SchoolRelationship.student_id == account_id)
    )
    return select(SchoolPublication.lesson_id).where(
        SchoolPublication.student_id == account_id,
        SchoolPublication.teacher_id.in_(teachers),
    )


def record_view(record, schema):
    return {field: getattr(record, field) for field in schema.model_fields}
