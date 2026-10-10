# Full capability brief

## What developers can use it for

This service turns uploaded documents into a searchable library. A backend or an
assistant can retrieve relevant source passages directly, or ask an agent to search
and inspect the documents before selecting evidence. The response identifies which
document each passage came from and where to find it.

RAG means retrieval-augmented generation: find relevant external material, then give
it to a model to support an answer. This service handles retrieval and evidence
collection. Your application supplies the final answer-writing step. Neither route
returns an `answer` field or treats a planner's generated prose as a quotation.

| Route | Work performed |
| --- | --- |
| `/v1/rag/naive` | One keyword, vector, or hybrid search over the selected documents; vector is the default. No query-planning model. |
| `/v1/rag/agentic` | Initial keyword search and document structure, followed by a bounded agent that searches, reads context, follows continuations, and reviews evidence. |

Both use the same library and contextual retrieval chunks. The agent's additional
traversal and selection remain independently callable. This is not a stock
RAG-Anything versus patched RAG-Anything benchmark: the retrieval code is ours in
both cases.

## Which documents can be searched together?

Uploads add to a persistent document catalog. Each accepted upload receives a stable
ID and its own processing receipt. Ready documents remain available after another
upload and after restart; a failed upload does not replace the library.

| Selection | Meaning |
| --- | --- |
| Omit `source_ids`, or use `null` | All documents currently ready for retrieval |
| `"source_ids": []` | No documents; never an implicit fallback to all |
| `"source_ids": ["ID_A", "ID_B"]` | Only these documents |
| `"source_id": "ID_A"` | Compatibility alias for a single-document selection |

Do not combine the single alias with `source_ids`. Explicit unknown or unavailable
IDs fail rather than silently changing the requested scope. Enumerate the catalog
with `GET /v1/documents` and retain explicit IDs when the calling application needs
a stable subset. Default-all scope can grow as new uploads become ready.
Page/chapter navigation identifies a particular document: a page number alone is
ambiguous across a library.

Vector search applies selected document IDs inside the Milvus filter **before**
top-k selection. It does not search the whole library and discard unwanted hits
afterward. Keyword search, the agent, and direct tools honor the same source scope.
Returned passages and cursors identify their document, preventing the same page or
local block ID in two files from being confused.

The integration key still authorizes the entire service. Document selection is not
tenant access control. Your backend must decide which IDs a user may request and
must supply that selection; a client allowed to call the service directly can use
the default-all scope. No document deletion, editing, space hierarchy, or user login
is supplied.

## File formats and what parsing means

Upload raw file bytes to `POST /v1/documents`, with the matching MIME type and an
`X-File-Name` header containing the filename and suffix. A PDF may omit the filename
for compatibility. The service accepts these explicit formats:

| Files | Parsing path | Local requirements / limits |
| --- | --- | --- |
| `.pdf` | RAG-Anything's MinerU adapter and local MinerU CPU pipeline | Prepared parser weights; encrypted PDFs rejected |
| `.txt`, `.md` | RAG-Anything text/Markdown adapter | No parser weights; UTF-8 or BOM-marked UTF-16/32 |
| `.html`, `.htm`, `.xhtml` | Our standard-library HTML extraction | No browser, JavaScript, linked assets, or model weights |
| `.docx`, `.pptx`, `.xlsx` | MinerU's native Office extraction | Pinned Python dependencies; no OCR model preparation for this path |
| `.doc`, `.ppt`, `.xls` | LibreOffice conversion followed by MinerU PDF extraction | LibreOffice executable and prepared parser weights |
| `.png`, `.jpg`, `.jpeg`, `.bmp`, `.tif`, `.tiff`, `.gif`, `.webp` | Raster validation and MinerU image extraction | Prepared parser weights; multiple frames processed individually |

Files are limited to 100 MiB and at most 1,000 physical pages or extracted logical
locations. Raster validation also limits total pixels across frames to 40 million.
Office archive structure, expanded size, encryption, and unsafe members are checked.
An accepted suffix is a supported parser path, not a guarantee that every complex
file will extract accurately. The [validation record](validation.md) distinguishes
tested native Office/text paths from unverified conversions and provider behavior.

PDF citations refer to physical pages. Other formats use extraction-defined logical
locations: they do not promise a word processor's printed page layout or a browser's
rendered view. Original files are downloadable through an authenticated endpoint.
Offsets refer to extracted text, which can differ from the original file's layout,
markup, bytes, or OCR appearance.

Markdown image references are not opened as local files or fetched remotely. HTML
extraction keeps text, headings, lists, code, table content and image alternative
text; it ignores scripts/styles and does not render CSS or execute a page. The API
accepts uploaded files, not web URLs or directories. Audio, video, archives, and
unlisted Office variants are unsupported.

PDF/image OCR, captions, table text, and extracted equation text can be searched.
Formula recognition is disabled in the current MinerU PDF/image setup. There is no
generated vision description or query-time inspection of figure pixels. A chart
whose meaning exists only in its pixels may therefore be poorly represented or
absent from searchable text.

## How meaningful chunks are made

A chunk is a bounded piece of extracted source material stored for retrieval.
Splitting only by an arbitrary character count can separate a definition from its
explanation or miss the end of a long table. Contextual mode starts from source
structure and asks Gemini Flash to group ordered units into coherent topics.

The planner receives bounded windows, headings, a document introduction and limited
neighboring context. It returns topic boundaries, short section labels, and context
notes. Local validation requires a complete ordered partition: it cannot omit,
duplicate, reorder, or rewrite source units. Invalid plans fail ingestion rather
than silently switching to another chunking method.

