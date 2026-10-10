# Private file service

The current API supports personal files independently of courses or any school workflow. Every request checks an active session and file ownership; another account gets 404 for file operations. Mutation requests also require the configured Origin and session CSRF token.

1. `POST /api/v1/uploads` with filename, supported media type, byte size and SHA-256 checksum.
2. PUT bytes to the returned URL: the authenticated API in local mode, or a short-lived R2 staging URL. Never send cookies or CSRF tokens to R2.
3. `POST /api/v1/uploads/{id}/complete` to verify. Remote storage or enabled scanners use the durable worker queue.
4. Poll `GET /api/v1/uploads/{id}` or `GET /api/v1/files`. Only `accepted` files can be downloaded at `GET /api/v1/files/{id}/download`.
5. `DELETE /api/v1/files/{id}` revokes access immediately; worker cleanup removes stored bytes.

Limits: 10 MiB per upload, ten pending/verifying uploads per account, configurable `SCHOOL_MEDIA_QUOTA_BYTES` (default 100 MiB). File types: UTF-8 plain text, PDF, PNG and JPEG. Byte signatures are checked but are not full format validation. Files are always served as attachments, never inline.

Local development uses `.data/media`. Plain text can pass bounded local checks without ClamAV. Binary files require ClamAV; an unavailable scanner never permits download. Start the scanner with `make dev-full` or `docker compose -f infra/compose.dev.yaml --profile media up -d scanner`, set `SCHOOL_SCANNER_HOST=127.0.0.1`, and restart services. Signature database readiness may take time on first startup.

Set `SCHOOL_STORAGE_BACKEND=r2` with the four `SCHOOL_R2_*` values for a dedicated private development bucket. Disable public bucket access. Permit the exact browser origin, PUT, and Content-Type in bucket CORS. Staging URLs expire after five minutes. Quarantine captures one bounded object version; scanning and final delivery use that immutable capture even if a staging URL is reused. Never log signed URLs or expose storage credentials in frontend code.

Keep both Celery worker and beat running for verification retries, deletion and expired staging cleanup. The UI provides retry verification after storage/scanning recovery. Live R2 CORS, permissions, expiration and recovery need separate integration validation; mocked adapter tests do not establish live R2 correctness.

Legacy course attachments remain in their original tables and storage keys. The personal-file service does not enumerate, expose or clean them up.
