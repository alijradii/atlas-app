# Verification — October 10, 2026

## Atlas Pearl frontend

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
