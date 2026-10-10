> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Installation, recovery and continuity

P1–P3 are for local synthetic validation until `release-status.json` is approved. Never reset `installation_state.initialized` to recover access. Never infer a new installation from an empty account table.

## Local installation

Use the pinned Bun/Python/uv versions. `make bootstrap` installs both lockfiles; `make dev` starts local infrastructure, applies migrations, and starts the API, Bun/Next.js and workers. Open `http://localhost:3000` and enter the documented setup password **`school2036`**. No operator-generated code is required. Set `SCHOOL_SETUP_PASSWORD` to override the default, especially before exposing a new installation publicly.

The first readiness or setup-status request prepares only an explicitly uninstalled migration-created singleton without a deployment UUID or existing marker. Missing state, database failure and a missing/mismatched marker on a provisioned deployment still fail closed. Setup remains permanently closed after finalization. Drafts are revisioned and survive reloads; passwords are never stored in drafts. A lost finalization response can be retried using the original session and idempotency key. Colleague activation secrets are not replayed.

Select **Start with a demo school** during first setup in either environment. Production requires a chosen demo password; development uses the documented synthetic password and provides role buttons on the login page. Demo records and installation finalize in one transaction. A failure rolls back all seeded records. Normal setup creates no demo accounts. The local-only `make seed` command uses this same flow and refuses an existing non-demo school.

`make installer-code` remains an optional operator tool for a 30-minute alternative code; issuing one revokes existing bootstrap sessions. It does not disable the configured setup password. Development shortcuts are enforced by the API, only accept recorded seed account IDs, require active unchanged accounts and the sample password, and issue ordinary authorized sessions. Production endpoints return 404. Account recovery, suspension or permission changes disable the shortcut for that account.

## Privileged recovery without email

Verify identity and school authorization out of band, obtain a second custodian's approval for a privileged account, and record a concise reason without private identity documents:

```sh
uv run --frozen python -m school2036.operator recover LOGIN --reason 'Verified by school recovery custodians; case reference'
```

Privately deliver the returned activation code. Existing sessions, password and MFA enrollment are invalidated. The recipient opens **Activate or recover an account**, chooses a new password. Roles are preserved; suspended users are not silently reinstated. Setup remains installed. Account recovery never reveals the former password.

If the database committed installation but the deployment marker could not be written, stop traffic and verify the database, deployment UUID and backup history. Reconcile only the installed marker:

```sh
uv run --frozen python -m school2036.operator reconcile-installed --deployment-id VERIFIED_UUID --reason 'Verified interrupted finalization against database and operator records'
```

A mismatch is a recovery incident, not permission to initialize another school. Retain the legacy identity key with backups for archive compatibility; current login does not decrypt MFA secrets.

## Encrypted backups and isolated restore

The format-2 tool stores a PostgreSQL custom dump, verified immutable media, application configuration (including secrets), deployment marker and MFA encryption key in one encrypted archive. Protect the backup key separately; losing both copies of it makes the archive unrecoverable. Additional proxy/DNS/operator configuration and release images require coordinated protected backup. Live R2 backup/recovery and offsite custody still require acceptance; local restore reconstructs media under the new restore directory.

```sh
uv run --frozen python -m school2036.backup keygen --key-file /secure/separate/location/backup.key
make backup KEY_FILE=/secure/separate/location/backup.key BACKUP_FILE=.data/backups/school-YYYYMMDD.enc
make restore KEY_FILE=/secure/separate/location/backup.key BACKUP_FILE=.data/backups/school-YYYYMMDD.enc RESTORE_DATABASE=school2036_restore_drill RESTORE_DIR=.data/restored-drill
```

These Make targets use the **local development** Compose PostgreSQL client. For production use the Python CLI with PostgreSQL 18 client tools and operator-configured environment, or the appropriate `--compose` file from the approved host. Do not run development Compose against production volumes. The restore database must be new and have prefix `school2036_restore_`; the output directory must not exist. A failed restore leaves an isolated database for investigation and never overwrites the source.

On restore, all sessions and pending activation codes are invalidated, and pending/running/retrying jobs are cancelled. MFA secrets, account roles, audit history and installed state are retained. The restored `source-configuration.json` contains source secrets and paths: keep it private and review/change every target before reuse. Configure an isolated API with the restored database, marker and identity key; verify login, permissions and installed state before routing users to it. Do not restart outbound processing until approved.

`tests/test_restore.py` creates disposable source/restore databases, uses real `pg_dump`/`pg_restore`, rejects a wrong key, and verifies password sign-in and cancelled jobs. The tool buffers the archive in memory; large-school capacity and real R2 recovery must be measured before production. The local test also deletes and restores a verified immutable media object. A logical dump is not point-in-time recovery. Schedule daily encrypted offsite copies and alert on missed backups; scheduling, offsite custody and accepted RPO/RTO remain deployment acceptance tasks.

## Jobs, health and incidents

Celery beat scans the durable outbox every 10 seconds. Run one beat scheduler per installation. The worker consumes `system.health`, `media.verify` and `media.cleanup`; unknown handlers retry at most three times then become failed. Media verification rechecks the uploader's current course authorization; missing scanners/storage never mark files accepted. Stale running leases recover after 300 seconds. Other future domain jobs need current authorization checks and external idempotency before being enabled. Redis loss must not delete durable jobs.

Liveness is `/api/v1/health/live`; readiness also checks PostgreSQL, the deployment marker and Redis. `/api/v1/operations` exposes the latest recorded backup and job-state counts to administrators. None of these substitutes for R2, HTTPS, recovery or load acceptance. Set alerts for failed readiness, failed/old jobs, missed daily backups, storage above the accepted threshold and expiring certificates.

Incident sequence: restrict proxy access; preserve evidence in controlled storage; revoke affected sessions or suspend accounts; rotate compromised technical credentials; investigate audit events and backup history; restore into isolation if necessary; obtain school approval before communication and reopening. Do not log passwords, activation codes, MFA secrets or signed R2 URLs. School-appointed contacts and escalation timings are required before live deployment.

## Upgrade and rollback

`make deploy RELEASE=<immutable-version>` runs on an approved VPS checkout after an operator establishes SSH access. It requires the release gate, explicit target acknowledgement and a pre-upgrade backup path. It pulls configured images, stops API/worker/beat, migrates, then starts without building. It has not been rehearsed on Contabo. Production image registry/digest configuration and a verified backup are required first.

A failed migration/start leaves maintenance in place. Do not automatically downgrade the schema. Prefer a reviewed forward fix; otherwise restore the verified pre-upgrade backup to a new database and route the matching prior images to it after smoke checks. Never use `docker compose down -v` for an update.
