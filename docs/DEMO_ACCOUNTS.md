# Populated local demo accounts

The four local `student`, `teacher`, `advisor` and `parent` accounts
(originally `demo.student`, `demo.teacher`, `demo.advisor`, `demo.parent`) are real authenticated accounts using the same Pearl interface and Python
services as other accounts. Their example records are fictional and persist across
sign-ins. They use ordinary database authentication; they are not fixture personas.

Existing passwords are kept in the ignored private `.data/hackathon-accounts.json`
receipt. Do not publish that file or put its contents in a screenshot. The seed tool
never creates accounts, resets passwords, grants roles or restores revoked links.
Provisioning remains the operator's responsibility.

## Add examples

Run from the repository root with the local development configuration:

```sh
UV_CACHE_DIR="$PWD/.cache/uv" uv run --frozen python -m school2036.demo_seed
```

The command requires `development`, a loopback PostgreSQL hostname, a regular
private receipt (mode `0600`), matching credentials for exactly those four logins,
and their existing teacher/advisor/parent relationships to the same demo student. It
validates all of these before writing. Other accounts and relationships are not
modified.

The account display names become Lina Haddad, Elie Daher, Maya Nassar and Karim
Haddad only if they still have the original generic `Demo Student`/etc. names.
Later custom names are preserved. The seed adds three assignments (to do, awaiting
teacher feedback and reviewed), a student/advisor exchange, three learning
proposals (advisor review, parent review and approved), and two transcript drafts.
Titles and transcript content identify the fictional examples. It does not invent
watch progress, unread markers, provider citations, recordings or assessment data.

Stable record IDs make repeated runs additive. Existing answers, decisions,
transcript edits, failed/deleted lessons, passwords and sessions are preserved.
An explicitly removed publication is not restored on a later run.

## Prepare one real study source

An explicit option approves the short synthetic physics transcript and queues the
normal durable RAG ingestion job:

```sh
UV_CACHE_DIR="$PWD/.cache/uv" uv run --frozen python -m school2036.demo_seed --queue-study
```

This can use provider credits. It queues at most that one initial transcript; it
does not call answer generation or transcription. Keep the worker and configured
RAG service running. The lesson becomes ready only after the real provider returns
a successful source receipt; the command never fabricates a source ID or marks a
lesson ready itself. Provider failures remain visible in Study and can be retried
there. A transcript edited by the user is not approved by the seed option.

After the teacher's physics lesson is ready, run the default command once more to
publish it to the demo student through the existing responsibility link. The
student's separate notes stay in transcript review, so the review/approval flow can
be demonstrated. All sharing and retrieval continue to use ordinary authorization.

`tests/test_demo_seed.py` exercises safety gates, atomic rejection, preservation,
idempotence and publication after the normal worker path. Tests use an injected
provider double and disposable PostgreSQL schemas; they make no paid API calls.

## Populate Files with verified source documents

```sh
UV_CACHE_DIR="$PWD/.cache/uv" uv run --frozen python -m school2036.demo_seed --with-files
```

This adds one small synthetic TXT document to each of the four demo accounts:
physics session notes, personal study notes, advisor guidance and a family study
plan. It requires local development storage in addition to the guards above.
The option can be combined with `--queue-study`.

The tool uses the same `UploadInput` validation and `new_upload` domain operation
as the upload API, writes the declared bytes to staging, and queues the ordinary
`personal_media.verify` job. The real worker applies checksum, content and configured
scanner checks before a file becomes downloadable. It never sets `accepted` or a
final storage key. Files stay private to their respective accounts; uploads are
not automatically added to RAG. Use **Use for study** and the ordinary transcript
review flow to prepare an uploaded document.

The staging record is committed before writing bytes, so an interrupted storage
write can resume against the same pending upload. Durable seed receipts preserve
rejections and deletion requests: repeated runs do not overwrite accepted content,
replace rejected files or resurrect deleted files. An expired pending upload is
left for ordinary cleanup rather than receiving a new expiry or bypassing limits.
The school examples and each staging transaction commit independently, so storage
failure can leave earlier examples saved; rerunning resumes the remaining steps.
No signed R2 uploads or remote storage writes are performed by this helper.

## Explicit hackathon login simplification

The requested local hackathon logins are `student`, `teacher`, `advisor` and `parent`.
Run the guarded one-time operator command to rename the original four accounts:

```sh
UV_CACHE_DIR="$PWD/.cache/uv" uv run --frozen python -m school2036.demo_seed --simple-logins
```

This explicit development-only operation sets the user-requested simple hackathon
password on those four accounts, preserves account IDs and all related work, and
revokes their existing sessions. It does not create identities, grant roles, change
other accounts or weaken the normal 15-character password policy. Simple shared
hackathon credentials are unsuitable for a public deployment.

The command verifies all four original credentials and relationships before any
write and refuses a login collision. The private receipt is refreshed with the same
account IDs. Renamed receipts require a matching per-account operator audit event;
the seed cannot repurpose an arbitrary account that happens to use a role name.
Repeated simplification is a no-op when already applied. Default seeding remains
additive and preserves the current password. If receipt replacement fails after the
database commit, retain the generated private `.pending-*` receipt for operator
recovery; do not repeat credential changes blindly.

## Saved community walkthrough

The October 10 local walkthrough added fictional examples through authenticated
application endpoints: Lina's astronomy interest and telescope activity request,
Elie's makers event, and an astronomy exploration report that Lina explicitly
reviewed and shared with Elie and Karim. The report was drafted using the real
configured model. These are saved local database records, not runtime UI fixtures;
the original seed command does not recreate this later walkthrough.

The local four-account dataset has only one student. It intentionally does not
invent two additional opt-ins to enable the teacher's AI activity button. That
button requires three distinct linked students; the disposable browser suite
provisions three real test accounts to verify the complete suggestion workflow.
