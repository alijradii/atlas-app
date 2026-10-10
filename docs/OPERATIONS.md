# Application operations

Run `make dev` for the local API, web, worker, beat, PostgreSQL and Redis. With both study provider keys configured, it also starts the isolated retrieval service on loopback port 8081. `make dev-full` adds ClamAV, Mailpit and the health-only AI placeholder. `make infra-down` stops infrastructure without deleting volumes.

Use `make create-user LOGIN=you@example.com NAME="Your Name"` to provision an account locally. This uses the migrated installation singleton and writes a deployment marker; it never infers a fresh installation from an empty account table. Creating another account leaves existing accounts unchanged. Password reset is the local `school2036.operator reset-password --login ...` command and revokes sessions.

If initialization commits but writing its marker fails, the API fails closed. An operator can inspect the database's explicit deployment ID and run `uv run --frozen python -m school2036.operator reconcile-installed --deployment-id ID --reason "verified recovery reason"`. Do not delete installation records to reopen setup.

Liveness: `/api/v1/health/live`. Readiness: `/api/v1/health/ready` verifies installation state and Redis availability; it does not certify R2 or scanner readiness. No endpoint returns credentials.

Encrypted database/personal-media backup and isolated restore tooling remains in `school2036.backup`. Generate a separate key with `uv run --frozen python -m school2036.backup keygen --key-file /private/path/backup.key`. Use `make backup KEY_FILE=... BACKUP_FILE=...` and `make restore KEY_FILE=... BACKUP_FILE=... RESTORE_DATABASE=school2036_restore_rehearsal RESTORE_DIR=...`. The restore target must be new; restore revokes sessions, activation codes and pending jobs. Protect restored source configuration: it contains credentials.

Backups include the database (including study transcripts, grants and conversation records) and accepted personal-file objects. **They do not include `.data/rag` indexes, source copies or the RAG spend ledger.** Back up that directory separately with the retrieval process stopped; coordinate it with the database snapshot so source identities remain consistent. Study jobs/conversations from a restored database need a recovery check before resuming service. **Legacy course attachment bytes require a separate storage backup**; their database rows are retained, but the reset service does not inventory that old storage. Do not delete old buckets, `.data`, volumes or recovery keys. The source snapshot in `/tmp` is not a data backup.

Production recovery, offsite storage and live R2 restores require a new rehearsal before release. Never automatically downgrade or erase a database after a failed deployment.

## Study runtime and recovery

Follow [STUDY.md](STUDY.md) for setup and limits. `make rag-install` prepares a
separate Python 3.12 environment; the application backend remains Python 3.14.
`make rag-dev` starts retrieval alone, so do not run it alongside the automatic
`make dev` instance. Only one retrieval process may own `.data/rag`. Its health
endpoints are `/health/live` and authenticated `/health/ready`; readiness reports
local process/library state, not Gemini credentials, quota or successful indexing.
The authenticated application `/api/v1/study/status` likewise reports configuration
presence, not provider availability.

Keep worker and beat running for ingestion and answers. The UI polls queued/indexing
lessons and queued/retrieving/answering runs. Errors become explicit failed states.
A failed lesson can be retried by its owner; retries can create another provider
document and incur fresh embeddings. A failed/cancelled answer requires a deliberate
new request. Duplicate delivery of the same request ID/content does not enqueue a
second answer. Interrupted provider work is not automatically replayed after a lease
is reclaimed, because a prior call may already have been charged.

If retrieval is busy, wait for current indexing/search to finish, then retry the
failed action. Never repair access by sending an omitted source scope, using the
service catalog as authorization, deleting the spend ledger or copying another
user's source ID. Do not delete an entire shared RAG directory to erase one lesson.

Monitor provider billing separately from the RAG estimated-spend ledger. Restarting
with the same data directory retains that ledger. Raising its ceiling is an explicit
operator decision, not a troubleshooting default. The current default transcript
limit is 40 per owner; conversations are capped at 100 per owner, 100 messages each,
and at most one active answer per account, with 50 requested answers per rolling
24 hours by default. See `SCHOOL_STUDY_DAILY_REQUESTS` for the configurable request
limit.

Single-worker Milvus Lite, serialized retrieval, parser isolation hardening, physical
retention/deletion, load validation and full deployment/recovery checks remain
production work. The existing deployment templates are not proof that the new RAG
service is provisioned, supervised or backed up in production.
