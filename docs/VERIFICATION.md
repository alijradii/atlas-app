# Verification — October 10, 2026

## Report checkbox spacing

Corrected the Study form label rule that overrode checkbox rows with block layout.
Checkbox/radio rows now use a 12px gap, fixed-size controls and first-line alignment
so wrapped confirmation text stays indented. Frontend checks and 64 Bun tests,
production build, and both report browser scenarios passed. The report-sharing
flow checks actual checkbox-to-text spacing on desktop and at 390px, alongside
review consent and recipient authorization. No backend or dependency changes.

## Sidebar state across Study navigation

Moved the navigation collapse preference above route-owned frames into the root
workspace preferences provider. Navigating into or out of Study and Files preserves
the chosen state; a full reload still defaults to expanded. No backend or dependency
changes. Frontend lint/typecheck/contract checks and all 64 Bun tests passed, along
with the production build and 18 compiled browser scenarios. The new regression
switches Home → Study → Home → Study → Files → Study → Home, checks the collapsed
rail and sphere throughout, then verifies an explicit expansion survives Study.
The preceding backend and dependency audit results remain the unchanged baseline.

## Study viewport, panel collapse and alignment

Study now reserves a bottom row for the shared assistant inside its conversation
column on desktop. The conversation and learning tools scroll independently;
long history no longer pushes the input below the viewport. Main navigation can
collapse to a labeled icon rail with a centered sphere. The learning panel hides
without discarding lesson selections, and guidance reveals it before highlighting
sources. Its slide/fade and grid transition use Pearl motion tokens, reverse on
rapid toggles and respect reduced motion. Empty-state hobby/research actions are
centered with the upload actions.

- `SCHOOL_TEST_SCANNER=1 make check`: passed (64 Bun and 247 Python tests).
- Final frontend lint, typecheck, contract checks and 64 Bun tests passed after
  the animation changes; `make build` and `make audit` passed.
- 17 compiled Study browser scenarios passed, including 1180×640, 1366×768,
  1440×900 and 1920×1080 viewport checks, 40-message/25-history stress, draft and
  source preservation, sphere/action alignment, guidance revealing hidden tools,
  rapid animation reversal and reduced motion. Existing 390px and landscape
  regressions passed. The separate four assistant and four role-assistant scenarios
  also passed during this change.
- Visually checked the running real student account in Chromium with expanded and
  collapsed panels. Local screenshots are under `.cache/output/playwright/`.

Browser regression tests use isolated fixtures/provider responses. This UI change
adds no AI mutation tools and does not change the existing production release gate.

## Role assistants, peer activities and exploration reports

Students keep Study; teachers, parents and advisors now use Teaching, Family and
Advisor assistant screens through the same root Pearl composer. Teacher transcript
preparation remains available separately. Events, Connections and Reports use the
shared frame, typography, bare icons, automatic textarea sizing and motion tokens.
Their records persist in PostgreSQL through additive migrations `g0302036`–`g0502036`.

Students explicitly share interests, propose peer activities and join requests.
Teachers create/edit/cancel events and review requests. AI suggestions require
three distinct active students' explicit topic opt-ins and remain pending teacher
review. This is teacher-triggered generation, not background inference or peer
direct messaging. Students can explore hobbies/research in Study, generate an
editable report and explicitly share only that report with selected linked adults.
Current role, account and relationship checks apply on every backend read/write.
Focus refresh preserves current content while rechecking access; revoked reports
and account changes clear private content.

`SCHOOL_TEST_SCANNER=1 make check` passed **64 Bun tests and 247 Python tests**,
including event authorization, topic evidence, provider failures, report quote
verification and relationship revocation. Final frontend/contract checks, Ruff,
production build and application dependency audits passed. The final guidance
catalog passed its **28 assistant tests** after the peer instructions were expanded.
The compiled Chrome regression run passed **98 scenarios**; the remaining community
scenario passed its focused compiled rerun after correcting an exact-label test
locator for a nested select. Thus all **99 browser scenarios** have passing results.
No production authentication or rate limit was relaxed for testing.

