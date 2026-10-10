> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P0–P5 verification report

## Atlas frontend verification — October 10, 2026

- Created [Atlas design system](ATLAS-DESIGN.md) before implementing the rebrand. Shared tokens and controls now style the existing identity, classroom, administration, learning, assessment, guidance, support, notebook, AI, scheduling, and project screens. Headers, metadata, favicon, catalogue, service status, and the missing-page screen use Atlas branding.
- `make check`: passed TypeScript, contract drift, Ruff, and **81 Python tests**, with 3 optional integrations skipped (pgvector, ClamAV, live R2); 249.20 seconds. The existing Starlette TestClient deprecation warning remains. The final frontend lint pass is clean with no warnings.
- `make build`: passed with Bun 1.4.2 and Next.js 16.4.0, including the final favicon and branded 404. The sandboxed build stalled at worker communication; the permitted local build completed.
- `make browser-test`: **7 passed** in 50.4 seconds. Includes the existing school workflows; course navigation, posting, materials and rosters; keyboard focus return; mobile and RTL; all six light/dark accent combinations with axe; density, preference persistence/reset, system appearance, and unavailable browser storage.
- Production preview: verified desktop sign-in, 390 px Arabic sign-in without page overflow, and a real HTTP 404 with Atlas navigation. Visually reviewed these screenshots alongside course screens and the dark catalogue. Screenshots are local artifacts in `.cache`.
- `make audit`: 145 JavaScript packages and the locked Python dependencies reported no known vulnerabilities. Dependencies and lockfiles are unchanged. Reviewed the official [Next.js advisories](https://github.com/vercel/next.js/security/advisories), [React security notices](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components), and [Bun security page](https://github.com/oven-sh/bun/security). The recorded October Next.js notice could not be fetched directly; the existing production blocker remains in force. Audit results do not establish absence of vulnerabilities.

These checks establish local behavior for the rebrand, not full accessibility certification or production approval. Manual screen-reader, native-language, and additional browser review remain required.

> October 10 onboarding update: authenticator enrollment and codes have been removed. The older MFA references below describe historical runs. Current coverage includes default/overridden first-run passwords, explicit-state preparation, seeded roles and family/course relationships, production seeding, development-only shortcuts, legacy-account compatibility and password reauthentication.

## Onboarding verification — October 10, 2026

- `make check`: passed lint, TypeScript, contract drift, Ruff and **80 Python tests**, with 3 optional integrations skipped (real provider, ClamAV opt-in and live R2); 308.60 seconds. PostgreSQL tests include production-mode secure cookies, default/overridden setup passwords, automatic preparation, seed rollback/replay, ordinary and seeded logins, legacy MFA compatibility and actual encrypted restore. The existing Starlette TestClient deprecation warning remains visible.
- `make build`: passed using Bun 1.4.2 and Next.js 16.4.0. The sandboxed build stalled during worker communication; the permitted local build completed.
- `make audit`: 145 JavaScript packages and locked Python dependencies reported no known vulnerabilities. No dependencies or lockfiles changed; the upstream release gate remains unresolved (see `SECURITY.md`).
- `make browser-test`: **2 passed** in 1.5 minutes. Covers seed selection surviving reload, receipt, mobile role picker, keyboard one-click sign-in, password login and the complete existing school workflow, plus selected axe and RTL checks. Browser tests use a separate ignored Next.js directory so they can coexist with local development. A timezone-dependent test date was corrected to use UTC calendar arithmetic.

Historical verification follows; earlier MFA flows are superseded by the current password-only implementation.

Date: 2026-10-09. Synthetic data only. These results establish local engineering behavior, not school acceptance or production approval.

| Check | Result | Limits |
|---|---|---|
| `SCHOOL_TEST_SCANNER=1 make check` | Passed: Biome, TypeScript, generated-contract drift, Ruff; **42 Python tests passed, 1 skipped**, 92.63 seconds | PostgreSQL 18 in isolated local schemas/databases. The live R2 test is the one skipped test. |
| `make build` | Passed: Next.js production build executed with Bun; includes `/school` | Not a VPS deployment or runtime load test. The first sandboxed attempt stalled at worker page generation; the final permitted local build finished successfully. |
| `make audit` | Passed: 145 JavaScript packages and locked Python dependencies reported no known vulnerabilities | Advisory-database coverage only; does not clear the existing Next.js blocker or container OS vulnerabilities. Dependencies and lockfiles were unchanged. |
| `make browser-test` | Passed: 2 scenarios, final run 24.5 seconds | Chromium with selected axe checks and mobile layouts; not manual WCAG certification. |
| Real ClamAV integration | Passed: harmless PNG accepted, EICAR test signature rejected | ClamAV 1.5.4, signature database 28148; local Docker, not production scanner operations. |
| Database/media recovery | Passed: real encrypted PostgreSQL dump/restore plus deleted immutable media restored and downloaded after restored MFA sign-in | Isolated local filesystem recovery; no live R2 recovery bucket or offsite drill. |
| Compose syntax | Development media profile and production example validated | Production check used `--no-env-resolution`; no real production environment was supplied or deployed. |
| Live R2 test | **Skipped** without `SCHOOL_TEST_R2=1` and dedicated credentials | CORS, signatures, expiry, immutable capture, private reads, deletion and recovery need real-bucket evidence before release. |

Runtime: Bun 1.4.2, Next.js 16.4.0, Python 3.14.5 on the local host. The pinned Python image remains Python 3.14.8. No JavaScript/Python dependencies were added; existing exact pins and both lockfiles remain intact. ClamAV is pinned by image digest. No downloaded binaries, synthetic credentials, private environment files or test media are tracked in Git.

## Backend coverage

P1 coverage remains: protected setup, MFA, CSRF/origin checks, concurrent/idempotent finalization, session revocation, last-admin protection, activation/recovery, privilege denial, deployment-marker failure, rate/body limits, seed refusal and outbox retries. Real migrations are checked against model metadata.

P2 tests exercise mapped CSV validation/commit/replay, duplicate-name review without identity collisions, registrar privilege boundaries, teacher/guardian guessed identifiers, relationship revocation after a notice exists, publication-time timetable conflicts, room reservations, attendance correction history, curriculum revision history and rollover preservation of separate advisory membership.

P3 tests exercise publication, scoped keyword/content access, immutable assignment instructions across revised submissions, exact-version teacher feedback, private/shared notes, stale writes, own exports, moderated course discussion, file checksum/type/size rejection, unauthorized/retired/revoked file access, and immutable final bytes after staging replacement. Scanner downtime and storage outage tests check bounded retries, retained quarantine bytes and recovery without accepting unavailable data.

The backup drill encrypts database/configuration/marker/MFA-key/media data, rejects a wrong key, deletes the original accepted media, restores into a new database and local object directory, cancels pending jobs, revokes sessions/activation codes, and verifies restored identity plus file bytes. The archive is still buffered in memory; full-school scale, offsite access, PITR and measured production recovery targets remain open.

## Browser coverage

The first scenario completes setup, saved-draft reload, MFA, invitation, roster import preview/commit, assigned teacher publication with a verified text attachment, student submission, notebook creation/autosave/reload, private-note exclusion from teacher views, teacher feedback, and logout. Axe scans cover the installer, administrator, import, mobile notebook and teacher workspace. The student notebook is checked at 390 px for horizontal overflow; its screenshot was visually inspected.

The second scenario retains the two catalogue directions, six role prototypes, Arabic/RTL and reduced motion, keyboard dialog activation/dismissal/focus return, axe scan and narrow-layout check. The catalogue remains synthetic.

The new functional school workspace is English. Full Arabic localization, age-specific workflow review, screen-reader testing and broader device/browser coverage remain open. The automated checks do not substitute for school-user review.

## Warnings and retained gates

Starlette emits a deprecation warning for the pinned httpx TestClient adapter. No warning or advisory was suppressed. The recorded Next.js October notice remains unresolved, and `release-status.json` is unapproved. Upstream Next.js/FastAPI/Bun/ClamAV sources were reviewed separately; details and links are in `SECURITY.md`.

No live R2 credentials, Contabo target, named school reviewers or production policy configuration were supplied. Production TLS/firewall, privilege separation, audit integrity, backup custody/scheduling, image vulnerability scans and deployment/upgrade/recovery rehearsal remain required. Department-scoped administrative delegation and full localization remain implementation work; see `PHASE-STATUS.md` for the complete limitations rather than interpreting a passing test suite as completion of every requirement.

## P4 assessment slice — October 9, 2026

The earlier tables record the P2/P3 run. The P4 run uses Bun 1.4.2 and Python 3.14.5, with real isolated PostgreSQL schemas and synthetic data. No dependencies or lockfiles changed.

- `make check`: passed Biome, TypeScript, generated-contract drift, Ruff and **45 Python tests; 2 skipped**. The skipped tests require opt-in live R2 and ClamAV services; neither was rerun for this assessment slice. The existing Starlette/httpx deprecation warning remains unsuppressed.
- `make build`: passed using `bun --bun next build`.
- `make audit`: 145 JavaScript packages and the exported locked Python dependencies reported no known vulnerabilities. This does not establish absence of vulnerabilities or clear the release blocker.
- `make browser-test`: both scenarios passed, including rubric creation/selection, assistance declaration, private evidence drafting, explicit validation and student visibility; axe and 390 px overflow checks cover the new student view. The mobile assessment screenshot was visually inspected.
- The enhanced encrypted database/media restore test also restores populated rubric editions, submission declarations and draft/validated evidence. Teacher history exactly matches the original API view; the restored student sees only the validated decision.

New denial tests cover administrative capabilities without teaching authority, unrelated teachers/students/guardians, guessed evidence IDs, revoked memberships and archived-course writes. Integrity tests cover unchanged instructions/rubrics after edits and resubmission, invalid criterion scores/keys, stale and concurrent writes, observation-versus-validation transitions, assistance-preserving retries and correction history. Alembic/model metadata comparison passes with migration `9a410a78d521`.

Localhost database/browser and Docker restore checks required execution outside the filesystem/network sandbox. No live-school records, outbound messages or deployment were involved. P4 reporting, moderation, appeals, communication and full R1 acceptance remain outstanding; see `P4-ASSESSMENT.md`.

The CI workflow now includes the pinned local scanner and consistent repository-local browser installation. This session ran the commands locally, not a hosted CI job. Prior P0/P1 Python/web image smoke checks and the development timings in `development-benchmark.json` are historical evidence; container image builds and timing measurements were not rerun for P2/P3. No commit or deployment was made.


## P5 learning plans, advising and support — October 9, 2026

Final verification ran with Bun 1.4.2, Next.js 16.4.0 and Python 3.14.5 against isolated local PostgreSQL schemas and synthetic accounts. Existing exact dependencies and both lockfiles are unchanged.

| Check | Final result | Limits |
|---|---|---|
| `make check` | Passed Biome, TypeScript, generated-contract drift, Ruff and **52 Python tests; 2 skipped**, 157.89 seconds | Opt-in live R2 and ClamAV tests skipped. The existing Starlette/httpx deprecation warning remains unsuppressed. |
| `make build` | Passed with `bun --bun next build`; `/school` included | Local production build, not a deployment or load test. |
| `make audit` | 145 JavaScript packages and locked Python dependencies reported no known vulnerabilities | Current advisory-database coverage only; the upstream Next.js gate remains unresolved. |
| `make browser-test` | Both scenarios passed, final run 36.1 seconds | Authored recommendation, reviewed profile/plan, student challenge, referral and capacity escalation; Chromium, axe and narrow-layout checks, not manual school acceptance. |
| Migration/model comparison | Passed with `b52f19d82011` after P4 | Tested against real PostgreSQL; downgrade deliberately requires backup recovery rather than deleting history. |
| Encrypted recovery drill | Passed with populated P4/P5 history and media | Restores profiles, plan editions, case assignments, scheduled interventions, accommodations and restricted notes; verifies teacher denial and professional MFA access. Local database/filesystem, not offsite/live R2 recovery. |

The seven P5 API scenarios cover explicit next-step readiness versus developing capability; teacher-authored rules and draft suppression; prerequisite cycles; dated adviser scope/revocation; goal/evidence mapping; challenges, supersession and preserved plan history; unchanged memberships; workload limits; absent-capacity escalation; actual approval before booking; double-booking races and reverse room conflicts; restricted notes and course accommodations; missed versus delivered support; family receipts/disclosure/revocation; urgent acknowledgement and professional-role revocation. Existing earlier-phase tests continue to pass.

The browser workflow uses real Python APIs and migrations. The teacher creates an activity rule, records and reviews a readiness decision, and proposes/approves a three-purpose plan. The student challenges a decision and requests support. The coordinator sees explicit unmet capacity. The narrow support screenshot was visually inspected; final UI checks also include the explicit readiness control and restricted-record disclosure controls.

An intermediate check caught a formatting error, which was corrected. Another run overlapped a schema edit and held stale model metadata; the final fresh-process check above passed both metadata comparison and restore. Only the final run establishes verification of the final source tree.

No deployment or commit was made. No private notes are placed in general learner/search views, generated OpenAPI, browser fixtures or ordinary audit details. No outbound notifications or AI integrations were enabled. Full P4/R1 work, Arabic/manual accessibility and school-user review, private R2/Contabo/offsite rehearsal, production controls and the recorded Next.js notice remain explicit gates in `P5-GUIDANCE.md`, `PHASE-STATUS.md` and `release-status.json`.

## P6 governed assistance — October 9, 2026

Verification uses Bun 1.4.2, Next.js 16.4.0 and Python 3.14.5. `pypdf==6.20.0` and its exact lock entry were added; JavaScript dependency pins and `bun.lock` remain unchanged. The pgvector 0.8.7 image was built from the checksummed upstream archive on the existing pinned PostgreSQL base, then tested in a separate localhost database on port 5433. It did not replace the development database.

- Final `SCHOOL_VECTOR_TEST_DATABASE_URL=… make check` passed Biome, TypeScript, generated-contract drift, Ruff and **68 Python tests; 2 skipped**, in **234.47 seconds**. The skipped tests require opt-in live R2 and ClamAV. The existing Starlette/httpx deprecation remains unsuppressed.
- `make build` passed using Bun/Next.js with the AI workspace included.
- `make audit` reported no known vulnerabilities in 145 JavaScript packages or the exported locked Python dependencies. Upstream review and the unresolved Next.js release blocker are recorded in `SECURITY.md`; no container vulnerability-clearance claim is made.
- The final browser run passed both scenarios in **45.7 seconds**. The new flow checks disabled AI, teacher assistance settings, real queued text/attachment ingestion, student boundary disclosure, administrator controls, mobile width and axe accessibility. The mobile screenshot was visually inspected. This browser scenario does not run a real inference model.
- **17 focused AI/recovery tests passed** before the final full run. Coverage includes ownership/role denials, independent-assessment sources, attempt requirements, source withdrawal, membership revocation during inference, deterministic citation validation, missing-evidence abstention, usage reservation races, idempotency, cancelled/failed jobs, safe feedback review, no automatic mastery changes, retention, issue-triggered suspension, PDF extraction, real pgvector ranking, real local HTTP adapter transport and blocked-provider/core lock isolation. The final run additionally verifies expired/replayed service contexts.
- Migration/model metadata comparison passes for `c63a2048e912`. The populated encrypted recovery drill preserves AI source sections, task results/provenance and evaluation records; it cancels queued AI requests and restores policy in disabled mode, alongside prior P4/P5/media recovery assertions.
- CI now builds the isolated pgvector test service and runs conformance alongside its existing scanner check. Hosted CI itself was not run in this session.

The real-provider corpus runner and school approval workflow are implemented, but no model endpoint or teacher acceptance evidence was supplied, so no capability was enabled and no real-provider quality result is claimed. Local deterministic fixtures and a protocol-conformance HTTP server are test artifacts only. Production multilingual quality, sustained mixed workload/recall, hardware/model limits, school educational usefulness and all earlier release gates remain open. No deployment or commit was made; existing uncommitted P4/P5 work was preserved.

The P6 Python wheel was built offline and checked to include `school2036/ai_corpus.json`. The isolated vector test container/network was removed after verification; the existing development services were left running. Final `git diff --check` passed.

## P7/P8 initial coordination/project slices — October 9, 2026

- Runtime: pinned local Bun 1.4.2 via `.tools` and `make`, Python 3.14.5 with uv and the existing frozen lockfiles. No dependency changes in this increment. Contracts regenerated with `bun run api:generate` under the pinned Bun path.
- `make check`: passed lint, TypeScript, contract drift, Ruff and PostgreSQL-backed tests: **73 passed, 3 skipped**. The skips are the optional pgvector and live ClamAV/R2 integration configurations; no additional coverage is inferred from them. Existing Starlette/httpx deprecation warning remains.
- The six new `test_coordination.py` scenarios cover proposal conflicts and atomicity, room swaps/stale decisions, support preservation/coverage, project edition/review integrity, authorization/revocation/peer privacy and concurrent submissions.
- The encrypted PostgreSQL/media restore drill also restored and compared an approved proposal snapshot, project brief, contribution and teacher review through authenticated APIs.
- `make build`: passed under Bun/Next.js after rerunning with process access. The restricted invocation stalled during page-data collection and was terminated; it is not counted as a successful build.
- `make audit`: passed with no known advisories in 145 JavaScript packages or the locked Python dependencies. See `SECURITY.md` for the separate upstream check and retained Next.js blocker.
- The restricted `make check` invocation could not reach localhost PostgreSQL. It was terminated and rerun with local database/Docker access; the successful result above is that complete run.

- `make browser-test`: **2 passed**, including the extended administrator/teacher/student workflow. The new scenario exercises keyboard proposal approval, project editor labels/automated accessibility, rejected completion with missing evidence, versioned contribution/review, completion and narrow-screen layout. The final run finished in approximately one minute. An earlier run timed out waiting for project launch; label associations were corrected and explicit save-response checks added before the successful reruns.
- Re-ran the six coordination integration tests after making publication conflicts readable in the existing API error UI: **6 passed**. Frontend lint/type/contract checks and `git diff --check` also passed after the form fixes.
- Inspected `.cache/projects-mobile.png` from the 390px browser workflow: readable stacked layout, labeled controls, no horizontal overflow. This synthetic local screenshot is not a production artifact.

Manual school-user, complete Arabic/RTL, screen-reader, broad keyboard navigation, full-scale load and live deployment acceptance are not established by these tests. P7/P8 remain initial integrated slices; outstanding phase requirements are listed in `P7-P8-COORDINATION.md`.
