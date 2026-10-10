# Operations and troubleshooting

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `RAG_API_KEY` | Required | ASCII backend integration secret, at least 32 characters |
| `GEMINI_API_KEY` | Required | This deployment's provider credential |
| `RAG_DATA_DIR` | `./data`; Docker `/data` | Library, shared index, receipts, plans, ledger and runtime files |
| `MINERU_TOOLS_CONFIG_JSON` | `<data>/mineru.json` | Prepared PDF/image/legacy Office parser configuration |
| `RAG_CHUNK_MODE` | `contextual` | Flash topic planning; `structural` explicitly disables that planning step |
| `RAG_SPEND_LIMIT_USD` | `9` | Positive finite cumulative conservative reservation ceiling |
| `RAG_RETAIN_TRACES` | `0` | Set `1` to retain bounded private query traces |

Both chunk modes still use Gemini embeddings during ingestion. The contextual
chunk model is fixed to `gemini-2.5-flash`. Query-time agent model selection is a
separate request field. Changing chunk mode affects new ingestion; it does not
rebuild existing documents. Mixed ready documents retain their ingestion mode.

Run `python -m rag_service --host 127.0.0.1 --port 8081` locally. Docker binds
inside the container on `0.0.0.0`, with loopback host exposure in Compose. A Linux
file lock enforces one process per data directory. Do not share the Milvus volume
between Uvicorn workers or replicas. Separate instances require separate volumes.

## Milvus deployment choice

