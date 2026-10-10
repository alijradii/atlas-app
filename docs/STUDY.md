# Study sessions and optional lesson sources

`/study` is the real authenticated workspace. `/preview/*` is available only in the browser-test harness. Fixture identities do not grant real access. Teacher-published lessons
require an explicit, currently valid student relationship; see [SCHOOL.md](SCHOOL.md).

Study uses the same Pearl sidebar, message renderer, composer and collapsible
assistant dock as the main interface. On Study, that persistent dock is mounted
inside the main conversation column, in normal page flow, and keeps its collapse
control. It reserves its own space beside the source library instead of floating
across it. On other authenticated screens it remains a floating dock.
The source library stays next to the
conversation (above it on narrow screens). Home questions transfer as private
in-memory drafts. Start talking to create a saved session directly; selecting sources
is optional.
Nothing is automatically submitted or indexed by opening the screen. The sidebar's
New chat action opens a fresh composer without deleting saved conversations.

## Use it

1. Provision an account with `make create-user`, then sign in at `/login`.
2. Open `/study` and send a question to start a general study session immediately.
   It uses the same saved history, run status and cancellation controls as source-based
   study, without requiring retrieval configuration or accessing your library.
   To ground answers in your material, add a lesson title, optional subject and transcript. Paste text
   or import a text/Markdown file. Accepted transcript length is 30–45,000 characters.
   Alternatively upload a document or recording in `/files`, then choose **Use for study**.
   Text/PDF/DOCX extraction and audio/video transcription produce a review draft, not immediate evidence.
   Open it in Study, correct the transcript, then **Approve and prepare lesson**.
3. Wait for preparation: `queued → indexing → ready`, or an explicit `failed` state.
4. Optionally select one to eight ready lessons and start a conversation. Selection is fixed
   for that conversation; start another to study a different set.
5. Ask a question. General tutoring progresses from queued to answering and has no
   source citations. Selected-source sessions also retrieve evidence; grounded replies
   include numbered references and literal source quotations.
6. Owners can grant lesson access to another active account by login and revoke it
   later. Shared readers make their own private conversations; sharing a lesson does
   not share its owner's chat history.

Questions are limited to 2,000 UTF-8 bytes. For a selected-source session, if retrieval finds no supporting passages,
the assistant reports that limitation without calling the answer model. A missing
hit is not proof that the material contains no answer. Answers are AI-generated;
citations let readers inspect the evidence, not certify every generated claim.

Recordings up to 20 minutes/50 MiB can be transcribed through Gemini. The server extracts
mono audio locally; it does not send video frames. Timestamps are approximate and the
owner reviews the resulting transcript before indexing. PDF extraction reads the text
layer (up to 300 pages); it does not interpret diagrams or perform OCR. DOCX imports
read the main document body. There is no live recording or class-joining feature.
The study assistant does not grade official assessments or execute actions suggested by model text. The study model has no executable tools. The supplied service's separate MCP
adapter is not exposed directly to users; the app uses its authenticated HTTP API.

General sessions never search all private materials implicitly. They make a bounded
Gemini tutoring request using the recent conversation and encourage the learner to
reason through a focused next step. This is a prompt-level behavior, not an enforced
independent-assessment mechanism. Source scope is fixed when a session is created.

## Configure the providers

Use the repository's private root `.env`; do not commit real values:

| Variable | Purpose |
| --- | --- |
| `SCHOOL_RAG_URL` | Private service URL; local default `http://127.0.0.1:8081` |
| `SCHOOL_RAG_API_KEY` | Independently generated service secret, 32+ ASCII characters |
| `SCHOOL_GEMINI_API_KEY` | Gemini key used server-side for embeddings and answers |
| `SCHOOL_STUDY_MODEL` | Answer model; default `gemini-2.5-flash` |
| `SCHOOL_STUDY_DAILY_REQUESTS` | Per-account answer requests per rolling 24 hours; default 50 |
| `SCHOOL_RAG_SPEND_LIMIT_USD` | Retrieval service's durable estimated-spend ceiling; default 1 |
| `SCHOOL_RAG_PYTHON` | Optional compatible existing Python 3.12 interpreter |

Generate a service key locally with `python -c 'import secrets; print(secrets.token_urlsafe(32))'`.
The provider account key is separate. Neither key is a browser setting.

```sh
make rag-install  # one-time, isolated .tools/rag-venv, Python 3.12
make dev          # starts retrieval when both provider keys are present
```

`make rag-install` uses the vendored hash-locked HTTP dependencies. It needs network
access and substantial disk space for the parser stack; it downloads no OCR model
weights. The main application retains its separate Python 3.14/uv environment.
For a compatible existing installation, set `SCHOOL_RAG_PYTHON` instead of installing
another environment. Do not put a machine-specific absolute path in committed config.
`make rag-dev` runs only retrieval; avoid starting a second instance on the same data.

File import requires a verified, owned upload. Imports follow `queued → extracting → review`;
approval then follows `queued → indexing → ready`. Failed extraction or indexing is
retryable deliberately. A durable completed transcript is retained when extraction
acknowledgement is recovered after approval. Twenty extraction attempts per account
per rolling day include retries; repeated import of the same active file returns its
existing lesson. Only ready material can be selected or published by a teacher.

