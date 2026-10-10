# Verification — October 10, 2026

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
