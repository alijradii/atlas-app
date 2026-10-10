# MCP agent integration

MCP lets a compatible assistant discover and call named tools. This bridge speaks
**stdio MCP** to the assistant and authenticated HTTP to the running backend. It
does not open a second Milvus process or expose a hosted HTTP/SSE MCP server.

## Start

Start the backend and ingest documents using the [quick start](quickstart.md).
Native setup there installs `requirements-mcp.lock`, which includes core and bridge
dependencies. If you installed only `requirements.lock`, install the supplemental
lock using the same hash-checking and CPU-index settings. The Docker recipe includes it.

Configure an MCP-capable client to launch:

```json
{
  "mcpServers": {
    "rag-sources": {
      "command": "/absolute/path/to/bundle/.venv/bin/python",
      "args": ["-m", "rag_service.mcp_server"],
      "cwd": "/absolute/path/to/bundle",
      "env": {
        "RAG_SERVICE_URL": "http://127.0.0.1:8081",
        "RAG_API_KEY": "YOUR_SERVICE_KEY"
      }
    }
  }
}
```

This generic example must be adapted to the client's configuration fields. Use the
bundle as the subprocess working directory or put it on `PYTHONPATH`. Keep the key
in private client environment settings. The bridge needs the backend key, not its
own Gemini key. For a container-hosted bridge, the client can invoke
`docker compose exec -T rag python -m rag_service.mcp_server` from the bundle root.
Keep stdin/stdout attached and do not allocate a TTY.

## Tools and document selection

| Tool | Allowed operation |
| --- | --- |
| `source_info` | Get the document catalog, ready IDs, default scope and format prerequisites |
| `source_toc` | Page through inferred headings across the selected documents |
| `source_search` | Search selected documents by keyword, vector or hybrid |
| `source_read_page` | Read exact extracted text from one source's page/logical location |
| `source_read_chapter` | Read one source's bounded heading subtree |
| `source_next` | Continue a cursor through windows/pages/sibling chapters within its source |
| `source_back` | Move that cursor backward |
| `source_gather` | Run keyword-only fast gathering or the agentic collector |

`source_info` takes no arguments and returns the catalog, not merely the last upload.
Other tools accept `source_ids`: omit it or use `null` for all ready documents, `[]`
for none, or a list for a subset. The compatibility `source_id` alias selects one
document and cannot be combined with a non-null list. Explicit unknown/non-ready
sources fail. No tool silently broadens a subset.

Page/chapter navigation needs one document, normally `source_id` from a search hit
or TOC entry. Next/back uses a returned cursor containing that document ID; the
cursor's source must also be allowed by the current request selection. All tools
use the same [HTTP contract](api.md), including 768D vectors, bounds, busy behavior
and source-qualified passage IDs.

`source_gather` takes `question`, selection, `strategy` (`fast` or default `agent`),
`top_k`, `planner_model` (Flash/Pro) and `max_steps` (1–8). Fast maps to the normal
route's keyword mode. Use `source_search` with vector/hybrid for direct semantic
search without our query planner. The bridge does not generate a final answer.

Example sequence:

```text
source_info({})
source_toc({"source_ids":["ID_A","ID_B"]})
source_search({"source_ids":["ID_A","ID_B"],"query":"pressure valve","mode":"hybrid"})
source_read_page({"source_id":"ID_A","page":2,"limit":6000})
source_gather({"source_ids":["ID_A","ID_B"],"question":"Compare the explanations","strategy":"agent"})
```

Source selection is not user authorization. A bridge with the integration key can
request all documents. Give assistants only the service/data access appropriate to
their users; a trusted calling backend must enforce narrower user policies.

## Results and boundaries

Results contain `structuredContent` with `ok`, `code`, `retryable`, and `data`, plus
text carrying the same JSON. Failures set MCP `isError`. Gather preserves received
evidence when the backend stream fails. Only terminal `done` establishes completion;
a terminal error or missing completion overrides any earlier completed packet's
status in the envelope. Check envelope success and packet status.

Progress notifications are sent when the caller supplies a progress token. A hard
client cancellation need not return a final response; retain already-delivered
progress/results. Empty evidence is not proof that information is absent.

Tools can read/search/gather from the selected ready sources. They cannot upload,
delete or edit documents, write arbitrary files, run shell commands, browse the
web, change budgets/keys, create spaces or manage user permissions. Upload is a
separate HTTP operation. These limits describe this bridge, not other host tools.

Read-only annotations do not mean free: vector/hybrid search and agent planning
may incur Gemini usage, and the backend writes reservations and optional traces.
Generated chunk context is metadata rather than source evidence. Source text is
untrusted input, and neither planner guidance nor relevance selection establishes
that a source's statements are true.
