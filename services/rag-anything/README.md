# Atlas transcript retrieval service

Vendored from the team's `hackathon` repository, commit **7a4ebe9** (2026-10-10),
`services/rag-anything`. Source, tests and dependency hash locks are retained;
credentials, evaluation documents/results, installed packages and parser models are not.
Atlas's API owns authentication, document ownership and conversation authorization.
The service key is backend-only and grants access to the entire retrieval library.

## Run locally

Use Bun 1.4.2 from the Atlas repository root:

```sh
bun run scripts/rag-dev.ts --install
bun run scripts/rag-dev.ts
```

The installer uses `uv` to create `.tools/rag-venv` with Python 3.12 and installs the
complete HTTP service hash lock (Linux x86-64, CPU packages). This environment is
separate from Atlas's Python 3.14 backend. Installation is large because the supplied
parser stack supports more than text. Parser model weights are not downloaded.
Set `SCHOOL_RAG_PYTHON` to an existing compatible Python 3.12 environment to reuse a
local installation without modifying it. Do not use the application's Python 3.14 venv.

Root `.env` supplies `SCHOOL_RAG_API_KEY` (at least 32 ASCII characters) and
`SCHOOL_GEMINI_API_KEY`. The runner binds **127.0.0.1:8081**, stores new data under
`.data/rag`, disables contextual planning (`structural` chunks), and limits the RAG
ledger to **$1** unless `SCHOOL_RAG_SPEND_LIMIT_USD` explicitly changes it. Gemini
embeddings and hybrid retrieval still incur provider usage. This service ledger does
not include Atlas's separate answer-generation requests. It is an estimated usage
reservation control, not an account-wide provider billing limit. Startup does not
call Gemini. Never reuse somebody else's document/index directory.

Only the authenticated Atlas API should call this service. Always send explicitly
authorized `source_ids` with hybrid retrieval; omission selects all ready documents.
The returned passages are literal evidence, not an answer. Atlas's provider adapter
rejects partial outcomes and mismatched source identities before answer generation.

Text and Markdown transcripts require no OCR weights. Other document formats are
not exposed by Atlas's transcript UI; PDF/image parsing needs separately installed
parser models. Audio transcription is not provided here: import an existing transcript.

## Limits and provenance

This is the team's serialized, single-worker Milvus Lite service, not a horizontally
scalable production deployment. One process per data directory is mandatory. It has
no document deletion API; removing a transcript from Atlas must revoke retrieval
access in Atlas's database. Service storage still needs a retention/deletion policy.

See [HTTP contract](docs/api.md), [operations](docs/operations.md) and
[component provenance](docs/stack-and-modifications.md). Source behavior is retained;
Atlas's bounded runner and authenticated application adapter are integration code.
Atlas also explicitly loads persisted Milvus collections before retrieval and ingestion
verification: collections can reopen in a released state after service restart. The
restart regression uses real local Milvus Lite storage and synthetic vectors, ensuring
new ingestion preserves older sources without any model request.

Retained licenses are in [third-party notices](THIRD-PARTY-NOTICES.md) and `licenses/`.
RAG-Anything and LightRAG are MIT; **MinerU has separate attribution and commercial-use
conditions**. Review its included license before commercial redistribution/deployment.
The complete dependency/model stack is not represented as MIT. No installed image or
model weights are redistributed in this repository.
