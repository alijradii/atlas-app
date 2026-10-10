> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P0–P8 delivery and evidence

Updated 2026-10-09. User instruction: begin development, documentation, and complete P0/P1 from the development plan. This record distinguishes implemented work from phase exit approval.

## Implemented baseline

- P0 decision register, adopted development policies, role/permission matrix, threat model, entity/API/storage design and prioritized backlog.
- Full-scope traceability for 232 requirement/acceptance IDs; no later phase removed.
- Interactive two-direction catalogue, installer plus five role prototypes, younger learner/RTL/state variants, Base UI and React Aria modal comparison.
- Protected installer authorization, persisted revisioned draft, atomic school/admin/colleague finalization, receipt/idempotency, independent deployment marker and fail-closed recovery.
- Password sessions, email/password login, single-use activation, current permission checks, invitation/delegation, revisioned role changes/suspension, last-administrator protection, session revocation and server-assisted recovery.
- English/Arabic identity UI, administrator account management, own-session management, security history and continuity summary.
- Real migrations, generated contracts, synthetic seed, database outbox/worker reconciliation, encrypted backup/isolated restore, operator/deployment commands and runbooks.

## Verification record

See `docs/VERIFICATION.md` for the final commands, results, environment and limits. Automated browser checks do not constitute manual school-user or screen-reader acceptance.

## Exit gates still open

| Phase | Gate | Reason / required evidence |
|---|---|---|
| P0 | Representative school walkthroughs | Development defaults are sponsor-authorized; actual school users have not validated registration, teaching, assessment, parent access, timetable changes, support and rollover. |
| P0 | Named institutional owners / reporting / optional modules | Responsibilities and defaults exist; deployment-specific people and obligations must be recorded before live use. |
| P0 | Complete design evaluation | Modal/registration comparison and two directions exist; timetable controls, bundled Arabic fonts, full translation and manual screen-reader review remain. |
| P1 | Clean Contabo installation, upgrade and recovery | No VPS target, DNS, live R2 credentials or external deployment rehearsal has been supplied. |
| P1 | Upstream Next.js security blocker | Existing October notice requires patch/affected-range review; retained until explicitly resolved with evidence. |
| P1 | Production controls | Separate DB roles, offsite audit integrity, backup scheduling/custody, monitored alerts, secret rotation and container scans require deployment verification. |
| P1 | Full development integration | Infrastructure includes mail capture and isolated queues; real domain handlers remain later-phase work. Live R2 integration needs development credentials. Local warm startup/reload measurements are recorded in `development-benchmark.json`. |
| P1 | Broader identity UX | Printed recovery handover and role switching need school review; account administration is a baseline, not the P2 registrar experience. |

P0 and P1 are **not declared complete** while these explicit plan gates remain open. The completed local identity workflow is usable for synthetic evaluation. R1 and live-school readiness remain blocked.

## P2 / P3 implementation — October 9, 2026

The authenticated `/school` workspace now uses persisted Python domain operations, not catalogue fixtures. Migration `d1d264e28e1d` adds the administration and learning tables and carries the configured P1 year forward. Existing identity authorization is shared by all new routes. Generated OpenAPI/TypeScript contracts are committed as source artifacts; dependency versions and both lockfiles remain unchanged.

