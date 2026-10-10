"""Literal retrieval boundaries, no-answer agent behavior and restart-safe spend control."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import pytest
from pypdf import PdfWriter

from rag_service.retrieval_lib.collector import Collector, ToolSession
from rag_service.retrieval_lib.source import SourceBook, SourceError, ToolRequest
from rag_service.retrieval_lib.spend import SpendLedger, SpendLimit

pytestmark = pytest.mark.unit


@pytest.fixture
def book(tmp_path: Path) -> SourceBook:
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=100, height=100)
    writer.write(tmp_path / "source.pdf")
    (tmp_path / "content.json").write_text(
        json.dumps(
            [
                {"type": "text", "page_idx": 0, "text_level": 1, "text": "1. Method"},
                {
                    "type": "text",
                    "page_idx": 0,
                    "text": "alpha pressure valve\nopens at the limit.",
                },
                {"type": "text", "page_idx": 1, "text_level": 1, "text": "1.1. Training"},
                {"type": "text", "page_idx": 1, "text": "overlap training " * 70},
                {"type": "text", "page_idx": 2, "text_level": 1, "text": "2. Results"},
                {"type": "text", "page_idx": 2, "text": "An unrelated benchmark."},
            ]
        )
    )
    return SourceBook(tmp_path)


def test_toc_subtree_ranges_and_literal_offsets(book: SourceBook) -> None:
    assert book.chapters[0]["page_end"] == 2
    section = book.chapters[1]
    assert section["parent_id"] == "C0" and section["page_end"] == 2
    data = book.execute(ToolRequest(source_id=book.source_id, tool="read_chapter", chapter_id="C0"))
    assert {p["page"] for p in data["passages"]} == {1, 2}
    for p in data["passages"]:
        bounds = p["boundaries"]
        text = book.page_text[p["page"]]
        assert p["content"] == text[bounds["page_char_start"] : bounds["page_char_end_exclusive"]]
        assert p["source_sha256"] == book.sha256
    assert data["passages"][-1]["section_context"] == ["1. Method", "1.1. Training"]


def test_navigation_reads_long_windows_without_skipping_and_stops_at_edges(
    book: SourceBook,
) -> None:
    first = book.read("page", 2, 0, 200)
    following = book.navigate(first["cursor"], 1)
    assert following["cursor"]["offset"] == 200
    assert book.navigate(following["cursor"], -1)["passages"] == first["passages"]
    current = first
    for _ in range(20):
        current = book.navigate(current["cursor"], 1)
        if current.get("boundary"):
            break
    assert current["boundary"] == "end"
    assert book.navigate(book.read("page", 1, 0, 200)["cursor"], -1)["boundary"] == "start"
    chapter = book.read("chapter", "C0", 0, 12000)
    assert book.navigate(chapter["cursor"], 1)["cursor"]["target"] == "C4"


def test_source_cursor_scope_and_malformed_arguments_fail_closed(book: SourceBook) -> None:
    cursor = book.read("page", 1, 0, 200)["cursor"]
    with pytest.raises(SourceError, match="source_changed"):
        book.navigate({**cursor, "source_id": "another-source"}, 1)
    with pytest.raises(SourceError, match="invalid_cursor"):
        book.navigate({**cursor, "limit": True}, 1)
    with pytest.raises(SourceError, match="unknown_chapter"):
        book.read("chapter", "../secrets", 0, 200)
    with pytest.raises(SourceError, match="offset_out_of_bounds"):
        book.read("page", 1, 99999, 200)


def test_bm25_exact_terms_and_empty_result_are_distinct_from_error(book: SourceBook) -> None:
    hits = book.lexical("pressure valve", 2)
    assert hits[0]["block_id"] == f"{book.source_id}:P1B1" and hits[0]["score_kind"] == "BM25"
    assert book.lexical("nonexistent-word-xyzz", 5) == []

    async def exercise() -> None:
        tool = ToolSession(None, book)
        result = await tool.execute(
            ToolRequest(source_id=book.source_id, tool="search", query="xyzz")
        )
        assert result["ok"] and result["data"]["passages"] == []
        error = await tool.execute(ToolRequest(source_id="other", tool="toc"))
        assert not error["ok"] and error["code"] == "source_not_in_scope"

    asyncio.run(exercise())


def test_collector_returns_only_exact_evidence_and_a_tool_trace(book: SourceBook) -> None:
    request = SimpleNamespace(
        question="pressure valve",
        top_k=3,
        strategy="agent",
        max_steps=4,
        dimensions=768,
        planner_model="gemini-2.5-flash",
    )
    events = []
    decisions = [
        {"action": "read_page", "page": 1},
        {"action": "next"},
        {"action": "back"},
        {"action": "finish", "accept": ["P1B1:0:40"]},
    ]
    # Derive the fixture's exact boundary ID, not a model-generated source string.
    decisions[-1]["accept"] = [book.passage(book.units["P1B1"])["id"]]

    async def complete(*args, **kwargs):
        assert "NEVER answer" in kwargs["system_prompt"]
        return json.dumps(decisions.pop(0))

    async def emit(event):
        events.append(event)

    engine = SimpleNamespace(book=book, complete=complete, current_run=SimpleNamespace(trace=[]))
    packet = asyncio.run(Collector(engine, request, emit).run())
    assert packet["kind"] == "retrieval_evidence" and "answer" not in packet
    assert not any(e["type"] in {"answer", "delta"} for e in events)
    assert packet["selected"][0]["content"] == book.units["P1B1"]["content"]
    assert [c["tool"] for c in packet["tool_calls"]] == [
        "search",
        "toc",
        "read_page",
        "next",
        "back",
    ]
    assert len(packet["selected"][0]["via"]) == 3


def test_invalid_review_preserves_candidates_without_fabricating_packet_content(
    book: SourceBook,
) -> None:
    async def complete(*args, **kwargs):
        return '{"action":"finish","accept":["invented"]}'

    async def emit(event):
        pass

    engine = SimpleNamespace(book=book, complete=complete, current_run=SimpleNamespace(trace=[]))
    request = SimpleNamespace(
        question="valve",
        top_k=2,
        strategy="agent",
        max_steps=2,
        dimensions=768,
        planner_model="gemini-2.5-flash",
    )
    packet = asyncio.run(Collector(engine, request, emit).run())
    assert (
        packet["status"] == "invalid_decision" and packet["candidates"] and not packet["selected"]
    )


def test_ledger_reservations_survive_restart_and_unknown_usage(tmp_path: Path) -> None:
    path = tmp_path / "quota.sqlite"
    ledger = SpendLedger(path)
    call = ledger.reserve("gemini-2.5-pro", 10000, 4096)
    first = ledger.state()["reserved_upper_usd"]
    ledger.record(call, 1000, 100)
    again = SpendLedger(path)
    assert again.state()["reserved_upper_usd"] == first
    assert again.state()["reported_usage_estimate_usd"] < first
    with pytest.raises(SpendLimit):
        ledger.reserve("unpriced-model", 100)
    with pytest.raises(SpendLimit):
        ledger.reserve("gemini-2.5-pro", 10_000_000)
    assert ledger.state()["calls"] == 1


def test_ledger_concurrent_reservations_cannot_exceed_ceiling(tmp_path: Path) -> None:
    ledger = SpendLedger(tmp_path / "quota.sqlite")

    def charge(_):
        try:
            ledger.reserve("gemini-2.5-pro", 1_000_000)
        except SpendLimit:
            return False
        return True

    with ThreadPoolExecutor(max_workers=4) as pool:
        charged = list(pool.map(charge, range(8)))
    assert sum(charged) == 2
    assert ledger.state()["reserved_upper_usd"] <= 9


def test_provider_failure_returns_partial_packet_and_empty_pages_are_traversable(book):
    async def complete(*args, **kwargs):
        raise SpendLimit("trial_dollar_limit")

    async def emit(event):
        pass

    engine = SimpleNamespace(book=book, complete=complete, current_run=SimpleNamespace(trace=[]))
    request = SimpleNamespace(
        question="valve",
        top_k=2,
        strategy="agent",
        max_steps=2,
        dimensions=768,
        planner_model="gemini-2.5-flash",
    )
    packet = asyncio.run(Collector(engine, request, emit).run())
    assert packet["status"] == "budget_exceeded" and packet["candidates"]
    assert packet["tool_calls"][0]["arguments"]["query"] == "valve"
    # A page with no extracted blocks is a real navigable page, not a nonexistent source.
    book.page_text[4] = ""
    result = book.navigate(book.read("page", 3, 0, 6000)["cursor"], 1)
    assert result["cursor"]["target"] == 4 and result["empty_extraction"]
    assert result["passages"] == []


def test_hybrid_preserves_both_rank_origins_and_requested_dimensions(book):
    calls = []

    async def vector_search(query, top_k, dimensions, source_ids=None):
        calls.append((query, top_k, dimensions))
        return [{**book.passage(book.units["P1B1"]), "score": 0.99}]

    async def exercise():
        result = await ToolSession(SimpleNamespace(vector_search=vector_search), book).execute(
            ToolRequest(
                source_id=book.source_id,
                tool="search",
                query="valve",
                mode="hybrid",
                dimensions=3072,
            )
        )
        assert result["ok"] and calls == [("valve", 6, 3072)]
        hit = result["data"]["passages"][0]
        assert {b["method"] for b in hit["branches"]} == {"BM25", "Milvus"}
        assert hit["via"][0]["tool_call_id"] == result["id"]
        assert hit["content"] == book.units["P1B1"]["content"]

    asyncio.run(exercise())


def test_interrupted_collector_emits_partial_packet_before_propagating_cancellation(book):
    events = []

    async def complete(*args, **kwargs):
        raise asyncio.CancelledError

    async def emit(event):
        events.append(event)

    engine = SimpleNamespace(book=book, complete=complete, current_run=SimpleNamespace(trace=[]))
    request = SimpleNamespace(
        question="valve",
        top_k=2,
        strategy="agent",
        max_steps=2,
        dimensions=768,
        planner_model="gemini-2.5-flash",
    )
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(Collector(engine, request, emit).run())
    packet = events[-1]
    assert packet["type"] == "packet" and packet["data"]["status"] == "interrupted"
    assert packet["data"]["candidates"][0]["block_id"] == f"{book.source_id}:P1B1"


def test_planner_short_ids_resolve_only_to_exact_known_references(book):
    request = SimpleNamespace(
        question="pressure valve",
        top_k=3,
        strategy="agent",
        max_steps=2,
        dimensions=768,
        planner_model="gemini-2.5-pro",
    )

    async def emit(event):
        pass

    async def complete(prompt, **kwargs):
        payload = json.loads(prompt)
        assert payload["evidence"][0]["id"] == "E1"
        assert all(p["id"].startswith("E") for p in payload["evidence"])
        return json.dumps({"action": "finish", "accept": ["E1"]})

    engine = SimpleNamespace(book=book, complete=complete, current_run=SimpleNamespace(trace=[]))
    packet = asyncio.run(Collector(engine, request, emit).run())
    assert packet["status"] == "completed"
    assert packet["selected"][0]["id"].startswith(book.source_id + ":")
    assert packet["selected"][0]["content"] == book.lexical("pressure valve", 3)[0]["content"]

    async def invalid(prompt, **kwargs):
        return json.dumps({"action": "finish", "accept": ["E999"]})

    engine.complete = invalid
    packet = asyncio.run(Collector(engine, request, emit).run())
    assert packet["status"] == "invalid_decision" and not packet["selected"]
    assert packet["candidates"]
