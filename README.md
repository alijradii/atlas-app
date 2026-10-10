# Atlas Pearl · application foundation

Reset on October 10, 2026 for a frontend and backend rebuild, then styled from the supplied Atlas Pearl kit using Tailwind CSS and shadcn/ui. The working backend provides basic sign-in and private file upload, download, and deletion. The landing page and student, teacher, adviser, parent and staff workspaces are interactive frontend previews with fictional data; school domain services and AI inference remain removed. See [the design implementation and route guide](docs/ATLAS_PEARL.md).

## Retained infrastructure

- Bun 1.4.2 / Next.js / TypeScript frontend in `apps/web`, Pearl tokens and owned shadcn UI in `packages/ui`.
- Python 3.14 / uv / FastAPI backend in `apps/api` and `packages/backend`.
- PostgreSQL, Alembic migrations, Redis, Celery worker and periodic media cleanup.
- Server-side sessions, password hashing, request-origin/CSRF checks, login throttling and explicit installation state.
- Private local/R2 storage adapters, checksums, quarantine, scanner integration and per-user file authorization.
- Generated OpenAPI contracts, CI, Docker/Caddy deployment templates and release gate.
- Optional ClamAV and Mailpit services; an internal AI health-only placeholder.

## Start locally

Requirements: Bun 1.4.2, Python 3.14, uv 0.11.19, Docker Compose.

```sh
make bootstrap
make dev
```

In another terminal, create an account (password is prompted, never passed on the command line):

```sh
make create-user LOGIN=you@example.com NAME="Your Name"
```

Open http://localhost:3000 for the landing page, `/login` for sign-in, or `/preview/lina/home` for a sample student workspace. `/files` requires a real session. Existing active accounts still work after migration. New installations require the local account command; there is no public signup, default password, setup wizard or demo login. To reset a password and revoke all sessions:

```sh
uv run --frozen python -m school2036.operator reset-password --login you@example.com
```

Development listeners bind to localhost. `make dev-full` also starts the scanner, local mail capture and AI placeholder. Set `SCHOOL_SCANNER_HOST=127.0.0.1` in your private `.env` and restart API/worker to enable binary-file verification. Without a scanner, development accepts plain UTF-8 text only; PDF/PNG/JPEG files remain unavailable until scanning succeeds. Production always requires scanning and private R2.

## Files

Uploads are private to their owner, limited to 10 MiB per file and 100 MiB per account by default. The UI creates a staging upload, sends bytes, requests verification and polls status. Only accepted files can be downloaded. Deletion is immediate for access and asynchronous for stored bytes, so keep the worker and beat running. See [media configuration](docs/MEDIA.md).

## Existing data and migrations

No existing database, volume, `.env`, or uploaded object is reset by this source change. Historical migrations remain immutable so existing databases can advance safely; new personal files use a separate `personal_file` table. Legacy course attachments are preserved but are not exposed through the new personal-files API. Retired domain tables are retained for future reviewed migration; do not drop them or use automatic migration generation to remove them.

Documents in `docs/archive/` are historical references, not implemented capabilities or the current rebuild scope. A private source snapshot of the pre-reset working tree was saved at `/tmp/school2036-before-reset.tar.gz` during this change; it excludes ignored files and is temporary, not a database backup.

## Verify

```sh
make infra-up
make check
make build
make audit
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" bun --bun playwright install chromium
make browser-test
```

Tests create disposable schemas/databases in local PostgreSQL; the restore drill uses the development Compose PostgreSQL client. API changes require `bun run api:generate`. Direct dependencies remain exactly pinned, with `bun.lock` and `uv.lock`.

See [verification results](docs/VERIFICATION.md) for the reset checks.

Production remains blocked. See [security](docs/SECURITY.md), [release status](docs/release-status.json), [operations](docs/OPERATIONS.md), and [deployment](docs/DEPLOYMENT.md). No production deployment is part of this reset.