| Area | Implemented behavior | Evidence |
|---|---|---|
| Registration | Individual student/teacher/parent registration, profiles, qualifications/weekday availability, private one-time activation handover, mapped CSV preview, atomic/idempotent commit, duplicate errors and explicit shared-name review | `administration_routes.py`, `test_school.py`, browser import scenario |
| Authorization | Explicit school-wide registrar, scheduling and attendance capabilities; password-authenticated sessions; assigned teacher access; effective, verified per-action guardian permissions; current permission checks on reads, search and downloads | Shared authentication/domain policies and denial tests |
| Academic history | Years, terms, holidays, departments, subjects, outcomes, official/advisory/instructional groups, rooms/equipment and courses; separate effective memberships; reasoned endings; reviewed future rollover; archive and version history | Membership/rollover/structure tests |
| Daily administration | Draft/manual timetable, publication-time teacher/room/student/capacity/availability/calendar conflicts, substitutions and cancellations, room/equipment reservations, attendance events and staff correction history | Timetable and booking tests |
| Family workflow | Guardian-linked student choices, scoped timetable/notices/attendance, absence/contact/pickup/correction requests with staff decisions, acknowledgements and stored language/notification preferences | Guardian revocation/denial and browser scenarios |
| Teaching | Units, lessons, reusable templates, resources and activity formats; source/reference/language/permitted-use/outcome metadata; draft/review/publish/revise/retire; version history and keyword search | Publication, snapshot, unauthorized course and browser tests |
| Student work | Published course material, immutable assignment instructions attached to each submission chain, revision history, teacher review/return, teacher-recorded offline evidence | Submission tests and teacher/student browser workflow |
| Notebook | Private notes, annotations, bookmarks, flashcards, concept references and revision tasks; explicit course sharing; revision-checked autosave/error states; own JSON export | Privacy/stale-write tests and mobile autosave browser scenario |
| Media | Bounded upload declarations, quotas, checksums/type checks, R2 staging URLs, fixed quarantine capture, immutable final bytes, ClamAV, retryable jobs/deletion, download authorization on every request | Local file tests, real ClamAV acceptance/EICAR test, opt-in R2 conformance test |
| Recovery | Encrypted format-2 backup includes immutable accepted media; restore verifies checksums into isolated local storage and restores database permissions | Real PostgreSQL/media deletion-and-restore drill |

### Remaining acceptance and implementation limits

P2/P3 are not declared fully accepted releases. The following work remains visible and is not removed from scope:

- Live private R2 signed upload, CORS, expiry, outage/deletion and recovery-bucket conformance require a dedicated bucket and credentials. The opt-in test deliberately skips without them. Local storage and ClamAV tests do not establish R2 correctness. Multipart upload is not exposed; the supported upload limit is 10 MB.
- The school must validate representative roster duplicates, guardian verification/restrictions, attendance correction policy, rollover placements and teaching workflows. New administrative bundles are explicitly school-wide; department-limited administrative delegation remains outstanding. Teacher and guardian access is relationship-scoped.
- The new functional workspace is English. The pre-existing English/Arabic identity UI and RTL catalogue remain. Complete Arabic localization, age-specific workflow validation, manual keyboard/screen-reader review and broader browser/device coverage remain open design/accessibility work.
- Teacher availability is recorded by weekday. Timetables and reservations are manually prepared; advanced recurring scheduling, substitutes without existing teaching assignments, optimization and waitlists remain P7 work. Required supervision-gap validation needs the school's configured day/coverage policy.
- Quiz/oral/practical/discussion/team formats use versioned instructions and submissions/offline records. Rich assessment, grading, moderation and family reports are P4; discussions have teacher-moderated course threads; quizzes currently use authored questions and versioned responses, with grading deferred to P4.
- Basic resource search covers authorized metadata and authored text, not PDF OCR or extracted document text. No extraction is claimed. Source page/chapter/time references are preserved. Offline use is approved file download only; device draft synchronization remains P7.
- Historical referenced files cannot be removed through the unused-upload deletion endpoint. Reviewed retention across institutional records, legal holds and historical backup expiry needs the later governance policy/workflow. Downloaded bytes cannot be remotely revoked.
- Full-school scale/load, streaming backup capacity, offsite custody, a real R2 media restore, database privilege separation, image scans, Contabo rehearsal and the recorded Next.js release blocker remain production gates.

The local P2 and P3 acceptance stories are exercised with synthetic users, but outstanding scope and external gates prevent a blanket “phases complete” claim.

## P4 started — October 9, 2026

