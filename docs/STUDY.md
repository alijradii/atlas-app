# Transcript-based study

`/study` is the real authenticated workspace. `/preview/*` remains a design/sample
workspace. Preview identities and school-policy switches do not grant real access.

## Use it

1. Provision an account with `make create-user`, then sign in at `/login`.
2. Open `/study` and add a lesson title, optional subject and transcript. Paste text
   or import a text/Markdown file. Accepted transcript length is 30–45,000 characters.
3. Wait for preparation: `queued → indexing → ready`, or an explicit `failed` state.
4. Select one to eight ready lessons and start a conversation. Selection is fixed
   for that conversation; start another to study a different set.
5. Ask a question. The run progresses through queued, retrieving and answering.
   Completed replies include numbered references and literal source quotations.
6. Owners can grant lesson access to another active account by login and revoke it
   later. Shared readers make their own private conversations; sharing a lesson does
   not share its owner's chat history.

Questions are limited to 2,000 UTF-8 bytes. If retrieval finds no supporting passages,
the assistant reports that limitation without calling the answer model. A missing
hit is not proof that the material contains no answer. Answers are AI-generated;
citations let readers inspect the evidence, not certify every generated claim.

This release imports **existing transcripts**. It does not record/transcribe audio,
join live classes, grade official assessments or perform actions suggested by model
text. The study model has no executable tools. The supplied service's separate MCP
adapter is not exposed directly to users; the app uses its authenticated HTTP API.

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

The runner uses structural chunks (no paid contextual chunk planner), loopback port
8081 and `.data/rag`. Text/Markdown needs no OCR weights. Indexing still sends text
for Gemini embeddings; hybrid questions send an embedding request. Answer generation
is a separate Gemini request, using the bounded retrieved evidence and recent history.
The RAG spend ledger does **not** account for answer-generation charges and is not a
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