Browser work caught a real teacher-materials issue: the floating dock could cover
the transcript action at the bottom of an empty library. That action now sits in
the page heading. Existing mocked Study fixtures were updated to provide the full
newly required workspace response, preserving their original privacy and retry
assertions. Initial build failure came from sandbox-blocked Turbopack worker
sockets; preserving/replacing its derived cache and building with local socket
access resolved it. No source workaround or dependency change was needed.

The local app was also checked with database-backed demo accounts and real Gemini
hobby exploration/report drafting. Saved examples include an astronomy interest,
a pending student telescope request, a teacher-created makers event and a reviewed
report shared with teacher and parent. This adds no invented peer votes: the local
demo still has one student, so AI activity suggestions correctly require more
opt-ins. Desktop and narrow-screen captures are ignored artifacts in
`.cache/output/playwright/community/`. Browser capture logged no page errors.

The app is running locally on port 3001; migrations preserve existing records.
Next acceptance step: the team can exercise Events, Connections and Reports with
its own provisioned linked accounts. Deployment/security/retention gates in
`release-status.json` remain unchanged; this is not production approval.

## Clear guidance and an inline Study composer

Review of the first demo exposed two overlapping surfaces: the saved Atlas reply
covered the control it was highlighting, and the floating Study prompt covered
Your learning space. Guidance now collapses the reply panel and waits for its
closing animation before showing the spotlight. The reply remains available when
the user restores the assistant. Guiding the composer itself keeps that input open
and suppresses the competing reply panel.

Study places the existing root assistant in the conversation column through a
portal. Both Study session and Ask Atlas modes stay within that column, including
long replies and collapse/restore. The message list scrolls independently while
the page can grow; the lesson controls remain unobstructed. Other screens retain
the floating dock and its existing account-bound state.

`SCHOOL_TEST_SCANNER=1 make check` passed **64 Bun tests and 200 Python tests**.
The production build, application audits and final frontend checks passed. The complete compiled
Chrome suite passed **92/92 scenarios**. Coverage now checks actual target hit
positions during guidance on desktop and mobile, replay without another model
request, and Study geometry at 1440×1000, 1600×800 and 390×844 with long conversations,
long Atlas replies, draft preservation and collapse/restore.

The affected guidance, open tutoring and source-grounded tutoring scenes were
recorded again against the real local app with real model calls. The corrected
`Atlas-2036-Demo-v2.mp4` is **1:58**, 1600×900 at 30 fps, captioned and silent.
Finished MP4 frames were inspected at the guidance and Study scenes; both controls
are clear. One source-processing wait remains shortened and labeled. Captures
logged no page errors. Use v2; the first video is retained only as a local artifact.
Existing public-release gates remain unchanged.

## Talk-first Study and application demo

Study now creates a saved conversation and sends the first question directly from
its initial Pearl composer. Zero selected sources means general tutoring, with no
RAG request, private-library access or citations. One to eight selected sources
retain strict authorized retrieval and inspectable quotations. A retrieval miss
never silently falls back to a general answer. Quotas, cancellation, ownership,
session rechecks and request idempotency apply to both modes.

`SCHOOL_TEST_SCANNER=1 make check` passed **64 Bun tests and 200 Python tests**,
including eight new backend cases. Lint, types, generated contracts, production
build and application audits passed. The final complete compiled Chrome suite
passed **89/89 scenarios**, including three new talk-first cases. Frontend checks
were repeated after the final mode and test-isolation fixes.

Compiled testing exposed a mount-order issue hidden by development Strict Mode:
account registration reset the initial Study mode back to Ask Atlas. Initialization
now selects the mode from the authenticated screen, while same-account refreshes
preserve the user's choice. New chat explicitly opens Study, including when already
on its empty page. Tests also exposed the enlarged suite exhausting a shared test
account's real login throttle; the new scenario now has its own disposable account.
No production security limit was relaxed.

The actual local app was recorded using populated fictional database accounts,
with real Gemini UI guidance, general tutoring, scoped RAG answers and source
inspection. Teacher, advisor and parent views use saved data. The captioned silent
MP4 is about 1 minute 56 seconds, 1600×900 at 30 fps. One processing wait is edited
and labeled. Representative output frames were inspected; capture logged no page
errors. Raw captures, manifest and final video are ignored artifacts under
`.cache/output/playwright/atlas-demo/`. The supplied unfinished team presentation
informed the problem/solution titles; no template figures are presented as results.

