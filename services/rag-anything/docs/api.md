# Backend integration

Base URL: `http://127.0.0.1:8081`. Send `Authorization: Bearer <RAG_API_KEY>` on
content requests. Keep the key in your backend: it grants access to the entire
library, not one user's documents. OpenAPI and Swagger UI are at `/openapi.json`
and `/docs`. The service version is 2; route names retain `/v1` for compatibility.

## Routes

| Method/path | Input | Result |
| --- | --- | --- |
| `GET /health/live` | No auth | Process liveness |
| `GET /health/ready` | Auth | API readiness, latest-upload state and busy flag; no provider probe |
| `POST /v1/documents` | Raw bytes; `Content-Type`, `X-File-Name` | `202`, new stable document ID and processing receipt |
| `GET /v1/documents` | Auth | Catalog, default ready IDs, format prerequisites |
| `GET /v1/documents/{id}` | Auth | That document's receipt |
| `GET /v1/documents/current` | Auth | Compatibility route: latest upload receipt, not the search scope |
| `GET /v1/documents/{id}/source` | Auth | Original uploaded file as a download |
| `GET /source.pdf?source_id=...` | Auth | Compatibility original download for PDF only |
| `POST /v1/rag/naive` | Question, selection, optional mode/top-k | Single-search evidence packet |
| `POST /v1/rag/agentic` | Question, selection, optional planner/steps/top-k | Agent evidence packet |
| `POST /v1/tools` | Selection, tool and arguments | Source navigation/search result |
| `GET /v1/spend` | Auth | Durable reservations and reported-usage estimates |

## Upload, catalog and processing

Uploads add a document, never replace an earlier document. Send raw file bytes,
not multipart form data. `X-File-Name` must supply a supported suffix; it can be
omitted only when uploading `application/pdf`, which defaults to `Uploaded.pdf`.
An explicit matching MIME is preferred; `application/octet-stream` is also accepted
with a valid filename. Mismatched type/suffix combinations fail with 415.

Maximum raw size is 100 MiB. PDFs have at most 1,000 physical pages; other formats
must extract into at most 1,000 logical locations. All encrypted PDFs are rejected.
Text must be UTF-8 or BOM-marked UTF-16/32. See the
[capability brief](capability-brief.md) for supported suffixes and parser dependencies.

Upload returns a receipt with `id`, `source_id`, `name`, `format`, `state` and source
metadata. `pages` may become available only after parsing. Poll
`GET /v1/documents/{id}` until `parsing → indexing → ready`, or `failed`. Indexing
includes chunk planning and embeddings. A failed receipt stays visible and its
document is excluded from ready selections. Re-uploading creates a new ID and can
incur additional usage; no idempotency key or retry-existing-job route is provided.

The catalog has this shape:

```json
{
  "documents": [{"id":"ID_A","source_id":"ID_A","name":"lesson.md","format":"markdown","state":"ready","pages":1}],
  "default_source_ids": ["ID_A"],
  "selection_default": "all_ready",
  "formats": [{"extension":".md","media_type":"text/markdown","missing_requirements":[]}]
}
```

Fields shown are illustrative; receipts include additional metadata/counters and
the real format list contains all supported extensions. `missing_requirements`
reports environment prerequisites per format. Existing ready IDs remain stable
across uploads and restarts. There is no delete/reselect/rename/update route.

## Source selection

The retrieval and tool request models share:

| Input | Selected documents |
| --- | --- |
| Omitted `source_ids`, or `source_ids: null` | All ready documents at request admission |
| `source_ids: []` | None; an empty result, not a fallback |
| `source_ids: ["ID_A", "ID_B"]` | Exactly that subset, with duplicates removed |
| `source_id: "ID_A"` | Single-document compatibility alias |

Choose the list or the alias; do not send both as non-null values. Lists permit at
most 1,000 entries. Unknown or non-ready explicitly selected IDs produce 409;
they are not silently ignored. An empty ready library also has empty default scope.
Vector filtering happens inside Milvus before top-k. Keyword search and agent
navigation cannot expand beyond the resolved request scope.

Default-all selection is intentionally dynamic. For user permissions or a stable
document set, have your backend authorize explicit IDs and send the list on every
request. A caller possessing the service key can still ask for the full library.

## Retrieval inputs and examples

Both routes require a nonblank `question` of at most 2,000 characters. `top_k`
defaults to 6, range 1–20 across the selected scope. Unknown fields fail with 422.

Normal `mode` is `vector` by default, or `keyword`/`hybrid`. Keyword uses local BM25
over literal contextual chunks with no provider call. Vector embeds the question
with Gemini, searches the selected documents, and returns literal source chunks.
Hybrid combines keyword and vector ranks with reciprocal-rank fusion, k=60.
Normal retrieval does not invoke the query planner. Ingestion may already have used
contextual planning, independently of this query-mode choice.

Agent `planner_model` is `gemini-2.5-pro` by default or `gemini-2.5-flash`.
`max_steps` is 1–8, default 8. The agent starts with keyword evidence and heading
contents, then chooses search/navigation actions and reviews actual passage IDs.
Only 768-dimensional embeddings are built.

```python
import os
import httpx

headers = {"Authorization": f"Bearer {os.environ['RAG_API_KEY']}"}
with httpx.Client(base_url="http://127.0.0.1:8081", headers=headers, timeout=150) as client:
    response = client.get("/v1/documents")
    response.raise_for_status()
    catalog = response.json()
    # Choose authorized IDs for this request. This example freezes the current ready set.
    selected_ids = catalog["default_source_ids"]
    request = {"source_ids": selected_ids, "question": "What supports this explanation?"}
    normal = client.post("/v1/rag/naive", json={**request, "mode": "hybrid"})
    normal.raise_for_status()
    print(normal.json()["status"], normal.json()["candidates"])
    agent = client.post("/v1/rag/agentic", json=request)
    agent.raise_for_status()
    packet = agent.json()
    print(packet["status"], packet["selected"], packet["candidates"])
```

