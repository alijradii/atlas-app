> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Development and VPS deployment

## Development

Run `make bootstrap`, then `make dev`. PostgreSQL and Redis use dedicated `school2036-dev` volumes, with localhost ports 5432 and 6379. Change the Compose mapping and matching `.env` values together if those ports are occupied. The Next.js server uses Bun and forwards `/api/*` to Python.

Local media lives under ignored `.data/media`. For R2 integration, select `SCHOOL_STORAGE_BACKEND=r2` and supply a dedicated development account/bucket configuration in `.env`. Credentials must never use a production bucket for development. Authorized staging uploads, quarantine and authenticated downloads are implemented. See `MEDIA.md` for scanner startup and opt-in live R2 conformance; multipart is not exposed under the 10 MB limit.

## Prepared production topology

`infra/compose.prod.yaml` describes Caddy, Bun/Next.js, the Python API and worker, PostgreSQL, Redis, private ClamAV, and an optional internal AI skeleton. `infra/Dockerfile.web` builds and runs Next.js with Bun; the standalone output is executed with `bun apps/web/server.js`. `infra/Dockerfile.python` uses uv and non-root Python processes. Database migrations are a dedicated one-shot service, never an automatic action of every API replica.

**Production is currently blocked.** Resolve the security notice and finish P1 acceptance before exposing this scaffold. `make deploy RELEASE=<version>` now supplies guarded host-side orchestration; image publishing, immutable registry references and a clean VPS rehearsal remain required. Encrypted local backup/restore is implemented and tested; see `OPERATIONS.md`. The following commands describe the release procedure after those gates have passed.

1. Provision a Linux VPS with Docker/Compose, restricted operator SSH, DNS, and firewall access limited to SSH and HTTP/HTTPS. Choose capacity using load measurements.
2. Copy `.env.production.example` to `.env.production` and replace every placeholder. Use a unique database password of at least 24 characters, a real domain, and private R2 credentials. URL-encode the database password in `SCHOOL_DATABASE_URL`; use the original value in `POSTGRES_PASSWORD`. Restrict permissions on the environment file.
3. Build and scan versioned images in CI, publish them, and replace the local image tags with immutable release digests. The current build definitions also support local rehearsal; compiling on the VPS is not the intended release workflow.
4. Verify a recoverable pre-upgrade backup and take the required maintenance window. Stop affected workers before incompatible schema changes. Validate configuration, start dependencies, run one migration job, then start application services:

```sh
make prod-config
docker compose --env-file .env.production -f infra/compose.prod.yaml up -d --wait postgres redis
docker compose --env-file .env.production -f infra/compose.prod.yaml run --rm migrate
make prod-up
```

5. Persist the shared identity volume and set `SCHOOL_PUBLIC_ORIGIN` to the exact HTTPS origin. Open the app and use the configured setup password (default `school2036`, override with `SCHOOL_SETUP_PASSWORD` before public exposure). Complete setup and sign in with email/password. Optional demo seeding works here too and requires a chosen sample-account password; development role shortcuts are unavailable.

6. Verify HTTPS, dependency readiness, installation state, worker execution, authorization, R2 access, and streaming. Do not claim production acceptance from liveness alone.

Backups must include PostgreSQL, immutable media copies and manifests, configuration, and recovery material in a separately credentialed destination. Never use `down -v` during routine updates. Reverting an image cannot safely undo an incompatible migration; use a tested forward fix or restore. Encrypted database/identity/media backup and isolated local restore are implemented. Production R2/configuration backup coordination, offsite scheduling and production smoke rehearsal remain open.
