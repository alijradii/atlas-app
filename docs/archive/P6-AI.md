> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P6 — Governed source-grounded assistance

Implemented October 9, 2026. AI remains disabled by default. No school-approved model endpoint or teacher-reviewed real-model results were supplied in this session. The implementation and synthetic integration checks do **not** establish educational quality, learning improvement, or R2 release acceptance.

## What is implemented

| Plan requirements | Implementation |
|---|---|
| ADM-10, AIF-07–09 | Revisioned administrator policy, individual capability selection, local/external/disabled modes, explicit external-purpose approval, separate submission-processing approval, provider/model/prompt/corpus fingerprints, teacher evaluation review, usage reservations, retention and reported-issue suspension. |
| KNW-03 | Durable ingestion queue for published course editions; authored section references, UTF-8 text and page-referenced PDF extraction; checksum verification; unsupported-file, unreadable-scan, partial-coverage and processing-limit reports. |
| KNW-04, AIF-03 | PostgreSQL simple-language full-text ranking; optional approved embeddings and pgvector cosine ranking, fused by reciprocal rank; narrow questions, cross-source comparisons, broad document coverage and course overviews. Exact citation quotes and passage identifiers are checked. |
| AIF-01–04, STU-10–12 | Assigned teacher/student workspaces; activity-specific independent, learning and production modes; younger defaults; attempts required for hint levels 2–3; practice and alternative explanations; explicit source selection and coverage; unsupported outputs fail closed. |
| AIF-05–06, KNW-05, TCH-14 | No model-controlled tools. Explicit, authorized user actions create private revision tasks or teacher-reviewed content drafts. Practice becomes an assignment draft; rubric and plan alternatives become reusable template drafts. Feedback addresses one exact submission and remains invisible until teacher approval. |
| TCH-15, AIF-07 | Owners see their own assistance history. Assigned teachers receive deliberately reported issues; administrators see category/state counts without private narratives or conversations. Open privacy/safety/injection reports pause AI. Resolving these reports invalidates the model evaluation and requires another evaluation before enabling it. |
| ASM/PLN integration, AT-18 | AI-assisted practice cannot write evidence, validate mastery, alter prerequisites or approve learning plans. Existing declared and observed assistance remain distinct. Plan alternatives are human-readable drafts for the existing reviewed P5 process. |
| AT-15–19, AT-29 baseline | Sensitive notes/profiles are excluded from retrieval; current permissions are checked at request, execution, delivery and draft approval; cancellation wins over late responses; provider waits occur outside school transaction locks; separate AI/ingestion workers and queue limits protect core traffic. |

Generated output renders as plain text. Source links supplied by users are never fetched by the model workflow. Only published material in the current assigned course is eligible. A student cannot include an independent-assessment assignment as a source for another activity. Source editions, file acceptance and membership are rechecked. Derived content retains source lineage even when a teacher edits it; withdrawal of an ancestor blocks further disclosure/publication. There is no cross-user response cache.

Optional parent explainers and administrative AI summaries are not enabled. Parent reporting is still part of unfinished P4 work. They are optional P6 extensions, not claims made by this release.

## Operator setup and approval

1. Apply migration `c63a2048e912` with `make migrate` after the existing P5 migration. Continue using Python 3.14/uv and Bun 1.4.2.
2. Configure the provider in an uncommitted environment file. Set `SCHOOL_AI_PROVIDER_MODE` to `local` or `external`, `SCHOOL_AI_PROVIDER_URL` to the provider's versioned API base, `SCHOOL_AI_MODEL` to a pinned model identifier, and a randomly generated `SCHOOL_AI_SERVICE_SECRET` of at least 32 characters. Use `SCHOOL_AI_PROVIDER_KEY` if required. The adapter supports the chat-completions JSON protocol implemented by [llama.cpp's server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) and compatible approved providers. Select and evaluate the actual deployment; an API-compatible protocol is not evidence that every model works.
3. Run `make dev-full` locally. API, AI service and web listeners remain localhost-only. The AI service receives bounded source packets over a payload-bound HMAC context that expires after 60 seconds, with replay rejection and opens no domain database connection. Production includes separate `worker-ai` and `worker-ingestion` services under the `ai` profile. The production AI service overrides the database URL with a nonfunctional credential. Production deployment remains blocked by the existing release gates.
4. With **synthetic data only**, run `uv run --frozen python -m school2036.ai_evaluate`. This invokes the configured real provider and records a pending evaluation. It sends only the checked-in synthetic corpus, not school records. The operator must have authority to provision and test that destination. The runtime adapter has no deterministic production fallback.
5. A teacher opens **Learning with AI → Model evaluation and educational review**, reviews every representative output and records their educational judgment. Automated failures and synthetic fixtures cannot be approved. The dataset covers precise questions, whole-document coverage, comparisons, absent evidence, contradiction, Arabic/mixed language, malicious instructions, revoked-corpus abstention, hints, lessons, feedback and plan alternatives. Real membership revocation is covered separately by API tests.
6. An administrator chooses the approved evaluation, allowed capabilities, data-processing purpose, mode, submission policy, retention and usage limits. External inference requires separate explicit approval. Changing the model, destination, embeddings model, system prompt or corpus invalidates the approval fingerprint.
7. An assigned teacher publishes source material, sets the activity's assistance policy and queues extraction. Students then choose the activity and sources. Independent mode denies built-in assistance; it does not enforce device-wide independence.

