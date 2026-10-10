"""Document selection is explicit, defaults to the bound corpus and never widens it."""

import asyncio
import hashlib
import json

import pytest
from pydantic import ValidationError

from rag_service.retrieval_lib.chunking import prepare_chunks
from rag_service.retrieval_lib.source import (
    ScopedBook,
    SourceBook,
    SourceError,
    SourceSelection,
    ToolRequest,
)


def build_book(root, source_id, text, *, chunks=True):
    folder = root / source_id
    folder.mkdir()
    data = text.encode()
    (folder / "source.md").write_bytes(data)
    (folder / "source.json").write_text(
        json.dumps(
            {
                "stored_name": "source.md",
                "filename": source_id + ".md",
                "pages": 1,
                "source_sha256": hashlib.sha256(data).hexdigest(),
                "page_basis": "logical extracted section",
            }
        )
    )
    (folder / "content.json").write_text(
        json.dumps(
            [
                {"type": "text", "page_idx": 0, "text": "Introduction", "text_level": 1},
                {"type": "text", "page_idx": 0, "text": text},
                {"type": "text", "page_idx": 0, "text": "Nested", "text_level": 3},
                {"type": "list", "page_idx": 0, "list_items": ["First step", "Second step"]},
            ]
        )
    )
    book = SourceBook(folder)
    if chunks:
        result = asyncio.run(prepare_chunks(book, None, mode="structural"))
        (folder / "chunks.json").write_text(json.dumps(result))
        book = SourceBook(folder)
    return book


@pytest.fixture
def books(tmp_path):
    return [
        build_book(tmp_path, "doc-a", "alpha valve pressure"),
        build_book(tmp_path, "doc-b", "beta valve hydraulics"),
        build_book(tmp_path, "doc-c", "gamma botanical methods"),
    ]


def test_selection_defaults_deduplicates_empty_and_rejects_ambiguity():
    assert SourceSelection().source_ids is None
    assert ToolRequest(tool="search", query="  valve  ").query == "valve"
    with pytest.raises(ValidationError):
        SourceSelection(source_id="   ")
    assert SourceSelection(source_ids=[]).source_ids == []
    assert SourceSelection(source_ids=["a", "a", "b"]).source_ids == ["a", "b"]
    with pytest.raises(ValidationError):
        SourceSelection(source_id="a", source_ids=[])
    with pytest.raises(ValidationError):
        SourceSelection(source_ids=[""])
    with pytest.raises(ValidationError):
        SourceSelection(source_ids=["a"] * 1001)


def test_all_is_default_subset_and_empty_never_expand(books):
    library = ScopedBook(books)
    request = ToolRequest(tool="search", query="valve")
    result = library.execute(request)
    assert {p["source_id"] for p in result["passages"]} == {"doc-a", "doc-b"}
    selected = library.execute(request.model_copy(update={"source_ids": ["doc-b"]}))
    assert {p["source_id"] for p in selected["passages"]} == {"doc-b"}
    assert library.execute(request.model_copy(update={"source_ids": []}))["passages"] == []
    assert library.subset(source_ids=[]).source_ids == []
    assert library.select(SourceSelection(source_id="doc-a")).source_id == "doc-a"
    assert library.sha256 is None
    assert library.subset(source_id="doc-a").sha256 == books[0].sha256


def test_unknown_or_unselected_sources_fail_closed(books):
    scope = ScopedBook(books[:2])
    for selection in (
        SourceSelection(source_id="doc-c"),
        SourceSelection(source_ids=["doc-a", "missing"]),
    ):
        with pytest.raises(SourceError, match="source_not_in_scope"):
            scope.select(selection)
    with pytest.raises(SourceError, match="source_not_in_scope"):
        scope.validate_source("doc-c")
    scope.validate_source(scope.source_id)
    scope.validate_source("doc-a")
    with pytest.raises(SourceError, match="source_not_in_scope"):
        scope.subset(source_ids=[]).subset(source_ids=["doc-a"])