Each indexed chunk contains an exact slice of extracted source plus separate context
metadata. Topic groups may span several chunks. Page citation boundaries and
embedding-size limits can split a topic; shared topic IDs and neighboring-chunk
metadata retain the relationship within a planning window. Topic grouping does not
cross planning-window boundaries. Long text is covered through successive chunks,
so the earlier behavior of embedding only the beginning of a long source block is
removed. Size limits remain safety bounds, not a claim that every topic fits into
one chunk or that a bounded planner sees the entire document at once.

Embedding text includes the complete chunk plus bounded context: document title,
section, structural hints, generated context notes and neighboring excerpts where
applicable. Context notes can improve discoverability but are model output, not
verified facts. Literal returned content and its citation boundaries remain separate
from that metadata. No new retrieval-quality improvement is claimed without an
evaluation of this revised chunking pipeline.

Default `RAG_CHUNK_MODE=contextual` incurs Gemini Flash planning during ingestion.
`RAG_CHUNK_MODE=structural` uses deterministic structural boundaries without a
planning model. Both modes still create paid Gemini embeddings. Changing this
setting affects newly ingested documents; it does not rewrite existing indexes.

## Search and agent behavior

| Search path | Intended use | Provider work at query time |
| --- | --- | --- |
| Keyword/BM25 | Matching terminology, names, acronyms and source words | None |
| Vector | Semantic similarity over contextual chunks | Gemini query embedding |
| Hybrid | Combine lexical and semantic rankings with RRF k=60 | Gemini query embedding |
| Agentic | Search, inspect context, follow continuations, select evidence | Gemini planner; embeddings if it chooses vector/hybrid |

Embeddings are normalized `gemini-embedding-001` vectors with 768 dimensions. There
is no dedicated learned reranker or exhaustive-search guarantee. Single-search
retrieval returns candidates. The agent marks actual retrieved passage IDs selected
or rejected while retaining unreviewed candidates and tool provenance.

The continuation-aware controller is inherited from our earlier source-navigation
work. Its tools expose headings, pages, chapter subtrees and next/back windows. The
planner sees truncation and neighbor information, is instructed to inspect missing
aspects, and can combine evidence review with another useful tool action. Local
checks reject invented IDs, contradictory reviews and out-of-scope source access.
The default planner is Gemini 2.5 Pro, with Flash selectable.

The agent is bounded to eight decisions and 120 seconds per request, with bounded
navigation windows and retained evidence. It can still make poor choices, miss
relevant material or time out. Partial results keep usable evidence when planning
fails; selection means relevance, not verification that a source's claim is true.

## MCP tools

The optional stdio bridge exposes `source_info`, `source_toc`, `source_search`,
`source_read_page`, `source_read_chapter`, `source_next`, `source_back`, and
`source_gather`. A compatible assistant can discover the library, select documents,
search, navigate a particular source, or invoke the collector. See the
[MCP guide](mcp.md) for source-selection arguments and configuration.

The bridge talks to the authenticated HTTP service and does not open another
index. It cannot upload/delete/edit documents, run shell commands, browse the web,
change budgets or generate a final answer through these tools. Read-only hints do
not make vector searches or agent planning free; usage is still recorded.

## Upstream components versus our implementation

| Component | Actual role in this version |
| --- | --- |
| RAG-Anything | Text/Markdown and MinerU parser adapters, including legacy Office conversion helpers |
| MinerU | Local PDF/image extraction and native modern Office parsers |
| LibreOffice | Required conversion executable for legacy DOC/PPT/XLS |
| Milvus Lite / pymilvus | Direct shared persistent vector collection |
| Gemini | Contextual chunk planning, document/query embeddings, agent decisions |
| Our code | Format admission, HTML extraction, persistent library, contextual chunk assembly, exact citations, filtered search, navigation, agent controller, API/MCP and usage ledger |

There is no modified upstream RAG-Anything checkout or patched wheel in the bundle.
The code around those libraries is our implementation. The service no longer
initializes LightRAG to build unused graph/chunk indexes or borrows its Milvus
client. Our engine owns Milvus directly. LightRAG can still be present in the pinned
dependency tree because RAG-Anything depends on it; installed does not mean used
for retrieval or graph construction.

The current database is Milvus Lite, not Qdrant. Original documents, extraction,
receipts and chunk plans are files; conservative usage reservations are SQLite.
No Qdrant migration tool or history is implied. `naive` does not call upstream
LightRAG generated-answer mode.

Removing unused upstream ingestion avoids its graph-generation and visual-description
calls. Contextual planning and embeddings remain paid work, so this architectural
change is not a measured cost or quality guarantee. The earlier four-task diagnostic
reported 62.5% average required-block recall for source-block vector retrieval and
87.5% for the continuation-aware Flash collector. Those results predate this
multi-document contextual-chunk index and must not be presented as its benchmark.
See [historical results](historical-results.md).

## Delivery and operational limits

The ZIP supplies code, HTTP/MCP contracts, pinned dependencies, model preparation,
Docker/native setup, licenses, tests and guides. Developers supply credentials and
download dependencies/weights. Gemini receives source text and context required for
chunk planning, embeddings and agent decisions; local parsing does not mean the
whole service runs offline.

Use one worker per data directory. Ingestion and retrieval are serialized; clients
must handle busy responses. Existing version-one data requires re-upload into the
new library/index format. No automatic migration, public deployment hardening,
multi-tenant identity, load guarantee, or verified extraction accuracy is included.
The [validation record](validation.md) states which behavior was demonstrated and
which integration checks remain for the receiving team.