See [DEMO_BRIEF.md](DEMO_BRIEF.md) for formal framing, narration, claim boundaries,
submission requirements and corrected technical-slide labels. Before public
launch, the existing security, retention and deployment gates still require work;
this change does not claim production approval. The local login page returned 200
after the final build. The next presentation step is for the team to add narration
and combine the reel with its slides; no external upload or submission was made.

## Persistent assistant and database demo sign-in

The root account-bound assistant now survives authenticated navigation, including
its draft, recent replies and minimized state. Suggested questions make real model
requests; selected-lesson suggestions use the cited study API. The read-only MCP
catalog supplies role-scoped workflow context on demand, and validated targets
navigate to the original dim/border/tooltip treatment without executing actions.
Focus/visibility refreshes retain authorized content and unsaved edits. Shared
textareas auto-grow to a cap instead of exposing a manual resize handle.

The fake persona entry points are gone and `/preview/*` returns 404 outside the
explicit test harness. The four existing local demo accounts were migrated to
`student`, `teacher`, `advisor` and `parent`, with the requested password. All four
real API logins and roles were verified. IDs, relationships, example work and ready
sources were preserved; old sessions were revoked. The migration is guarded,
repeatable and covered for collisions and unrelated-account isolation.

`make check` passed lint/types/contracts, **64 Bun tests and 192 Python tests**.
`make build` and application `make audit` passed, including the pinned MCP SDK.
A final focused backend run passed all **20 assistant tests** after correcting the
catalog's document/media upload limits. The frontend checks passed again after
updating old browser expectations from draft-fill to real suggestion requests.
The complete compiled Chrome suite then passed **86/86 scenarios**, including
actual school-role flows, persistent assistant/error/revocation behavior, focus
refreshes, automatic textarea sizing and the test-only legacy UI fixtures.

A real local Chrome → Next → API → Gemini/MCP upload question completed in **2.86
seconds**, navigated to Files and showed the upload spotlight. Navigation retained
a private draft and minimized state. Mobile (390px) account checks found no overflow,
page errors or Axe violations. The separate backend live provider check took 1.68
seconds; these samples are not latency guarantees. Browser regression providers
are deterministic, with the live checks recorded separately. Evidence is ignored
under `.cache/assistant-*` and `.cache/output/playwright/assistant-live-*`.

The existing Starlette test-client warning and public deployment gates remain
open. Known local demo credentials are for synthetic examples. Next steps before
public launch remain the security/deployment/retention checks in SECURITY.md and
release-status.json; this implementation does not clear that gate.

## Shared original Pearl screens and populated demos

Authenticated accounts now render the original Pearl components for the frame,
home cards and helper panel, lesson library, chat, advisor profile, caseload and
student detail. Backend adapters supply authorized records and supported actions.
The former alternate authenticated headers, welcome screen and advisor conversation
layout were removed. Uploads, source review and account controls retain the shared
navigation. The real helper panel builds a reviewable study request instead of
claiming that unavailable notification subscriptions have been enabled.

Local demo accounts now have persisted fictional assignments, feedback, proposals,
a private advisor exchange, transcript drafts and four verified private TXT files.
The teacher's synthetic physics transcript completed actual RAG ingestion and was
published to the linked demo student. No provider readiness or citation was faked.
Seed reruns preserve existing credentials, progress, revocations and deletions;
only the designated four accounts are eligible. See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md).

`SCHOOL_TEST_SCANNER=1 make check` passed all **64 Bun unit tests and 169 Python
tests**, plus lint, types and generated-contract verification. `make build` passed.
The complete compiled Chrome suite passed **76/76 scenarios** after the final
layout and heading corrections. Application `make audit` passed with unchanged dependencies. The pre-existing
Starlette test-client deprecation warning and public-release gates remain recorded.

