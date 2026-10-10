# Foundation operations

Run `make dev` for the local API, web, worker, beat, PostgreSQL and Redis. `make dev-full` adds ClamAV, Mailpit and the health-only AI placeholder. `make infra-down` stops infrastructure without deleting volumes.

Use `make create-user LOGIN=you@example.com NAME="Your Name"` to provision an account locally. This uses the migrated installation singleton and writes a deployment marker; it never infers a fresh installation from an empty account table. Creating another account leaves existing accounts unchanged. Password reset is the local `school2036.operator reset-password --login ...` command and revokes sessions.

If initialization commits but writing its marker fails, the API fails closed. An operator can inspect the database's explicit deployment ID and run `uv run --frozen python -m school2036.operator reconcile-installed --deployment-id ID --reason "verified recovery reason"`. Do not delete installation records to reopen setup.

Liveness: `/api/v1/health/live`. Readiness: `/api/v1/health/ready` verifies installation state and Redis availability; it does not certify R2 or scanner readiness. No endpoint returns credentials.

Encrypted database/personal-media backup and isolated restore tooling remains in `school2036.backup`. Generate a separate key with `uv run --frozen python -m school2036.backup keygen --key-file /private/path/backup.key`. Use `make backup KEY_FILE=... BACKUP_FILE=...` and `make restore KEY_FILE=... BACKUP_FILE=... RESTORE_DATABASE=school2036_restore_rehearsal RESTORE_DIR=...`. The restore target must be new; restore revokes sessions, activation codes and pending jobs. Protect restored source configuration: it contains credentials.

Backups include the database and accepted personal-file objects. **Legacy course attachment bytes require a separate storage backup**; their database rows are retained, but the reset service does not inventory that old storage. Do not delete old buckets, `.data`, volumes or recovery keys. The source snapshot in `/tmp` is not a data backup.

Production recovery, offsite storage and live R2 restores require a new rehearsal before release. Never automatically downgrade or erase a database after a failed deployment.