The first integrated assessment slice now includes immutable rubric editions, outcome-mapped criteria, exact-submission evidence, separate declared/observed assistance and accommodations, private observation/need/draft states, explicit teacher validation, student feedback and preserved correction history. Migration `9a410a78d521`, generated contracts, API permission/concurrency tests and a teacher/student browser workflow accompany the implementation. Populated assessment history is included in the local encrypted restore drill.

See [P4-ASSESSMENT.md](P4-ASSESSMENT.md) for requirement links, usage and the remaining implementation order. Moderation and grading policies, reassessment/appeals, controlled family reports, communication/meetings, exports, historical report closure and the R1 acceptance gates remain outstanding. P4 is in progress; it is not a completed School Core release.


## P5 implementation — October 9, 2026

Phase 5 now has persisted evidence-linked profiles, student goals/challenges, teacher-authored next-step rules, cycle-checked prerequisites, immutable reviewed learning plans, workload/break checks, dated adviser assignments, restricted support cases/notes, accommodations, appointment capacity and delivery/missed/review tracking. The optional support-coordinator role uses existing password authentication and authorization; adviser/provider capabilities remain assignment-scoped.

Resolved local integration blockers: guardian permissions now distinguish plan/support disclosure; support slots participate in both directions of lesson/room conflict checking; unavailable support escalates without being recorded as delivered; appointment booking requires explicit prior approval; corrected assessment evidence cannot silently satisfy old progression decisions; migrations/contracts and populated backup recovery include the new records.

See [P5-GUIDANCE.md](P5-GUIDANCE.md) for workflows, requirement mapping and limits. This is a locally implemented P5 workflow, not a declaration that P0–P4 or the full phase exit gates are complete. The original P4 uncommitted work remains intact. The outstanding P4/R1 work, Next.js advisory review, live R2/Contabo rehearsal, operational controls, Arabic/manual accessibility and school policy/user acceptance gates remain visible and block production approval.

## P6 implementation — October 9, 2026

P6 now includes the internal provider service, durable isolated AI/ingestion workers, published-source text/PDF extraction, source lineage, PostgreSQL keyword and optional pgvector hybrid retrieval, bounded broad-summary/comparison workflows, activity assistance policies, tutoring and teacher drafts, human feedback approval, private revision tasks, evaluation gates, issue review, retention and usage reservations. The authenticated **Learning with AI** workspace exposes these workflows. Migration `c63a2048e912` and regenerated contracts include the records.

AI is disabled pending a configured approved provider and a teacher-reviewed real-model evaluation. Synthetic inference tests and local pgvector checks establish application behavior, not model quality or educational acceptance. Summary coverage is bounded and reported; rubric/plan outputs are textual reviewable templates. Whole-book hierarchical summaries, native structured rubric/plan conversion, deployment-scale load/recall and optional family explainers are not claimed. See [P6-AI.md](P6-AI.md) for exact scope, operation, evidence and remaining gates. Existing P4/R1 and external release blockers remain; R2 is not declared complete.


## P7 / P8 started — October 9, 2026

Two integrated slices now extend the existing school workspace. P7 adds reviewable manual room/teacher proposals with before/after snapshots, affected people, deterministic conflict checks shared with the manual timetable, atomic administrator approval and transactional in-app notices. This first slice preserves lesson times/groups. P8 adds course-team project briefs, outcome links, responsibilities, milestones, budget/resource notes, immutable individual contribution editions, teacher return/verification and completion gated on every learner's latest evidence.

Migration `d740a19e2036`, generated contracts, relationship/concurrency tests, browser workflows and populated recovery coverage accompany the changes. See [P7-P8-COORDINATION.md](P7-P8-COORDINATION.md) for exact behavior and requirement mapping. Solver workers/full constraints, offline sync, richer project artifacts, mentors/placements, opportunities, selective portfolios and student participation remain in scope and outstanding. Neither phase is declared complete; existing P4/R1, R2 and production gates remain unchanged.