Milvus documents Lite for small-scale use and Standalone as a production option
without Kubernetes; see its [deployment guidance](https://milvus.io/docs/install-overview.md)
and [Lite documentation](https://milvus.io/docs/milvus_lite.md). Lite can be an
intentional choice for a small single-instance deployment whose downtime, scale
and recovery requirements fit that design. It is not equivalent to a server
deployment with independent storage operations or high availability.

For the intended production app, prefer **Milvus Standalone as the next deployment
candidate**, then validate actual workload and recovery. Standalone itself is not
automatically highly available; distributed Milvus or a managed deployment is a
separate choice when availability/scaling requirements justify it.

This bundle currently supports **Lite only**: `TrialEngine.start()` opens
`<data>/index/milvus.db`; no `MILVUS_URI` setting switches it to a server. Moving to
Standalone requires an implemented connection/authentication configuration,
validated index migration or reindexing, and real server integration tests. Do not
point two service replicas at the existing Lite file.

Changing the vector backend alone does not remove this service's single-process
lock, serialized requests, ingestion blocking retrieval, local catalog or usage
ledger. Production work still needs workload-specific admission/concurrency,
backend-enforced tenant permissions, parser isolation for public uploads, storage
retention, monitoring and tested backup/restore. Docker image launch, Standalone,
load and recovery have not been validated here. Treat this ZIP as a tested
integration candidate; it has no production SLA.

## Parser preparation and file prerequisites

`GET /v1/documents` includes a `formats` list with extensions, MIME types and local
`missing_requirements`. Use it to check the deployed environment before upload.

- Text/Markdown uses RAG-Anything's text adapter without OCR weights.
- HTML uses our non-rendering parser and does not fetch linked assets.
- DOCX/PPTX/XLSX uses native MinerU Office parsing without PDF conversion or OCR weights.
- PDF and raster images need the prepared MinerU CPU pipeline weights.
- Legacy DOC/PPT/XLS additionally needs LibreOffice Writer/Impress/Calc and a
  `libreoffice` or `soffice` executable on PATH.

The Dockerfile includes the system-library and LibreOffice installation recipe;
actual image validation is recorded separately. Native installs need equivalent
distribution packages. `scripts/prepare_models.py` downloads pinned model files and
verifies sizes/recorded hashes, or checks existing files with `--verify-only`.
Text and native modern Office users can postpone this model preparation.

The parser subprocess uses local model paths, CPU settings and offline model flags.
It processes untrusted extraction output as source data. It is not a security
sandbox for hostile documents. Supported suffixes and structured validation reduce
accidental errors but do not establish safe public upload.

## Persistent library and recovery

The data directory contains:

| Path | Purpose |
| --- | --- |
| `library/<id>/original.<suffix>` | Original uploaded file |
| `library/<id>/source.json` | Source identity, filename, format and location metadata |
| `library/<id>/receipt.json` | Per-document processing/readiness receipt |
| `library/<id>/content.json`, `parsed/`, `parser.log` | Extraction and private parser artifacts |
| `library/<id>/chunks.json`, `chunk-plans/`, source-vector manifest | Literal contextual chunks and validated planning/index metadata |
| `library/current.json` | Latest upload receipt, retained for compatibility |
| `index/milvus.db` | Shared persistent vector index |
| `spend.sqlite` | Lifetime conservative usage reservations |
| `query-traces/` | Optional private query traces, at most the latest 30 |
| `runtime/` | Working directory for runtime side effects |

The active vector collection is `context_chunks_768`; each row carries a document
ID and local chunk ID. Ready source metadata, chunk coverage/fingerprints and vector
manifests/counts must agree. Do not transplant partial index rows or mark a failed
receipt ready manually. Original bytes and extraction hashes anchor citation identity.
Search explicitly loads persisted collections before querying their integrity;
this fixes a released-collection failure observed in the real restart diagnostic.

Uploads add documents to the catalog. Each ready document remains available across
later uploads and restart. Default search includes all ready documents; specify
IDs to freeze a subset. A failed new document does not remove prior ready ones.
`/v1/documents/current` and the health route's source state refer to the latest
upload, not the whole library. Use the catalog for library readiness.

Ingestion and retrieval are serialized. While an upload is parsing/indexing, even
queries against earlier documents return 409. Catalog/receipt checks remain
available. Parse execution is limited to one hour; chunk planning/indexing to two
hours; retrieval to 120 seconds. Per-request budgets impose additional ceilings.
Shutdown cancels ingestion and terminates its parser process group.

Interrupted processing becomes `failed` on restart and stays excluded from ready
selection. The public recovery route is re-upload, creating a new document ID.
Internal per-window planning checkpoints are validated for reuse if the same
ingestion is resumed programmatically, but there is no supported resume endpoint.
Failed requests may have consumed provider usage; a fresh upload can repeat it.

No deletion, retention schedule, disk quota manager, document editing or automatic
deduplication is supplied. Re-uploading identical content adds another document.
Monitor storage and establish a retention policy before substantial use. Back up
with the service stopped: copy the whole data directory and model volume together,
preserve mount paths/configuration, then verify known sources after restoration.
Cross-host backup/restore and disaster recovery have not been validated.

## Upgrading version-one data

The earlier single-PDF layout used per-document upstream indexes and source-block
vectors. This version uses a shared directly owned Milvus index with contextual
chunks. It cannot reinterpret old indexes as new ones.

Stop the old service, retain a backup and originals, then start this version with
the intended data directory. Legacy records are marked for re-upload rather than
silently treated as ready. Re-upload each original and use the new IDs after its
receipt reaches `ready`. Existing old files remain on disk until managed by the
operator; no destructive migration is performed.

Preserve the existing `spend.sqlite` when continuing the same deployment allowance.
Moving to a clean data directory must not be used to erase usage history or quietly
reset authorization. The model files can be reused after manifest verification.
Do not run old and new workers against the same data directory simultaneously.

## Usage and information flow

The SQLite ledger reserves a conservative estimate before each provider request.
The default lifetime ceiling is $9, not a monthly refill or an invoice. Restarts do
not reset it. Failed/unknown-usage calls retain reservations. Deliberately change
the configured ceiling to authorize more usage; do not delete the ledger to extend it.

Inherited rates were recorded on 2026-10-08: Flash input/output $0.30/$2.50 per
million tokens, Pro conservatively $2.50/$15, and embeddings $0.15 input. These are
historical estimates, not freshly verified prices. UTF-8 bytes, framing headroom
and margins intentionally overestimate usage, so a large document can hit the
local ceiling well before that amount appears on an actual bill. Maintain rates
when providers change pricing and use provider account controls for a real spending
boundary. `/v1/spend` separates reservations from reported-usage estimates.

Contextual ingestion sends extracted text/structural context to Flash and embedding
inputs to Gemini. Structural mode removes the Flash planning calls but retains
embedding calls. Agentic retrieval sends its question, evidence and tool observations
to the selected planner; keyword retrieval/navigation makes no provider request.
There are no graph-generation or generated-vision-description calls in the active
ingestion path. Cancellation cannot undo already-sent provider work.

The key grants access to all documents and upload. A backend must enforce its own
user/tenant policies before requesting subsets or forwarding downloads. Default-all
selection is not suitable as an implicit per-user permission check. School analytics
locality is not enforced by this microservice; approve the intended outbound text
processing route separately.

Use private networking or an authenticated TLS gateway for remote access. Public
ingress still needs deployment-specific identity, limits, isolation, monitoring and
retention. CORS is not enabled; browser applications should use their own backend.
Treat originals, extraction, context notes, indexes, parser logs and optional traces
as private document-derived data.

## Troubleshooting

| Symptom | Check/action |
| --- | --- |
| Startup rejects configuration | Supply both keys, a 32+ ASCII service key, valid chunk mode and positive finite ceiling. |
| Upload 415 | Supply `X-File-Name` with a supported suffix and matching MIME; raw bytes, not multipart. |
| Upload 422 | Inspect the validation code: malformed/encrypted file, invalid text encoding, archive/image/page limit. |
| Upload 503 | Inspect `missing_requirements` or the catalog; prepare OCR weights/install LibreOffice only for paths needing them. |
| Parsing fails | Check the document's private `parser.log` and parser prerequisites. |
| Indexing fails | Check the receipt, provider availability, reservation ceiling, chunk-planning validity and disk space. |
| `budget_exceeded` | Inspect `/v1/spend`; deliberately raise the ceiling if intended, or choose structural mode for future ingestion. |
| Explicit source selection 409 | Every listed ID must exist and be ready; poll its receipt instead of silently changing scope. |
| Queries 409 during an unrelated upload | Expected serialization; wait for the upload receipt to finish. |
| Retrieval startup 503 | Storage/provider initialization failed; inspect local storage permissions and runtime dependencies. The admission lock is released for a later request. |
| `embedding_input_exceeds_2000_bytes` | Shorten the vector/hybrid search text to at most 2,000 UTF-8 bytes. It is rejected before spending, never silently truncated. |
| Empty all-document result | Check `default_source_ids`; `[]` and an empty ready library intentionally select no documents. |
| `navigation_requires_source_id` | Select one document for a page/chapter read; chapter IDs/page numbers are not library-wide addresses. |
| Latest upload failed but prior content is needed | Read the catalog and explicitly select older ready IDs. |
| Old data does not become ready | Follow version-one re-upload guidance; old block indexes are incompatible. |
| Agent timeout | Keep returned candidates; narrow the question/scope or try Flash for a separate lower-latency trial. |
| `invalid_decision` | Preserve candidates and surface the partial result. Short planner aliases reduce citation transcription errors but cannot guarantee valid model output. |
| Second process refused | Stop the current owner; do not remove its lock file while it is running. |
| Docker unavailable | Start the daemon through normal host administration, or use native Python setup. |

## Development checks

Install the runtime/bridge locks in an isolated environment, then the development
tools recorded in [validation](validation.md). The synthetic tests avoid live Gemini:

```bash
python -m pytest -q
python -m ruff check rag_service tests scripts
python -m ruff format --check rag_service tests scripts
python -m scripts.smoke_runtime
```

The smoke uses real local Milvus with deterministic embeddings and temporary source
data. It requires permission to create Milvus local sockets. No LightRAG/tiktoken
initialization is needed by the new storage path. Do not relax dependency pins to
work around parser errors without a separate compatibility check.