Actual populated student, teacher, advisor and parent accounts were checked in
Chrome at desktop and 390px widths, including docking/restoring a private draft.
Paired original/live home, lesson and advisor screenshots were inspected. Checked
views had no horizontal overflow or Axe violations. Browser scenarios cover private
Home-to-Study draft handoff without an early send, repeated New chat, authorized
lesson deep links, advisor/caseload parity, upload review, role navigation and real
school workflows. QA corrected heading hierarchy in assignment/proposal cards and
missing spacing around the extracted lesson library.

Visual evidence and logs are local in `.cache/output/playwright/` and
`.cache/pearl-final-*`; credentials and generated artifacts remain ignored.
The existing public deployment blockers below are not changed by this UI work.


## Connected hackathon workspace

The active app now includes `/workspace`, `/files`, `/study` and `/account` with
persisted API workflows. `/preview/*` remains fictional. See [SCHOOL.md](SCHOOL.md),
[MEDIA.md](MEDIA.md), [STUDY.md](STUDY.md) and [ACCOUNT.md](ACCOUNT.md) for the current
scope and provisioning; older entries below describe their original verification
scope rather than current missing features.

`SCHOOL_TEST_SCANNER=1 make check` passed lint, types, generated-contract checks,
**55 Bun unit tests and 157 Python tests**, with no skipped tests. The existing
Starlette test-client deprecation warning remains; no check was suppressed.

The compiled production Chrome suite passed **69/69 scenarios**. It exercises real
PostgreSQL/API role workflows: teacher publication and assignment, student work,
teacher feedback, private advisor messages and ordered advisor/parent decisions.
Upload coverage includes transfer failure/retry, staging cleanup, extraction review,
approval, indexing and cited study. Provider responses are deterministic in this
disposable test harness; the browser tests do not spend a provider budget.

QA found and fixed a newly accessible analytics table overflowing a 390px screen,
guidance targeting a hidden analytics tab, stale tests expecting the removed network
switch, an ambiguous alert selector, and animated proposal text briefly failing
contrast. Workspace entrance motion now uses transforms while text stays opaque.
The former location flags are discarded during preview-state migration without
discarding saved sample work. Account/role/source revocation and returning-tab
revalidation remain covered.

A live development screenshot exposed an additional Strict Mode bootstrap race:
an aborted session check could finish a newer check's loading state and repeatedly
redirect Files through Login. Slow successful authentication reproduced repeated
redirects before the fix. A bootstrap generation now guards completion; the same
development check stays on Files with its heading visible. Privacy revalidation and
stale-response guards remain intact.

After that fix, `make build` and the complete frontend lint/type/contract/unit checks
passed again. **13/13 affected production browser tests** passed, including the new
slow-auth regression and existing account-switch, outage, upload and review cases.
The new regression also passed against development Strict Mode, where the failure
was reproduced. This is a focused rerun after the earlier 69-test full run; the
suite now contains 70 scenarios. Real local desktop/mobile Files screenshots were
recaptured and inspected after sign-in, alongside the role-workflow screenshots.

Before publication, upstream `main` advanced to `81af81e` with interactive landing
demo cards. Those changes were merged without overwriting them. The combined tree
passed frontend lint/types/contracts and all 55 unit tests, then **11/11 compiled
production landing, Pearl accessibility, navigation and motion scenarios**.

A separate real Gemini transcription check used a short synthetic spoken physics
clip, exercising local ffmpeg conversion and the configured transcription provider.
No personal or classroom recording was sent. Native PDF extraction and live ClamAV
checks also passed. The study RAG and cited-answer smoke evidence from the earlier
implementation remains recorded below.

The local database was migrated without resetting existing records. Four isolated
local demo accounts were provisioned with only explicit demo relationships; their
random credentials remain in ignored `.data/hackathon-accounts.json`. No existing
personal account was linked to them or had its password reset. Private environment
values and local account passwords were checked against Git-visible files and are
absent. This is local hackathon delivery, not approval for public deployment.

Known boundaries remain: 20-minute/50-MiB recording imports, text-layer PDFs without
OCR, no live class recording, no autonomous model tools, and operator-managed account
and role provisioning. Application dependency audits pass; the separate vendored RAG
advisories and the other gates in `SECURITY.md`/`release-status.json` remain unresolved.
Live R2 behavior, production container scans, remote recovery, Firefox/Safari and
physical mobile devices were not verified by this pass.