## Evidence output

| Field | Meaning |
| --- | --- |
| `kind`, `version` | `retrieval_evidence`, evidence schema version 1 |
| `retrieval_mode` | `naive` or `agentic` |
| `status` | `completed`, or an explicit partial/failure status |
| `source_ids` | Resolved list of documents in this request |
| `sources` | Per-document identity/hash, filename, location basis and counts |
| `source_id`, `source_sha256` | Compatibility fields: actual ID/hash for one document; scope token/null hash otherwise |
| `selected` | Passages marked relevant by the agent; empty for normal retrieval |
| `candidates` | Retrieved but not selected/rejected passages |
| `rejected` | Passages the agent marked irrelevant |
| `tool_calls` | Calls, arguments, success/failure, timings and source results |
| `cursor` | Last navigation window with its document ID, if present |
| `coverage` | Counts and explicit non-exhaustiveness; relevance is not fact verification |
| `metrics` | Seconds and generation/embedding call counts |

Use `source_ids` and each passage's actual `source_id` for document operations.
A top-level multi-document scope token is not a downloadable document ID.

Each passage contains literal `content`, a source-qualified `id`/`block_id`, source
hash, page/location, section context, `boundaries`, and actual `via` tool provenance.
Search chunks can also contain `topic_id`, `context_note`, split reason, source-block
IDs, and neighbor metadata. Generated context labels/notes are metadata, not source
quotations; do not quote them as if they appeared in the document.

`page_basis` distinguishes physical PDF pages from logical non-PDF locations.
`boundaries` uses exclusive character offsets in extracted text, not original file
bytes, rendered typography or printed line numbers. A non-PDF `pdf_page` is null.
The `source_url` points to an authenticated original download; resolve it against
the backend URL. Use an authenticated backend proxy for a UI, never the service
secret in a URL. Not every original format can be displayed by a browser PDF viewer.

There is no `answer` field. A downstream answerer should quote literal passages,
preserve source-qualified citation IDs, and decide whether evidence is sufficient.
Empty selection/hits are not proof that the documents lack the requested information.
Failed agent selection can still leave useful candidates.

## Streaming

Append `?stream=true` to either retrieval endpoint with the same JSON body.
The response is NDJSON (`application/x-ndjson`), not SSE. Disable proxy buffering
and allow more than 120 seconds at the client/proxy.

Events include `status`, `tool`, `evidence`, `packet`, and `heartbeat`, ending with
`done` containing the final packet or `error`. `evidence.data.chunks` is a complete
current snapshot, not an append-only delta. Upsert by passage ID. Intermediate
packets can occur during interruption handling; terminal `done` is authoritative.
Retain latest evidence if a connection breaks before completion. Disconnecting
cancels the task but cannot undo already-sent provider requests.

## Direct tools and document navigation

`POST /v1/tools` accepts `tool` plus the same source-selection fields:

| Tool | Relevant arguments |
| --- | --- |
| `toc` | Selection, `offset`, `top_k`; combined headings retain their `source_id` |
| `search` | Selection, `query`, `mode` (keyword default), `top_k`, `dimensions` (768 only) |
| `read_page` | Select one document; 1-based `page`, `offset`, `limit` |
| `read_chapter` | Select one document; `chapter_id` from its TOC, `offset`, `limit` |
| `next`, `back` | Returned `cursor`; its source must be inside the selected scope |

Windows default to 6,000 characters and allow 200–12,000. For page/chapter reads,
send `source_id` or a one-ID `source_ids` list. Omitting selection works only when
the resulting scope has one document. With multiple documents it fails with
`navigation_requires_source_id`. Next/back carries document identity in its cursor
and cannot move into another source. Keep cursors intact.

```json
{"tool":"read_page","source_id":"ID_A","page":2,"limit":6000}
```

Tool results contain `ok`, `code`, `data`, source/scope identity and call `id`.
An empty successful search or navigation boundary is different from `ok:false`.
Check both HTTP status and `ok`; unknown chapters, invalid cursors and out-of-scope
navigation fail explicitly.

## Failure handling

HTTP 401 means invalid authentication; 404 unknown catalog/download ID; 409 operation
active or explicit selection not ready/unknown; 413 raw upload too large; 415 missing/
unsupported suffix or MIME mismatch; 422 invalid arguments/file; 503 missing parser
prerequisites, retrieval worker initialization failure or manual-tool provider failure.

Retrieval can return HTTP 200 with partial evidence and a non-completed `status`:
`budget_exceeded`, `provider_timeout`, `provider_or_tool_failed`, `invalid_decision`,
`step_limit`, `tool_failed`, `timeout`, or `interrupted`. Inspect it even after a
successful HTTP response. No automatic vector-to-keyword fallback or provider retry
is performed.

Vector/hybrid query embedding inputs are limited to 2,000 UTF-8 bytes, in addition
to the request's 2,000-character bound. Longer multibyte text returns an explicit
tool error without provider spend; it is never silently truncated. Keyword-only
search does not embed. Optional private trace persistence failing does not discard
a completed retrieval result.

Ingestion and retrieval are serialized. Even a query limited to an older ready
document receives 409 while a new upload is processing. Poll the upload receipt and
retry with bounded backoff. A latest-upload failure does not remove older ready
documents; use the catalog rather than `/current` to determine available sources.
