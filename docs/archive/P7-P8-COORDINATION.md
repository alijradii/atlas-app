> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P7 / P8 initial integrated slices

Updated October 9, 2026. These phases are **in progress**, not completed or approved for production. The full plan remains authoritative. This increment begins both phases without removing their remaining scope or clearing earlier release gates.

## P7: review room and teacher changes

The **Timetable proposals** workspace lets school managers assemble up to 30 changes to published future lessons. A proposal keeps each lesson's group and times fixed, preserving its existing instructional coverage and all advisory memberships. Replacement teachers need an effective teaching assignment. A new room must be active. An administrator can approve or reject a proposal with a reason.

Every proposed change stores the exact previous lesson and revision. The review screen shows before/after rooms and teachers, affected people and current conflicts. A proposal does not alter the live timetable. Approval rechecks all current data, including lesson revisions, attendance, staff assignments and weekday availability, academic calendars, room capacity/reservations, overlapping students and published support slots. Batch validation considers the final candidate schedule, so atomic room swaps are possible without ignoring conflicts between candidates. A failed approval leaves every lesson and notice unchanged.

The shared Python checker also serves existing manual timetable writes. Successful approval updates all affected lessons and creates course-scoped in-app notices in the same transaction. Existing announcement reads enforce current audience/guardian permissions. There is no external email or push delivery. Proposal approval is revision protected; retries cannot create duplicate notices. Rejection leaves the published schedule untouched. Approved snapshots remain available for review; restoring an earlier room/teacher arrangement requires a new, currently validated proposal.

This is manual proposal preparation. `valid` and `conflicts` describe the deterministic check, **not solver feasibility**. No solver execution, optimality or timeout handling is claimed.

Requirement coverage: partial SCH-02/04/05/06 and ADM-11; existing P2 reservations and P5 support appointments remain integrated. SCH-03, the advanced portions of SCH-02/06, OPS-03 and STU-18 remain outstanding.

Next P7 increments, retained in scope:

1. Versioned hard/soft constraint policies, qualifications, detailed availability, accessibility, equipment, travel/breaks and explicit school-day supervision requirements.
2. Bounded dedicated solver workers, cancellation/backpressure, weighted alternatives and distinct feasible/infeasible/timed-out/unknown outcomes; measured interactive-service isolation (AT-20/29).
3. Stable planning windows with time/group changes, learning-plan/support demand integration, temporary assignments, waitlists, capacity escalation and more targeted notices.
4. Approved-device offline draft synchronization, protected local caches, expiry, conflict resolution and current authorization on sync (AT-21). No offline draft cache is introduced by this increment.

## P8: shared projects and individual understanding

The **Projects** workspace is available to teachers and students. An assigned course teacher creates and revises a draft brief containing a driving question, active learning outcomes, team members and responsibilities, dated milestones, individual evidence requirements, resource notes and a budget in explicitly labeled minor currency units. Each team member must be an active student in that course. Launch rechecks the roster and freezes the brief. Draft revisions are recorded in the audit history; launched projects retain the exact brief.

Only assigned teachers and current team members can open an active project. A project is one course-scoped team in this increment. Students submit their own textual contributions for a milestone, declaring independent, peer-assisted, tool-assisted or collaborative work. Each edition is immutable and revision checked; resubmission preserves earlier work. Individual explanations and teacher reviews are visible only to that student and assigned teachers, not peers, unrelated teachers, guardians or administrators without a teaching assignment. Current membership is checked on every request.

Teachers return or verify an exact contribution edition, recording feedback and observed individual understanding. Reviews are append-only, revision checked and cannot target a superseded contribution. A new student edition requires a new review. Completion requires a shared-outcome narrative and a verified latest contribution from every team member for every milestone. Project verification is not a P4 grade, mastery decision or qualification. Completed projects remain readable and reject further contributions/reviews.

Requirement coverage: initial PRJ-01, textual versioned contribution portion of PRJ-02, individual understanding portion of TCH-09/17 and project portion of STU-14. Budgets are planning metadata, not spending approvals or accounting. Resource notes do not make reservations.

Next P8 increments, retained in scope:

1. File-backed collaboration, shared artifacts, multiple teams, explicit studio/equipment bookings, physical demonstrations and P4 evidence/rubric integration; reviewed post-launch amendments and reopening/correction procedures.
2. Mentor onboarding, institution/host approval, time-limited assignments and expiry checks across pages/files/messages/exports (AT-22); placements/trips, supervision and guardian permissions (PRJ-03, PAR-08, ADM-12, STF-12).
3. Opportunity sources, verification dates, stale flags, requirements/cost/support and applications (PRJ-04/STU-15).
4. Selective portfolios, exhibitions, granular student-work permissions and explicit public-publication approval (PRJ-05). No public publication or mentor role is enabled here.
5. Student proposals, consultations, council decisions, visible institutional responses and optional participatory budgets (PRJ-06/STU-16).

## Engineering and validation

Backend: `school2036/scheduling.py`, `projects.py`, `coordination_models.py`, `coordination_schemas.py`; API: `school_api/coordination_routes.py`; UI: `school/{scheduling,projects}.tsx`. Migration `d740a19e2036` follows P6 and creates proposal, project, contribution and review tables with foreign keys and unique edition constraints. OpenAPI and TypeScript contracts are regenerated. No dependencies or lockfile versions changed for this increment.

All new routes reuse installed-state, active-session, password authentication, CSRF and origin checks. The existing school transaction lock serializes mutations; database uniqueness also protects contribution/review editions. This is not evidence of deployment-scale throughput. Records participate in the existing PostgreSQL encrypted backup; the populated restore drill covers an approved proposal and reviewed project contribution. No new media store, notification worker or external processing is introduced.

`tests/test_coordination.py` covers atomic room swaps, conflict rechecking, preserved support capacity, rejected time changes, unassigned substitutes, unchanged published data on failure, stale proposals, notice visibility/idempotency, draft and object privacy, revoked membership, separate peer evidence, immutable resubmissions, verification requirements and concurrent submission conflicts. `tests/browser/coordination-flow.ts` covers administrator proposal approval and teacher/student project creation through completion, with automated accessibility and mobile-width checks. `tests/test_restore.py` verifies populated proposal/project recovery. Exact command results and remaining test limitations are recorded in `VERIFICATION.md`.

Full Arabic/RTL and manual keyboard/screen-reader acceptance, school policy review, load testing, production controls, live R2/Contabo recovery and the existing Next.js security blocker remain open. These slices do not establish the P7/P8 phase acceptance gates, R1/R2/R3 readiness or educational outcomes.