Conversions run with byte/page/duration limits, a wall-clock timeout and Linux process
memory/CPU/output limits. These are not a full parser sandbox. Native converters must
be available on the worker. Temporary conversion directories are removed after use.

The runner uses structural chunks (no paid contextual chunk planner), loopback port
8081 and `.data/rag`. Text/Markdown needs no OCR weights. Indexing still sends text
for Gemini embeddings; hybrid questions send an embedding request. Answer generation
is a separate Gemini request, using the bounded retrieved evidence and recent history.
The RAG spend ledger does **not** account for transcription or answer-generation charges and is not a
provider billing cap. Set account-level budgets/alerts independently.

The vendored service originated at team handoff commit `7a4ebe9`; see its
[README and licenses](../services/rag-anything/README.md). Atlas uses RAG-Anything
parser components, MinerU and Milvus Lite. MinerU has explicit attribution and
commercial-use terms; the entire stack is not represented as MIT.

## Access, persistence and run controls

The API resolves application lesson IDs into authorized source IDs. Every search
uses an explicit list and hybrid mode; none may silently become an all-library
query. Returned source identities are verified before model input. Raw service IDs,
service-key-bearing links and provider error bodies are not returned to the browser.

Lessons, access grants, conversations, messages and job state persist in PostgreSQL.
The retrieval source library/index and spend ledger persist separately in `.data/rag`.
The browser keeps private study data in memory, not local storage. Stale responses
are discarded on account changes; session expiry clears private workspace state.

Revoking a grant or deleting a lesson denies further source access and hides affected
conversation history/citations. The worker rechecks authorization and session state
before generation and before saving its result. Already viewed/copied content cannot
be recalled. Removing a lesson or conversation is currently logical deletion; it is
**not physical erasure** from PostgreSQL backups or the RAG library.

Stop marks an active run cancelled; later output is discarded. An already dispatched
provider call may continue and incur charges. A retry is deliberate new work. Reusing
a message's UUID request key with the same text returns its existing run, while
reusing it with different text is rejected. Lost job leases cannot publish stale
answers or trigger automatic repeat provider charges. Retrying failed ingestion may
create an additional source document because the service has no upload-idempotency
or delete endpoint.

Limits also include 40 non-deleted lessons per owner, 100 non-deleted conversations
per owner, 100 messages per conversation and one active answer per account. Retrieved
context is capped at six passages/24,000 characters; recent history is bounded to
12 turns/12,000 characters and answer output to 2,048 tokens.

## Verification

The main harness includes `tests/test_study.py` (real database, deterministic provider)
and `tests/test_study_providers.py` (HTTP mock transports, no paid calls). It exercises
session/CSRF protections, tenant isolation, grants/revocation, source scope, duplicate
requests, cancellation, logout/expiry during generation, deleted sources, stale job
leases, partial-provider responses, timeouts, bounded context and citation identities.

Run normal `make check`, `make build`, `make audit` and browser tests. The vendored
Python 3.12 service also has 116 deterministic tests in `services/rag-anything/tests`;
run them in its compatible test environment, separately from Python 3.14. Provider
adapter tests and service tests do not establish live account credentials/quota.

A bounded real-provider smoke test on October 10, 2026 ingested a synthetic Newton's
law transcript and returned a correctly cited answer in 8.57 seconds. This verifies
one configured local end-to-end path, not general retrieval quality, load capacity
or production readiness. Do not turn paid smoke tests into default CI jobs.

## Remaining production work

Production approval remains false. The vendored dependency audit currently fails
with findings in four packages; see [the recorded audit](SECURITY.md#vendored-rag-dependency-audit--october-10-2026).
In addition to the recorded application release blockers, this service needs load/deployment validation, stronger parser isolation,
physical retention/erasure and a coordinated PostgreSQL/RAG backup-restore rehearsal.
Milvus Lite currently uses one process and retrieval/ingestion is serialized. The
application's private-source authorization is implemented; it does not make the
upstream library API safe to expose publicly. See [security](SECURITY.md) and
[operations](OPERATIONS.md) before using real school records.

## Original files and classroom access

A shared lesson grants access to its reviewed transcript and its attached original file.
The original is delivered as an attachment only after checking current lesson access
and accepted file state. Deleting the original removes file access immediately but
keeps an already extracted transcript; delete that lesson separately if desired.
Deleting or unpublishing a lesson rechecks source access for conversation history too.
Teacher publications grant linked students access independently of direct sharing;
see [SCHOOL.md](SCHOOL.md). School location is never an authorization input.

The transcription adapter uses Gemini's documented inline audio `generateContent`
interface, with an application limit below the provider's advertised upload limits.
See [Google's audio input documentation](https://ai.google.dev/gemini-api/docs/audio).
A short synthetic speech check verified this configured path locally; it is not a
claim of transcription accuracy across accents, languages or noisy classrooms.


### Persistent assistant integration

The dock lives above page routes and remains available in Files, Account and school
screens. Study session uses the normal study API, with or without selected lessons;
Ask Atlas switches to the UI-help agent without a second floating input.
Suggested study questions now send a real request against that conversation's
selected sources. They are disabled while a request is active. Interface guidance
uses the separate read-only MCP catalog and cannot retrieve private lesson text.
