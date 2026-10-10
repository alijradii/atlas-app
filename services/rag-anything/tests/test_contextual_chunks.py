"""Exact evidence, planning failure boundaries, and bounded context payloads."""

import asyncio
import hashlib
import json
from types import SimpleNamespace

import pytest

from rag_service.retrieval_lib import chunking


def make_book(tmp_path, pages, *, kind="text", sections=None):
    units = {}
    for page, text in pages.items():
        units[f"P{page}"] = {
            "page": page,
            "page_start": 0,
            "page_end": len(text),
            "content": text,
            "kind": kind,
            "section_context": sections or ["Reference section"],
        }
    return SimpleNamespace(
        folder=tmp_path,
        source_id="doc-test",
        name="Guide",
        sha256=hashlib.sha256(repr(pages).encode()).hexdigest(),
        page_text=pages,
        units=units,
    )


class Planner:
    def __init__(self):
        self.payloads = []
        self.fail_at = None

    async def __call__(self, prompt, **kwargs):
        payload = json.loads(prompt)
        self.payloads.append(payload)
        if len(self.payloads) == self.fail_at:
            raise RuntimeError("provider interrupted")
        assert kwargs["answer_model"] == "gemini-2.5-flash"
        assert kwargs["response_schema"] == chunking.SCHEMA
        return json.dumps(
            {
                "topics": [
                    {
                        "end_unit": len(payload["units"]) - 1,
                        "section": "Topic",
                        "context_note": "Generated note.",
                    }
                ]
            }
        )


def assert_exact(book, result):
    for page, text in book.page_text.items():
        if not text.strip():
            continue
        spans = [c for c in result["chunks"] if c["page"] == page]
        assert spans[0]["start"] == 0
        assert spans[-1]["end"] == len(text)
        assert "".join(c["content"] for c in spans) == text
        for a, b in zip(spans, spans[1:], strict=False):
            assert a["end"] == b["start"]
    for chunk in result["chunks"]:
        assert chunk["content"] == book.page_text[chunk["page"]][chunk["start"] : chunk["end"]]
        assert len(chunk["embedding_text"].encode()) <= 2000
        assert chunk["embedding_text"].endswith(chunk["content"])
        assert len(chunk["content"].encode()) <= 1400


def test_multilingual_long_units_keep_late_text_and_exact_offsets(tmp_path):
    text = "# أساسيات 中文\n\n" + "مرحبا 世界🙂" * 1300 + "\n\nVERY_LATE_MARKER\n"
    book = make_book(tmp_path, {1: text})
    result = asyncio.run(chunking.prepare_chunks(book, Planner()))
    assert_exact(book, result)
    assert any("VERY_LATE_MARKER" in c["content"] for c in result["chunks"])
    assert any("safety_split" in c["split_reason"] for c in result["chunks"])
    assert all("Generated note." not in c["content"] for c in result["chunks"])


def test_one_topic_spans_pages_with_separate_citations(tmp_path):
    book = make_book(tmp_path, {1: "A definition begins here.\n", 2: "And finishes here.\n"})
    planner = Planner()
    result = asyncio.run(chunking.prepare_chunks(book, planner))
    assert len(planner.payloads) == 1
    assert len({c["topic_id"] for c in result["chunks"]}) == 1
    assert {c["split_reason"] for c in result["chunks"]} == {"page_citation"}
    assert "Next source excerpt: And finishes" in result["chunks"][0]["embedding_text"]
    assert_exact(book, result)


def test_structural_mode_preserves_heading_groups_and_needs_no_model(tmp_path):
    book = make_book(tmp_path, {1: "# First\n\nAlpha.\n\n# Second\n\nBeta.\n"})
    text = book.page_text[1]
    cut = text.index("# Second")
    book.units = {
        "a": {
            "page": 1,
            "page_start": 0,
            "page_end": cut,
            "kind": "text",
            "content": text[:cut],
            "section_context": ["First"],
        },
        "b": {
            "page": 1,
            "page_start": cut,
            "page_end": len(text),
            "kind": "text",
            "content": text[cut:],
            "section_context": ["Second"],
        },
    }
    result = asyncio.run(chunking.prepare_chunks(book, None, mode="structural"))
    assert [c["section"] for c in result["chunks"]] == ["First", "Second"]
    assert result["model"] == "none"
    assert_exact(book, result)


