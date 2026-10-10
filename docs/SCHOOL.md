# School workspaces

`/workspace` is the authenticated, persisted school workspace. The role layouts under `/preview/*` remain demonstrations. This minimal workflow does not implement a student information system, enrollment import, institutional grading rules or automated school decisions.

Both use the same Pearl frame and Home presentation. Real Home shows only tasks
returned for the signed-in account. Schoolwork, Lessons, advisor conversations and
plans are reached through the sidebar. Section navigation refreshes current records
and permissions; a page that was already open does not retain a stale home snapshot.
Files & recordings and Study with agent remain in the same frame for every account.

Use the app from home or school. Authentication, an active account, explicit roles and explicit student relationships determine access. A school LAN or IP address does not grant authority.

## Provision accounts and responsibilities

Provision accounts with the existing local operator command, then assign roles. No browser endpoint grants roles or links families, teachers or advisors. Commands below run from the repository root with the configured private environment:

```bash
uv run --frozen python -m school2036.operator create-user --login student-login --name "Student Name"
uv run --frozen python -m school2036.operator set-roles --login student-login --roles student
uv run --frozen python -m school2036.operator set-roles --login teacher-login --roles teacher
uv run --frozen python -m school2036.operator set-relationship --staff teacher-login --student student-login --kind teacher
uv run --frozen python -m school2036.operator set-relationship --staff advisor-login --student student-login --kind advisor
uv run --frozen python -m school2036.operator set-relationship --staff parent-login --student student-login --kind parent
```

The teacher, advisor and parent accounts must already exist with their respective roles. Multiple roles are allowed. `set-roles` replaces the complete role list and invalidates that account's sessions. An empty `--roles` removes all school roles. Losing a role removes its relationships; granting the role again does not restore old authority.

Add `--remove` to `set-relationship` to revoke a relationship. Every school request and every retrieval of a published lesson rechecks active roles, accounts and relationships. Historical records stay in the database; former participants lose access. Renewing a relationship explicitly makes its records available again. Relationship changes are audited. There is no self-service role escalation.

## Working flows

- **Teacher:** prepare an owned lesson in Study, publish the ready lesson to an assigned student, create a practice assignment with optional lesson and due date, review the student's submission or return it for revision. Attaching a lesson to an assignment publishes it in the same database transaction.
- **Student:** access published lessons in Study, submit assigned work, read feedback and resubmit returned work, message the assigned advisor, propose a learning plan and revise it when requested.
- **Advisor:** exchange private messages with assigned students; create plans or review student proposals. Approve, decline or ask the student to revise. Advisor messages are visible only to that student and advisor, not parents or teachers.
- **Parent:** read the linked student's assignments, submissions and feedback; review proposals explicitly addressed to that parent after advisor approval. Parents cannot submit student work, review as the teacher or read private advisor messages.

If a student has an active parent relationship, a proposal must name one of those parents. Omitting the parent cannot bypass approval. A student without a parent relationship can finish the proposal through advisor approval. Revoking a designated parent or advisor relationship hides that proposal from its workflow until the operator resolves the relationship; there is not yet a reassignment screen.

Published lesson access is independent of personal sharing grants. Unpublishing removes only the publication grant. A separate manual Study sharing grant still authorizes that reader. Publication or relationship revocation also applies to Study conversation history and future source retrieval; previously copied content cannot be recalled. Parents do not automatically receive transcript access.

## API and limits

All endpoints use existing session, Origin and CSRF protection. Responses are `no-store`; clients should revalidate when returning to a tab. Roles and current responsibilities come from `/api/v1/school/workspace`, never browser storage.

| Endpoint under `/api/v1/school` | Purpose |
| --- | --- |
| `GET /workspace` | Current roles, related people and authorized records |
| `POST /publications`, `DELETE /publications/{id}` | Publish or revoke an owned ready lesson |
| `POST /assignments` | Assign practice to an explicitly linked student |
| `POST /assignments/{id}/submit` | Student submission; only assigned or returned work |
| `POST /assignments/{id}/feedback` | Assigning teacher's review; only submitted work |
| `POST /messages` | Student/advisor message |
| `POST /proposals`, `PUT /proposals/{id}` | Create or revise a learning proposal |
| `POST /proposals/{id}/review` | Assigned advisor's decision |
| `POST /proposals/{id}/decision` | Designated parent's decision |

Workspace lists return up to 500 publications, the 200 most recent assignments, the 200 most recent messages across that user's advisor conversations, and the 200 most recently updated proposals. Persisted older messages are not yet paginated in the UI. Creation caps are 500 publications and 200 assignments per teacher, 100 proposals per student, and 100 advisor messages per sender per day. Text limits are enforced on both browser and backend. These are bounded initial-workspace limits, not a bulk enrollment or archival system.

All changes share the authenticated installation lock with existing identity and study authorization, so a simultaneous relationship revocation cannot race a successful mutation. Database check constraints protect workflow states. Publication grants use correlated SQL checks and workspace contacts are bulk-loaded; authorization does not issue one query per assignment. A regression checks query count with 30 assignments.

## Tests and remaining scope

`tests/test_school.py` covers session/CSRF guards, absent browser role mutation, ownership and publication state, source/history revocation, separate sharing grants, teacher/student submission states, private advisor messaging, ordered parent approval, revision, relationship and role loss, disabled accounts, multi-role contacts, operator validation and bounded workspace query count. Browser tests exercise the actual role screens against disposable PostgreSQL fixtures.

The workflow intentionally keeps human decisions with the responsible student, teacher, advisor and parent. No AI-generated grades, automatic approvals or outbound notifications are implied. Live institutional enrollment, formal gradebooks, self-service account recovery/invitations, message pagination, bulk administration, proposal reassignment and comprehensive archive/retention controls remain separate work. Production release blockers recorded in `SECURITY.md` and `release-status.json` still apply.