No provider credentials, model binaries, environment files or school records are committed. The full checks used deterministic inference exclusively in isolated tests; they do not count as real-provider acceptance.

## Vector retrieval

`infra/Dockerfile.postgres` builds pgvector **0.8.7**, verifying the upstream release archive SHA-256, on the same pinned PostgreSQL 18 Alpine base already used by the project. The optional `infra/compose.vector.yaml` overlay changes the PostgreSQL image without changing its volume layout. Take and verify a backup before any actual database-image upgrade.

For an isolated conformance database, without touching the development school database:

```sh
docker compose -f infra/compose.vector-test.yaml up -d --build --wait
SCHOOL_VECTOR_TEST_DATABASE_URL=postgresql+psycopg://school:school@127.0.0.1:5433/school2036 make check
docker compose -f infra/compose.vector-test.yaml down
```

For a chosen installation, its operator must install `CREATE EXTENSION vector` in an operator-owned schema after selecting the vector image. Configure `SCHOOL_AI_EMBEDDING_MODEL` and obtain a matching evaluation/approval before indexing. Requeue previously text-only sources to create embeddings. If indexing fails, sources state that keyword retrieval is being used. Only same-fingerprint vectors participate in retrieval.

Vectors are stored alongside section records as portable JSON and cast to pgvector for exact cosine comparisons over the already-authorized subset. This avoids approximate-index filtering recall loss. It is deliberately bounded exact search, not a claimed large-corpus approximate nearest-neighbor index. Full-school load/recall benchmarking must precede widening the pilot. The [pgvector documentation](https://github.com/pgvector/pgvector) describes vector/full-text combinations and filtered-search considerations.

## Bounds, recovery and operational behavior

- Up to 20 pending/running generation jobs and 20 ingestion jobs; inference service concurrency 1–4 (default 2). Worker/provider timeouts are bounded. A running request is never automatically resent after an ambiguous crash: interrupted requests expire and require a new user request, avoiding duplicate provider charges.
- Up to eight sources per request, 300 indexed sections per source, 1,800 characters per section and 40 broad-summary passages. Narrow questions/comparisons select at most eight passages. Broad workflows select across document structure and **explicitly report sampled coverage**, not a claim to have read all chapters. Oversized course overviews return a limit error. Complete book-scale hierarchical summaries remain a scaling extension requiring evaluated workflows.
- PDFs run in a disposable process with a 512 MiB address-space limit, 10 seconds of CPU, a 15-second wall timeout, 300-page and 500,000-character extraction bounds. Scans receive an explicit no-readable-text notice; there is no OCR or audio/video transcription claim. Authored timestamps and other reference text remain attached to passages.
- Daily school/user request limits and conservative maximum-cost reservations are enforced transactionally. Configure spending units as a school-chosen money subdivision and set **a verified upper bound per bounded provider call**; this is a reservation ledger, not a provider invoice reconciliation service. Semantic requests reserve two calls; ingestion reserves eleven calls. Failed/cancelled attempts are not refunded because providers may still charge. Model token counts and latency are retained when available.
- Raw questions/attempts are erased after completion/failure/cancellation. Queued requests expire after an hour, interrupted generation after three minutes, and retained responses after the configured 1–30 days. Regular general-worker maintenance also purges data while inference is disabled. Audit events hold identifiers/versions/usage, not conversation text. Completed feedback retains its exact submission identifier.
- A privacy/safety/injection report pauses generation until review and reevaluation. Suspended accounts, revoked assignments, retired/replaced source editions and changed assistance policies prevent delivery of previously generated output.
- Encrypted backups include source sections/vectors, policies, evaluations, tasks, provenance and issues. Restore cancels pending AI work, clears queued request payloads and disables school AI policy. Operators and staff must review processing approval before reenabling it. Existing media, credential/session and institutional-history recovery safeguards remain.

## Acceptance still required

The corpus runner also checks multilingual embedding recall when an embedding model is configured. Run the corpus and multilingual retrieval tests on each proposed **real** model configuration; have teachers approve factual support, abstention, usefulness, age suitability, latency and cost thresholds. Benchmark recall after permission filtering and sustained mixed API/AI/ingestion load on chosen hardware. The automated blocked-provider test proves local lock isolation, not production saturation capacity. Native rubric editing, complete course-scale hierarchical summary generation, and structured plan alternatives remain workflow extensions beyond the text drafts currently offered; no autonomous assessment or progression action is supplied.

R2 is not release-approved: P4/R1 work, school policy/user validation, complete Arabic workflow localization/manual accessibility, existing production controls, the recorded Next.js security notice and live R2/Contabo/offsite recovery gates remain open. See `PHASE-STATUS.md`, `SECURITY.md` and `VERIFICATION.md`.