@pytest.mark.parametrize(
    "kind,source",
    [
        ("table", "| item | value |\n| --- | --- |\n" + "| pressure | 12 |\n" * 220),
        ("code", "```python\n" + "    output = compute(value)\n" * 160 + "```\n"),
    ],
)
def test_table_rows_and_code_lines_split_with_structure_context(tmp_path, kind, source):
    book = make_book(tmp_path, {1: source}, kind=kind)
    result = asyncio.run(chunking.prepare_chunks(book, Planner()))
    assert_exact(book, result)
    assert all(c["content"].endswith("\n") for c in result["chunks"])
    assert all(c["structural_context"] for c in result["chunks"])
    expected = "| item | value |" if kind == "table" else "```python"
    assert all(expected in c["embedding_text"] for c in result["chunks"])


@pytest.mark.parametrize("ends", [[-1, 1], [0], [1, 1], [2], [True], [1, 0], []])
def test_invalid_model_partitions_fail_without_checkpoint(tmp_path, ends):
    book = make_book(tmp_path, {1: "First.\n\nSecond."})

    async def invalid(*args, **kwargs):
        return {"topics": [{"end_unit": end, "section": "x", "context_note": ""} for end in ends]}

    with pytest.raises(chunking.ChunkingError, match="invalid_topic_partition"):
        asyncio.run(chunking.prepare_chunks(book, invalid))
    assert not list(tmp_path.rglob("*.json"))


def test_complete_checkpoint_reuse_and_model_identity(tmp_path):
    book = make_book(tmp_path, {1: "A passage.\n\nAnother passage."})
    planner = Planner()
    first = asyncio.run(chunking.prepare_chunks(book, planner))
    second = asyncio.run(chunking.prepare_chunks(book, planner))
    assert first == second
    assert len(planner.payloads) == 1
    structural = asyncio.run(chunking.prepare_chunks(book, None, mode="structural"))
    assert structural["fingerprint"] != first["fingerprint"]
    book.page_text[1] += "New extracted tail."
    changed = asyncio.run(chunking.prepare_chunks(book, planner))
    assert changed["fingerprint"] != first["fingerprint"]
    assert len(planner.payloads) == 2


def test_interrupted_planning_reuses_successful_windows(tmp_path):
    book = make_book(tmp_path, {1: "A paragraph with a unique argument.\n\n" * 90})
    planner = Planner()
    planner.fail_at = 2
    with pytest.raises(RuntimeError, match="interrupted"):
        asyncio.run(chunking.prepare_chunks(book, planner))
    assert len(list(tmp_path.rglob("*.json"))) == 1
    planner.fail_at = None
    result = asyncio.run(chunking.prepare_chunks(book, planner))
    assert len(planner.payloads) == 3
    assert_exact(book, result)


def test_corrupt_checkpoint_fails_closed(tmp_path):
    book = make_book(tmp_path, {1: "A paragraph."})
    asyncio.run(chunking.prepare_chunks(book, Planner()))
    checkpoint = next(tmp_path.rglob("*.json"))
    saved = json.loads(checkpoint.read_text())
    saved["plan"]["topics"][0]["end_unit"] = 9
    checkpoint.write_text(json.dumps(saved))
    with pytest.raises(chunking.ChunkingError, match="invalid_topic_partition"):
        asyncio.run(chunking.prepare_chunks(book, Planner()))


def test_call_limit_rejects_before_first_provider_request(tmp_path, monkeypatch):
    monkeypatch.setattr(chunking, "MAX_CALLS", 1)
    book = make_book(tmp_path, {1: "A paragraph.\n\n" * 60})
    planner = Planner()
    with pytest.raises(chunking.ChunkingError, match="chunk_planning_call_limit"):
        asyncio.run(chunking.prepare_chunks(book, planner))
    assert not planner.payloads


def test_extreme_context_metadata_and_unicode_stay_within_embedding_bound(tmp_path):
    book = make_book(tmp_path, {1: "界" * 2000}, sections=["科" * 800])
    book.name = "档" * 1000

    async def verbose(prompt, **kwargs):
        return {
            "topics": [
                {
                    "end_unit": len(json.loads(prompt)["units"]) - 1,
                    "section": "界" * 120,
                    "context_note": "界" * 480,
                }
            ]
        }

    result = asyncio.run(chunking.prepare_chunks(book, verbose))
    assert_exact(book, result)
