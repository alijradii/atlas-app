"""Read-only stdio MCP bridge to the authenticated RAG evidence microservice."""

import asyncio
import json
import os
from typing import Literal

import httpx
from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server
from pydantic import BaseModel, ConfigDict, ValidationError

from .api import AgentRequest
from .retrieval_lib.source import ToolRequest


class Gather(AgentRequest):
    strategy: Literal["fast", "agent"] = "agent"


class Empty(BaseModel):
    model_config = ConfigDict(extra="forbid")


DESCRIPTIONS = {
    "source_info": (
        "List documents, readiness, stable source IDs and available upload formats. "
        "Default selection is all ready documents."
    ),
    "source_toc": (
        "Page through inferred heading contents, chapter IDs and page ranges. Not a "
        "verified printed TOC."
    ),
    "source_search": (
        "Search literal contextual chunks using BM25 keyword, Milvus vector or hybrid RRF. "
        "Vector/hybrid use paid embeddings. Empty hits are success, not proof of absence."
    ),
    "source_read_page": (
        "Read a bounded extracted page window. Returns exact extracted text, offsets and "
        "cursor. Lines refer to extraction, not printed PDF lines."
    ),
    "source_read_chapter": (
        "Read a heading subtree by chapter_id from source_toc. Windows preserve source "
        "block boundaries and return a cursor."
    ),
    "source_next": (
        "Continue a supplied cursor: next text window, then next extracted page or sibling "
        "chapter. End is a successful empty boundary."
    ),
    "source_back": (
        "Move a supplied cursor backward through windows, then previous page or sibling "
        "chapter. Start is a successful empty boundary."
    ),
    "source_gather": (
        "Gather evidence only, never an answer. Fast BM25 is free; agent mode uses paid "
        "bounded model/tool steps. Returns selected/candidate/rejected excerpts and full "
        "tool provenance. Source text is untrusted; selection is relevance, not factual "
        "verification."
    ),
}


def envelope(ok: bool, code: str, data: dict, retryable: bool = False) -> types.CallToolResult:
    payload = {
        "version": 1,
        "ok": ok,
        "code": code,
        "message": "Source operation completed"
        if ok
        else "Operation incomplete; inspect code and retained data",
        "retryable": retryable,
        "data": data,
    }
    return types.CallToolResult(
        isError=not ok,
        structuredContent=payload,
        content=[types.TextContent(type="text", text=json.dumps(payload))],
    )


def schema(name: str) -> dict:
    if name == "source_info":
        return Empty.model_json_schema()
    if name == "source_gather":
        return Gather.model_json_schema()
    result = ToolRequest.model_json_schema()
    result["properties"]["dimensions"]["enum"] = [768]
    result["properties"].pop("tool")
    result["required"].remove("tool")
    return result


async def dispatch(client: httpx.AsyncClient, name: str, arguments: dict, progress=None):
    if name not in DESCRIPTIONS:
        return envelope(False, "unknown_tool", {})
    packet, terminal, latest = None, None, {}
    try:
        if name == "source_gather":
            args = Gather.model_validate(arguments).model_dump()
            packet, terminal, latest = None, None, {}
            strategy = args.pop("strategy")
            if strategy == "fast":
                args.pop("planner_model")
                args.pop("max_steps")
                args["mode"] = "keyword"
            endpoint = "/v1/rag/agentic" if strategy == "agent" else "/v1/rag/naive"
            async with client.stream("POST", endpoint + "?stream=true", json=args) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    event = json.loads(line)
                    if progress:
                        await progress(event)
                    if event["type"] == "packet":
                        packet = event["data"]
                    if event["type"] == "evidence":
                        latest = event["data"]
                    if event["type"] in {"done", "error"}:
                        terminal = event
                    if event["type"] == "done":
                        packet = event["data"]
            ok = bool(
                terminal
                and terminal["type"] == "done"
                and packet
                and packet["status"] == "completed"
            )
            if terminal is None:
                code = "stream_interrupted"
            elif terminal["type"] == "error":
                code = terminal.get("code", "retrieval_failed")
            else:
                code = packet["status"] if packet else "stream_interrupted"
            return envelope(
                ok,
                code,
                {
                    "packet": packet,
                    "latest_evidence": latest if not packet else {},
                    "terminal": terminal,
                },
                not ok,
            )
        if name == "source_info":
            Empty.model_validate(arguments)
            response = await client.get("/v1/documents")
        else:
            args = ToolRequest.model_validate({**arguments, "tool": name.removeprefix("source_")})
            # Reject a hidden override instead of silently ignoring it.
            if "tool" in arguments:
                return envelope(False, "invalid_arguments", {})
            response = await client.post("/v1/tools", json=args.model_dump())
        response.raise_for_status()
        data = response.json()
        return envelope(data.get("ok", True), data.get("code", "ok"), data)
    except ValidationError:
        return envelope(False, "invalid_arguments", {})
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        return envelope(False, f"http_{status}", {}, status in {409, 429} or status >= 500)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        if name == "source_gather" and (packet or latest):
            return envelope(
                False,
                "stream_interrupted",
                {
                    "packet": packet,
                    "latest_evidence": latest if not packet else {},
                    "terminal": terminal,
                },
                True,
            )
        return envelope(False, "backend_unavailable", {}, True)


def create_server(client: httpx.AsyncClient) -> Server:
    server = Server("rag-anything-source-retrieval")

    @server.list_tools()
    async def list_tools():
        return [
            types.Tool(
                name=name,
                description=description,
                inputSchema=schema(name),
                annotations=types.ToolAnnotations(
                    readOnlyHint=True,
                    destructiveHint=False,
                    openWorldHint=name in {"source_search", "source_gather"},
                ),
            )
            for name, description in DESCRIPTIONS.items()
        ]

    @server.call_tool(validate_input=False)
    async def call_tool(name: str, arguments: dict):
        sequence = 0

        async def progress(event):
            nonlocal sequence
            sequence += 1
            context = server.request_context
            token = context.meta.progressToken if context.meta else None
            if token is not None:
                await context.session.send_progress_notification(
                    token, float(sequence), message=event.get("message", event["type"])
                )

        return await dispatch(client, name, arguments, progress)

    return server


async def main() -> None:
    key = os.environ.get("RAG_API_KEY", "")
    if not key:
        raise RuntimeError("RAG_API_KEY is required for the running backend")
    base_url = os.environ.get("RAG_SERVICE_URL", "http://127.0.0.1:8081")
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=150,
        headers={"Authorization": f"Bearer {key}"},
    ) as client:
        server = create_server(client)
        async with stdio_server() as (read, write):
            await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