## Post-build QA

QA now runs the complete browser suite against Next's compiled **standalone
production artifact**, not only the development server. `make browser-test-production`
builds a separate `.next-e2e` output, copies static/public assets as the Docker image
does, and launches it with Bun on loopback against the disposable browser API.
CI uses this path; `make browser-test` remains available for development checks.
Neither test mode uses the live application database or paid model credentials.

Reproduced and fixed:

| Finding | Result |
| --- | --- |
| A ninth selected lesson reached an API capped at eight | Selection stops at eight; deselecting one enables another. |
| Arabic/emoji questions could pass the character limit but fail the service byte limit | A visible message explains that the question needs shortening; Enter/Send cannot submit it, and the draft is preserved. |
| A transcript shorter than 30 characters could be submitted | The form explains the minimum before submission and counts Unicode code points consistently with the API. |
| An open shared-source dialog kept cached text after returning to a revoked lesson | Leaving the tab clears the dialog's source; returning reauthorizes before displaying it. No claim of recalling already copied content. |
| NUL/unpaired Unicode inputs and malformed resource paths produced storage errors | Invalid text returns validation errors; invalid study resource identifiers return 404 before database access. |
| A worker crash after committing a ready lesson could make lease recovery mark it failed | A valid recovered lease completes bookkeeping without uploading again or downgrading the ready source; stale leases remain rejected. |
| The idle home composer obscured tasks on short screens | It starts docked below 601px viewport height. Once used, keyboard/orientation changes do not close it or lose its draft. |

The compiled Chrome suite passed **57/57 scenarios**, including five new study UI
cases and a short-screen dock regression. Long conversation checks use 40 messages
at 844×390 and 844×260. A separate exploratory pass covered 18 landing/login/student/
staff views at 320×568, 844×390 and 768×1024 with no horizontal overflow or uncaught
page errors; screenshots were inspected in `.cache/output/playwright/qa/`.

`make check` passed lint, types, unchanged API contracts, 53 Bun tests, and the
backend suite. Seventeen new backend edge cases cover invalid input, source IDs,
crash/recovery leases and retrieval with no hits. The final backend rerun passed **106 tests**, with one optional live scanner
test skipped. `make build` also passed with the normal app configuration. The application dependency audit passes;
the previously recorded vendored RAG findings still block public deployment.

This pass used deterministic providers and made no paid model calls. Real provider
smoke evidence is recorded in the earlier implementation section below. Firefox,
Safari, physical mobile keyboards and production hosting were not exercised.
Retrieval currently searches the latest question, without rewriting vague follow-ups
from history; missing evidence fails honestly without an answer-model call. Broader
retrieval-quality evaluation and the existing release gates remain open.

## Private transcript study and priority home

- `make check`: passed. JavaScript/TypeScript lint, generated API contract checks,
  53 Bun tests, Python lint/format, and 89 Python tests passed. One optional live
  ClamAV case was skipped because the scanner was not enabled for this run.
- `PLAYWRIGHT_CHROME_PATH=/opt/google/chrome/chrome make browser-test`: **51 passed**.
  Includes real API/database transcript import, saved/cited answers through a
  deterministic provider, sharing/revocation, cancellation/retry, account switching,
  hidden-tab polling, starter drafts without premature requests, and desktop
  light/dark plus mobile accessibility. Existing files and role-preview flows pass.
- `make build`: passed, including `/study`. The first restricted attempt could not
  bind Turbopack's local worker socket; moving its cached failure aside and building
  with local socket permission succeeded. No source workaround or check suppression.
- The vendored Python 3.12 retrieval service: **116 tests passed**, including an
  actual Milvus Lite close/reopen test. A live restart exposed an unloaded persisted
  collection during ingestion; explicit collection loading fixes the failure and
  preserves previously indexed sources. This regression is now covered.
- `make audit`: the application JavaScript and Python locks passed. The **separate
  vendored RAG audit fails** with 21 distinct advisory IDs in four packages; see
  [SECURITY.md](SECURITY.md). No advisories were suppressed. The upstream Next.js
  October 14 security release notice was rechecked; public deployment stays blocked.
