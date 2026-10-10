> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P4 assessment work

Started 2026-10-09 against section 10.6 of `school_2036_development_plan.md`. This is the first integrated slice of P4, not a completed phase or an R1 release candidate.

## Delivered slice: rubric → submission → reviewed evidence

Assigned teachers can create and revise course rubrics in **Courses → select a course → Rubric workshop**. Each criterion maps to learning outcomes and has a qualitative description with an optional bounded integer score. A saved edition is immutable. Teachers select an edition when authoring material; the existing content review/publication workflow shares those criteria with students. Revising a rubric or assignment does not replace editions attached to existing submission chains.

Students declare independent, tool-assisted, collaborative, or unestablished conditions when submitting. Teacher-recorded offline submissions preserve who recorded the declaration. Existing P3 submissions migrate to `unknown`; no assistance condition is inferred from historical work. A teacher records observed assistance separately from that declaration and from accessibility accommodations used during the assessment. The applicable instructions, permitted assistance, rubric and exact submission remain traceable.

Under each submission, **Record assessment evidence** supports observations, inferred needs and draft judgments. All remain private to current assigned teachers. Each revision requires a reason and preserves its predecessor. **Validate and share assessment** is an explicit human action available only for the latest draft. Students see their own validated decisions and earlier shared versions. Drafting a correction leaves the previous validated decision visible until the correction is validated. There is no automatic overall score, attendance penalty, conduct adjustment or inferred mastery.

Administrative capabilities alone do not authorize rubric authoring or academic judgments. Staff need a current teacher role and course teaching assignment. All reads and writes use the existing installed-state, session, MFA, origin and CSRF controls. Permission checks run again on each request. Assessment writes stop when the course or parent academic year is archived. Guardian reporting is not exposed by these endpoints; the controlled family-report workflow remains outstanding.

## Implementation and evidence

| Story / requirements | Implementation | Verification |
|---|---|---|
| Version criteria and preserve assessment context: ASM-02, TCH-08, AT-11 | `assessment_rubric`, `rubric_version`, immutable assignment metadata and submission declarations | Rubric and assignment changes retain original criteria/instructions; contract and migration checks |
| Link judgments to outcomes and distinguish their status: ASM-03, PLN-01 evidence foundation | `evidence_version`, one judgment per criterion, revisioned observation/need/draft/validation stages | Draft suppression through both list and guessed-ID routes; explicit validation and history |
| Separate conditions: ASM-04, DAT-07, TCH-09 | Declared and observed assistance, declaration actor, separate accommodations | Different declared/observed conditions survive correction and restore |
| Keep judgment transparent: ASM-05 partial | Qualitative judgments and optional per-criterion integer scores bounded by the original edition | Invalid scales, missing/duplicate criteria and unknown criteria rejected |
| Preserve corrections: ASM-06 partial, STU-05 | Reasoned append-only revisions, explicit sharing, teacher/student submission views | Stale/repeated validation rejected; concurrent writes have one winner; previous shared versions retained |
| Recovery and authorization | Migration `9a410a78d521`, domain rules in `packages/backend/src/school2036/assessment.py`, typed contracts and API routes | `tests/test_assessment.py`, populated assessment history in `tests/test_restore.py`, browser teaching flow |

The UI uses the owned components and tokens. The browser scenario creates a rubric, publishes a task, submits declared assistance, saves a private assessment, validates it, and reads it as a student at 390 px with axe and overflow checks. These checks do not replace manual accessibility or school-user review.

Apply migrations with `make migrate` before using the workspace. The migration adds tables and backfills declaration fields without rewriting existing submissions. New assessments require a rubric already attached to the submission's instructions. For older work without one, publish a new task; this slice does not retrofit criteria onto submitted work. Backup includes the new tables through the existing encrypted PostgreSQL dump, and the restore test compares original and recovered teacher/student evidence views.

## Remaining P4 scope, in implementation order

1. Assessment policies and conventional grade calculations; richer rubric scales; explicitly versioned pre-assessment accommodations; moderation assignments, review requirements and separate publication/amendment capabilities. Current validation can be done by the author and is not a moderation workflow.
2. Reassessment requests, appeals and their decisions; outcome progress summaries; report templates, batches, review/publication, correction/withdrawal and printable/vendor-independent exports. Evidence correction history does not establish AT-12 for reports.
3. Parent reports and feedback with per-child disclosure rules and delivery-time checks; authorized messaging, meetings/booking, forms, acknowledgements, notification digests/quiet hours and critical-notice fallback procedures.
4. Basic annual closure with historical report reproduction, institutional views, full-school load testing, expanded recovery and accessibility/Arabic review, five-role training and the R1 pilot/release gates.

These items remain mandatory P4 work. Live R2/Contabo recovery, production controls and the recorded Next.js security blocker remain open as described in `PHASE-STATUS.md` and `SECURITY.md`. No production approval is implied.
