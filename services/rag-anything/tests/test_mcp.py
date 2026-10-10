"""MCP source results preserve failures, partial evidence and literal tool arguments."""

import asyncio
import json

import httpx
import pytest

pytest.importorskip("mcp")
from rag_service.mcp_server import DESCRIPTIONS, create_server, dispatch, schema

pytestmark = pytest.mark.unit


def test_official_mcp_session_lists_tools_and_preserves_structured_results():
    from mcp.shared.memory import create_connected_server_and_client_session

    def transport(request):
        assert request.url.path == "/v1/documents"
        return httpx.Response(200, json={"id": "source", "state": "ready", "pages": 1})

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://localhost:8081", transport=httpx.MockTransport(transport)
        ) as client:
            async with create_connected_server_and_client_session(create_server(client)) as session:
                listed = await session.list_tools()
                assert {tool.name for tool in listed.tools} == set(DESCRIPTIONS)
                result = await session.call_tool("source_info", {})
                assert not result.isError
                assert result.structuredContent["data"]["id"] == "source"

    asyncio.run(exercise())


def test_source_tools_and_structured_error_contract() -> None:
    calls = []

    def transport(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": False, "code": "source_changed", "data": {}})

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://127.0.0.1:8081", transport=httpx.MockTransport(transport)
        ) as client:
            invalid = await dispatch(client, "source_next", {"source_id": "x", "tool": "toc"})
            assert invalid.isError and not calls
            result = await dispatch(client, "source_read_page", {"source_id": "x", "page": 2})
            assert result.isError and result.structuredContent["code"] == "source_changed"
            assert calls[0]["tool"] == "read_page" and calls[0]["page"] == 2
        assert len(DESCRIPTIONS) == 8
        assert "tool" not in schema("source_next")["properties"]

    asyncio.run(exercise())


def test_gather_maps_to_distinct_service_routes_and_uses_final_packet():
    calls = []

    def transport(request):
        calls.append((request.url.path, json.loads(request.content)))
        events = [
            {"type": "packet", "data": {"status": "interrupted"}},
            {"type": "done", "data": {"status": "completed", "selected": []}},
        ]
        return httpx.Response(200, text="\n".join(map(json.dumps, events)))

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://localhost:8081", transport=httpx.MockTransport(transport)
        ) as client:
            for strategy in ["fast", "agent"]:
                result = await dispatch(
                    client,
                    "source_gather",
                    {
                        "source_id": "source",
                        "question": "valve",
                        "strategy": strategy,
                    },
                )
                assert not result.isError and result.structuredContent["code"] == "completed"
        assert calls[0][0] == "/v1/rag/naive" and calls[0][1]["mode"] == "keyword"
        assert "planner_model" not in calls[0][1]
        assert calls[1][0] == "/v1/rag/agentic" and "strategy" not in calls[1][1]

    asyncio.run(exercise())


def test_transport_interruption_keeps_received_evidence():
    class BrokenStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"type":"evidence","data":{"chunks":[{"id":"received"}]}}\n'
            raise httpx.ReadError("synthetic disconnect")

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://localhost:8081",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, stream=BrokenStream())
            ),
        ) as client:
            result = await dispatch(
                client, "source_gather", {"source_id": "x", "question": "valve"}
            )
            assert result.isError and result.structuredContent["code"] == "stream_interrupted"
            assert (
                result.structuredContent["data"]["latest_evidence"]["chunks"][0]["id"] == "received"
            )

    asyncio.run(exercise())


@pytest.mark.parametrize("terminal", [None, {"type": "error", "code": "retrieval_failed"}])
def test_intermediate_completed_packet_does_not_mask_terminal_failure(terminal):
    events = [{"type": "packet", "data": {"status": "completed", "candidates": [{"id": "kept"}]}}]
    if terminal:
        events.append(terminal)

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://localhost:8081",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, text="\n".join(map(json.dumps, events)))
            ),
        ) as client:
            result = await dispatch(
                client, "source_gather", {"source_id": "x", "question": "valve"}
            )
            assert result.isError
            expected = "retrieval_failed" if terminal else "stream_interrupted"
            assert result.structuredContent["code"] == expected
            assert result.structuredContent["data"]["packet"]["candidates"][0]["id"] == "kept"

    asyncio.run(exercise())


def test_partial_stream_retains_evidence_without_inventing_an_answer() -> None:
    events = [
        {"type": "evidence", "data": {"chunks": [{"id": "literal"}]}},
        {"type": "error", "code": "budget_exceeded"},
    ]

    def transport(request):
        return httpx.Response(200, text="\n".join(map(json.dumps, events)))

    async def exercise():
        async with httpx.AsyncClient(
            base_url="http://127.0.0.1:8081", transport=httpx.MockTransport(transport)
        ) as client:
            result = await dispatch(
                client, "source_gather", {"question": "evidence", "source_id": "x"}
            )
            assert result.isError
            data = result.structuredContent
            assert data["code"] == "budget_exceeded"
            assert data["data"]["latest_evidence"]["chunks"][0]["id"] == "literal"
            assert "answer" not in data["data"]

    asyncio.run(exercise())