- A real Gemini/RAG smoke test indexed a synthetic Newton transcript and generated
  a correct cited answer in 8.57 seconds using an isolated schema. Authorization
  after source deletion and logout was also checked. This paid check is not CI.
- The running local stack was also verified through Next.js → API → Redis/Celery →
  persisted RAG → Gemini after a service restart: a clearly labeled synthetic
  example indexed successfully and its cited answer was saved and reopened in
  Chrome. A generated local account is provisioned; its credentials are ignored
  and are not part of the repository.
- Visually reviewed the priority home and authenticated study layouts. The home
  retains glass material but groups tasks by required action and uses consistent
  task objects. The study composer occupies its own layout area; it does not cover
  the conversation. During browser checks, faded-in small text failed contrast;
  keeping transform motion without fading message opacity resolved it. The extra
  files-navigation link also exposed mobile overflow, fixed with wrapping controls.

The automated study browser harness injects a deterministic provider only in its
isolated test server. Running `/study` uses real configured providers and explicit
failure states. School-role pages under `/preview` still use fictional fixtures.
Full audio transcription, autonomous execution tools and school workflows are not
implemented by this study feature. Production deployment is not approved.

## Earlier Atlas Pearl frontend

- `SCHOOL_TEST_SCANNER=1 make check`: passed; repository lint, TypeScript, contract drift checks, Python lint/format and all 26 backend tests.
- `make build`: passed after the final accessibility fixes, using Bun 1.4.2 / Next.js 16.4.0. Routes: `/`, `/login`, `/files`, `/preview/[account]/[[...section]]` and not-found.
- `make audit`: passed; 249 JavaScript packages checked, and Python reported no known vulnerabilities. The recorded release blocker remains.
- `make browser-test`: all 6 scenarios passed. Covers real login errors/upload/download/delete/logout; landing tabs/FAQ/theme persistence; 26 role views at 390 pixels with overflow and Axe checks; mobile navigation and dialog keyboard dismissal; light/dark accessibility; sample practice persistence/tutor pause/feedback; adviser-parent-school subject review; teacher follow-ups and staff activity review. Invalid routes render the framework not-found screen.
- Visually inspected desktop landing, light/dark workspaces and the mobile workspace against the supplied kit. Screenshots are local ignored artifacts in `.cache/pearl/`. Motion is reduced in the preview browser suite to make theme and animated-art checks deterministic.
- Final lint and `git diff --check`: passed.

School workflows use fictional local fixtures; the assistant is scripted and the lesson-publishing form does not upload video. These checks do not verify a school backend, AI inference, production R2 or deployment. See [Atlas Pearl boundaries](ATLAS_PEARL.md).

## Earlier infrastructure reset

- `SCHOOL_TEST_SCANNER=1 make check`: passed; lint, TypeScript, contract drift checks, Python formatting/lint and 26 tests. Includes isolated PostgreSQL migrations, login/session protection, ownership isolation, upload limits/checksum/quarantine/deletion, live local ClamAV checks, and an encrypted database/personal-file backup and restore to a newly created disposable database.
- `make build`: passed with Bun 1.4.2 and Next.js 16.4.0. Routes are `/` and the framework not-found route.
- `make audit`: passed; Bun checked 127 packages and Python reported no known vulnerabilities. This does not clear the upstream release blocker or guarantee vulnerability absence.
- `make browser-test`: passed; one complete sign-in, error handling, upload, download, deletion request and sign-out flow, plus accessibility checks and a 390-pixel viewport check. Backend tests verify asynchronous object deletion separately.
- `git diff --check`: passed.

Verification used local disposable schemas/databases, temporary storage and synthetic accounts. Existing application databases, uploaded files and private environment files were not reset. Browser API/web servers and build workers required execution outside the restricted network sandbox.

FastAPI's test client emits an upstream deprecation warning about its httpx transport. No warning or advisory was suppressed. Container images were not rebuilt/scanned, and live R2 integration and production recovery remain unverified. See SECURITY.md and release-status.json.