def test_navigation_requires_source_and_cursor_cannot_escape_selection(books):
    scope = ScopedBook(books)
    with pytest.raises(SourceError, match="navigation_requires_source_id"):
        scope.execute(ToolRequest(tool="read_page", page=1))
    result = scope.execute(ToolRequest(tool="read_page", source_id="doc-b", page=1))
    assert {p["source_id"] for p in result["passages"]} == {"doc-b"}
    cursor = result["cursor"]
    switched = scope.execute(
        ToolRequest(tool="read_page", source_id="doc-a", page=1, cursor=cursor)
    )
    assert {p["source_id"] for p in switched["passages"]} == {"doc-a"}
    assert scope.execute(ToolRequest(tool="next", cursor=cursor))["boundary"] == "end"
    with pytest.raises(SourceError, match="source_not_in_scope"):
        scope.execute(ToolRequest(tool="next", source_ids=["doc-a"], cursor=cursor))
    with pytest.raises(SourceError, match="source_not_in_scope"):
        scope.execute(ToolRequest(tool="next", cursor={**cursor, "source_id": "missing"}))


def test_toc_disambiguates_documents_and_declared_heading_depth(books):
    scope = ScopedBook(books)
    result = scope.execute(ToolRequest(tool="toc", top_k=20))
    assert result["total"] == 6
    assert {c["source_id"] for c in result["chapters"]} == set(scope.source_ids)
    assert books[0].chapters[1]["depth"] == 3
    assert books[0].chapters[1]["parent_id"] == "C0"
    assert "First step\nSecond step" in books[0].page_text[1]


def test_chunk_search_returns_exact_full_span_and_distinct_global_ids(books):
    scope = ScopedBook(books)
    hits = scope.lexical("valve", 20)
    assert len(hits) == 2 and hits[0]["id"] != hits[1]["id"]
    for hit in hits:
        source = scope.by_id[hit["source_id"]]
        bounds = hit["boundaries"]
        assert (
            hit["content"]
            == source.page_text[hit["page"]][
                bounds["page_char_start"] : bounds["page_char_end_exclusive"]
            ]
        )
        assert hit["topic_id"] and "context_note" in hit
        assert "neighbors" in hit and hit["neighbors"]["next"]["source_id"] == source.source_id
        assert all(uid.startswith(source.source_id + ":") for uid in hit["source_block_ids"])
        assert hit["source_url"].startswith(f"/v1/documents/{source.source_id}/source")
        assert hit["boundaries"]["pdf_page"] is None
        assert not hit["truncated"]
    uid = next(iter(scope.search_units))
    assert scope.chunk_passage(uid)["source_id"] == "doc-a"


def test_bm25_uses_selected_corpus_frequencies(books):
    # "valve" appears in two documents, "alpha" only in one. Shared statistics
    # make rare alpha contribute more to document a than a per-book score would.
    scope = ScopedBook(books)
    a = next(p for p in scope.lexical("valve alpha", 20) if p["source_id"] == "doc-a")
    single = scope.subset(source_id="doc-a").lexical("valve alpha", 20)[0]
    assert a["score"] != single["score"]
    assert a["score"] == scope.lexical("valve alpha", 20)[0]["score"]


def test_chunk_integrity_hash_offsets_and_coverage_fail_closed(tmp_path):
    book = build_book(tmp_path, "doc-a", "Evidence")
    path = book.folder / "chunks.json"
    data = json.loads(path.read_text())
    original = json.loads(path.read_text())
    data["source_sha256"] = "bad"
    path.write_text(json.dumps(data))
    with pytest.raises(SourceError, match="chunk_source_hash_mismatch"):
        SourceBook(book.folder)
    data = json.loads(json.dumps(original))
    data["chunks"][0]["content"] += "fabricated"
    path.write_text(json.dumps(data))
    with pytest.raises(SourceError, match="invalid_chunk_source_span"):
        SourceBook(book.folder)
    data = json.loads(json.dumps(original))
    data["chunks"].pop()
    path.write_text(json.dumps(data))
    with pytest.raises(SourceError, match="incomplete_chunk_source_coverage"):
        SourceBook(book.folder)
