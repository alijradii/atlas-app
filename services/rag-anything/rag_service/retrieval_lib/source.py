"""Literal source access, heading-derived contents and BM25 with explicit boundaries."""

import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pypdf import PdfReader

SourceID = Annotated[str, StringConstraints(min_length=1, max_length=128)]


class SourceSelection(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    source_id: SourceID | None = None
    source_ids: list[SourceID] | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_selection(self):
        if self.source_id is not None and self.source_ids is not None:
            raise ValueError("choose_source_id_or_source_ids")
        if self.source_ids is not None:
            self.source_ids = list(dict.fromkeys(self.source_ids))
        return self


class ToolRequest(SourceSelection):
    tool: Literal["toc", "search", "read_page", "read_chapter", "next", "back"]
    query: str = Field(default="", max_length=2000)
    mode: Literal["keyword", "vector", "hybrid"] = "keyword"
    top_k: int = Field(default=6, ge=1, le=20)
    page: int = Field(default=1, ge=1, le=1000)
    chapter_id: str = Field(default="", max_length=64)
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=6000, ge=200, le=12000)
    cursor: dict[str, Any] | None = None
    dimensions: Literal[768, 1536, 3072] = 768


class SourceError(ValueError):
    pass


def tokens(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold())


def block_text(block: dict) -> str:
    result = []
    for key in (
        "text",
        "table_caption",
        "table_body",
        "table_footnote",
        "image_caption",
        "img_caption",
        "img_footnote",
        "list_items",
        "code_body",
        "code_caption",
        "equation_text",
    ):
        if key == "list_items" and block.get("text"):
            continue
        value = block.get(key)
        if isinstance(value, list):
            value = "\n".join(map(str, value))
        if isinstance(value, str) and value:
            result.append(value)
    return "\n".join(result)


class SourceBook:
    def __init__(self, folder: Path) -> None:
        self.folder, self.source_id = folder, folder.name
        self.blocks = json.loads((folder / "content.json").read_text())
        metadata_path = folder / "source.json"
        if metadata_path.exists():
            self.metadata = json.loads(metadata_path.read_text())
            stored = self.metadata.get("stored_name", "source.pdf")
            if not isinstance(stored, str) or Path(stored).name != stored:
                raise SourceError("invalid_source_filename")
            source_path = folder / stored
            self.sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
            if self.metadata.get("source_sha256") != self.sha256:
                raise SourceError("source_hash_mismatch")
            count = self.metadata.get("pages", 1)
            if type(count) is not int or count < 1:
                raise SourceError("invalid_source_pages")
            self.name = self.metadata.get("filename", stored)
            self.page_basis = self.metadata.get("page_basis", "logical extracted page")
        else:
            source_path = folder / "source.pdf"
            self.sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
            count = len(PdfReader(source_path).pages)
            self.name = "source.pdf"
            self.page_basis = "PDF page"
            self.metadata = {
                "stored_name": "source.pdf",
                "filename": self.name,
                "pages": count,
                "source_sha256": self.sha256,
                "page_basis": self.page_basis,
            }
        self.title = self.name
        self.units: dict[str, dict] = {}
        self.chapters: list[dict] = []
        self.page_text: dict[int, str] = {page + 1: "" for page in range(count)}
        sections: list[dict] = []
        for index, block in enumerate(self.blocks):
            page, text = block.get("page_idx", -1) + 1, block_text(block)
            if page < 1:
                continue
            self.page_text.setdefault(page, "")
            if not text and not block.get("img_path"):
                continue
            start = len(self.page_text[page])
            if block.get("text_level") and text:
                number = re.match(r"^([A-Z]|\d+)((?:\.\d+)*)\.?\s", text)
                declared = block.get("text_level")
                depth = (
                    declared
                    if type(declared) is int and declared > 1
                    else 1 + number[2].count(".")
                    if number
                    else 1
                )
                while sections and sections[-1]["depth"] >= depth:
                    sections.pop()["end_block_exclusive"] = index
                chapter = {
                    "id": f"C{index}",
                    "title": text,
                    "depth": depth,
                    "parent_id": sections[-1]["id"] if sections else None,
                    "start_block": index,
                    "end_block_exclusive": len(self.blocks),
                    "page_start": page,
                }
                self.chapters.append(chapter)
                sections.append(chapter)
            self.page_text[page] += text + "\n\n"
            uid = f"P{page}B{index}"
            self.units[uid] = {
                "id": uid,
                "reference_id": uid,
                "block_index": index,
                "content": text,
                "page": page,
                "page_start": start,
                "page_end": start + len(text),
                "kind": block.get("block_kind", block.get("type", "text")),
                "section_context": [s["title"] for s in sections],
                "chapter_ids": [s["id"] for s in sections],
                "bbox": block.get("bbox"),
                "has_image": bool(block.get("img_path")),
            }
        ordered = list(self.units.values())
        for i, unit in enumerate(ordered):
            unit["neighbors"] = {
                direction: {"block_id": ordered[j]["id"], "page": ordered[j]["page"]}
                for direction, j in (("previous", i - 1), ("next", i + 1))
                if 0 <= j < len(ordered)
            }
        for chapter in self.chapters:
            members = self.chapter_units(chapter)
            chapter["page_end"] = max((u["page"] for u in members), default=chapter["page_start"])
        self.search_units = self.units.copy()
        self.chunk_metadata = None
        chunk_path = folder / "chunks.json"
        if chunk_path.exists():
            self.chunk_metadata = json.loads(chunk_path.read_text())
            if self.chunk_metadata.get("source_sha256") != self.sha256:
                raise SourceError("chunk_source_hash_mismatch")
            self.search_units = {}
            for chunk in self.chunk_metadata["chunks"]:
                page, start, end = chunk["page"], chunk["start"], chunk["end"]
                if (
                    type(page) is not int
                    or page not in self.page_text
                    or type(start) is not int
                    or type(end) is not int
                    or not 0 <= start < end <= len(self.page_text[page])
                    or chunk["content"] != self.page_text[page][start:end]
                    or chunk["id"] in self.search_units
                ):
                    raise SourceError("invalid_chunk_source_span")
                members = [
                    u
                    for u in self.units.values()
                    if u["page"] == page and u["page_start"] < end and u["page_end"] > start
                ]
                self.search_units[chunk["id"]] = {
                    **chunk,
                    "page_start": start,
                    "page_end": end,
                    "kind": "contextual_chunk",
                    "block_index": members[0]["block_index"] if members else 0,
                    "section_context": list(
                        dict.fromkeys(label for u in members for label in u["section_context"])
                    ),
                    "chapter_ids": list(
                        dict.fromkeys(cid for u in members for cid in u["chapter_ids"])
                    ),
                    "source_block_ids": [u["id"] for u in members],
                    "has_image": any(u["has_image"] for u in members),
                }
            for unit in self.search_units.values():
                unit["neighbors"] = {}
                for direction, key in (
                    ("previous", "previous_chunk_id"),
                    ("next", "next_chunk_id"),
                ):
                    neighbor = self.search_units.get(unit.get(key))
                    if neighbor:
                        unit["neighbors"][direction] = {
                            "block_id": neighbor["id"],
                            "page": neighbor["page"],
                        }
                originals = [self.units[uid] for uid in unit["source_block_ids"]]
                unit["source_block_neighbors"] = {
                    "previous": originals[0]["neighbors"].get("previous") if originals else None,
                    "next": originals[-1]["neighbors"].get("next") if originals else None,
                }
            for page, text in self.page_text.items():
                spans = sorted(
                    (u["page_start"], u["page_end"])
                    for u in self.search_units.values()
                    if u["page"] == page
                )
                if text.strip() and (
                    not spans
                    or spans[0][0] != 0
                    or spans[-1][1] != len(text)
                    or any(a[1] != b[0] for a, b in zip(spans, spans[1:], strict=False))
                ):
                    raise SourceError("incomplete_chunk_source_coverage")
        self.frequencies = {
            uid: Counter(tokens(u["content"])) for uid, u in self.search_units.items()
        }
        self.df = Counter(term for frequency in self.frequencies.values() for term in frequency)
        self.average_length = sum(sum(f.values()) for f in self.frequencies.values()) / max(
            1, len(self.search_units)
        )

    def info(self) -> dict:
        return {
            "source_id": self.source_id,
            "source_sha256": self.sha256,
            "filename": self.name,
            "pages": len(self.page_text),
            "page_basis": self.page_basis,
            "chunks": len(self.search_units),
        }

    def chunk_passage(self, chunk: str | dict) -> dict:
        if isinstance(chunk, str):
            prefix = self.source_id + ":"
            local = chunk[len(prefix) :] if chunk.startswith(prefix) else chunk
            if local not in self.search_units:
                raise SourceError("unknown_chunk")
            chunk = self.search_units[local]
        return self.passage(chunk)

    def chapter_units(self, chapter: dict) -> list[dict]:
        return [
            u
            for u in self.units.values()
            if chapter["start_block"] <= u["block_index"] < chapter["end_block_exclusive"]
        ]

    def passage(self, unit: dict, start: int = 0, end: int | None = None) -> dict:
        text = unit["content"]
        end = len(text) if end is None else min(end, len(text))
        start = min(start, end)
        page = unit["page"]
        page_start, page_end = unit["page_start"] + start, unit["page_start"] + end
        return {
            **unit,
            "id": f"{self.source_id}:{unit['id']}:{start}:{end}",
            "reference_id": f"{self.source_id}:{unit['id']}:{start}:{end}",
            "block_id": f"{self.source_id}:{unit['id']}",
            "content": text[start:end],
            "source_id": self.source_id,
            "source_sha256": self.sha256,
            "neighbors": {
                direction: {
                    **neighbor,
                    "block_id": f"{self.source_id}:{neighbor['block_id']}",
                    "source_id": self.source_id,
                }
                for direction, neighbor in unit.get("neighbors", {}).items()
            },
            "source_block_ids": [
                f"{self.source_id}:{uid}" for uid in unit.get("source_block_ids", [unit["id"]])
            ],
            "origin": "source",
            "file_path": self.name,
            "page_basis": self.page_basis,
            "boundaries": {
                "page": page,
                "pdf_page": page if self.metadata["stored_name"].endswith(".pdf") else None,
                "page_basis": self.page_basis,
                "page_char_start": page_start,
                "page_char_end_exclusive": page_end,
                "block_char_start": start,
                "block_char_end_exclusive": end,
                "extracted_line_start": self.page_text[page][:page_start].count("\n") + 1,
                "extracted_line_end": self.page_text[page][: max(page_start, page_end - 1)].count(
                    "\n"
                )
                + 1,
                "line_basis": "extracted text order, not printed line numbers",
            },
            "truncated": start > 0 or end < len(text),
            "source_url": f"/v1/documents/{self.source_id}/source#page={page}",
        }

    def lexical(self, query: str, top_k: int) -> list[dict]:
        terms = set(tokens(query))
        ranked = []
        n = len(self.search_units)
        for uid, frequencies in self.frequencies.items():
            length, score = sum(frequencies.values()), 0.0
            for term in terms:
                tf = frequencies[term]
                if tf:
                    idf = math.log(1 + (n - self.df[term] + 0.5) / (self.df[term] + 0.5))
                    score += (
                        idf
                        * tf
                        * 2.2
                        / (tf + 1.2 * (0.25 + 0.75 * length / max(1, self.average_length)))
                    )
            if score:
                ranked.append((score, uid))
        ranked.sort(key=lambda x: (-x[0], x[1]))
        return [
            {
                **self.chunk_passage(uid),
                "score": score,
                "score_kind": "BM25",
                "rank": rank + 1,
            }
            for rank, (score, uid) in enumerate(ranked[:top_k])
        ]

    def validate_source(self, source_id: str | None) -> None:
        if source_id is not None and source_id != self.source_id:
            raise SourceError("source_changed")

    def chapter(self, chapter_id: str) -> dict:
        for chapter in self.chapters:
            if chapter["id"] == chapter_id:
                return chapter
        raise SourceError("unknown_chapter")

    def read(self, kind: str, target: int | str, offset: int, limit: int) -> dict:
        if kind == "page":
            if target not in self.page_text:
                raise SourceError("unknown_page")
            members = [u for u in self.units.values() if u["page"] == target]
        else:
            members = self.chapter_units(self.chapter(str(target)))
        # Window offsets are over concatenated extracted block text with two newlines between.
        length = sum(len(u["content"]) + 2 for u in members)
        if offset > length:
            raise SourceError("offset_out_of_bounds")
        result, position = [], 0
        for unit in members:
            end = position + len(unit["content"])
            a, b = max(offset, position), min(offset + limit, end)
            if a < b or (not unit["content"] and offset <= position < offset + limit):
                result.append(self.passage(unit, a - position, b - position))
            position = end + 2
        cursor = {
            "source_id": self.source_id,
            "kind": kind,
            "target": target,
            "offset": offset,
            "limit": limit,
        }
        return {
            "passages": result,
            "cursor": cursor,
            "window": {
                "start": offset,
                "end_exclusive": min(offset + limit, length),
                "total_characters": length,
                "truncated": offset > 0 or offset + limit < length,
            },
            "has_more": offset + limit < length,
            "empty_extraction": not members,
        }

    def navigate(self, cursor: dict | None, direction: int) -> dict:
        if not cursor or set(cursor) != {"source_id", "kind", "target", "offset", "limit"}:
            raise SourceError("invalid_cursor")
        self.validate_source(cursor["source_id"])
        kind, target = cursor["kind"], cursor["target"]
        offset, limit = cursor["offset"], cursor["limit"]
        if (
            not isinstance(kind, str)
            or kind not in {"page", "chapter"}
            or type(offset) is not int
            or offset < 0
            or type(limit) is not int
            or not 200 <= limit <= 12000
            or (kind == "page" and type(target) is not int)
            or (kind == "chapter" and not isinstance(target, str))
        ):
            raise SourceError("invalid_cursor")
        current = self.read(kind, target, offset, limit)
        total = current["window"]["total_characters"]
        if direction > 0 and offset + limit < total:
            return self.read(kind, target, offset + limit, limit)
        if direction < 0 and offset > 0:
            return self.read(kind, target, max(0, offset - limit), limit)
        targets = (
            sorted(self.page_text)
            if kind == "page"
            else [
                c["id"]
                for c in self.chapters
                if c["parent_id"] == self.chapter(str(target))["parent_id"]
            ]
        )
        neighbor = targets.index(target) + direction
        if neighbor < 0 or neighbor >= len(targets):
            return {
                "passages": [],
                "cursor": cursor,
                "boundary": "start" if direction < 0 else "end",
            }
        target = targets[neighbor]
        read = self.read(kind, target, 0, limit)
        if direction < 0:
            offset = max(0, ((read["window"]["total_characters"] - 1) // limit) * limit)
            read = self.read(kind, target, offset, limit)
        return read

    def execute(self, request: ToolRequest) -> dict:
        self.validate_source(request.source_id)
        if request.source_ids is not None and request.source_ids != [self.source_id]:
            raise SourceError("source_changed")
        if request.tool == "toc":
            return {
                "chapters": self.chapters[request.offset : request.offset + request.top_k],
                "total": len(self.chapters),
                "next_offset": request.offset + request.top_k
                if request.offset + request.top_k < len(self.chapters)
                else None,
                "provenance": "Inferred from extracted headings; not a verified printed TOC",
            }
        if request.tool == "search":
            if not request.query.strip():
                raise SourceError("empty_query")
            return {"passages": self.lexical(request.query, request.top_k)}
        if request.tool == "read_page":
            return self.read("page", request.page, request.offset, request.limit)
        if request.tool == "read_chapter":
            return self.read("chapter", request.chapter_id, request.offset, request.limit)
        return self.navigate(request.cursor, 1 if request.tool == "next" else -1)


class ScopedBook:
    """An immutable allowed-source set with query-local narrowing and shared BM25."""

    def __init__(self, books: list[SourceBook]) -> None:
        self.books = sorted(books, key=lambda book: book.source_id)
        self.by_id = {book.source_id: book for book in self.books}
        if len(self.by_id) != len(self.books):
            raise SourceError("duplicate_source")
        self.source_ids = list(self.by_id)
        self.sources = [book.info() for book in self.books]
        self.source_id = (
            self.source_ids[0]
            if len(self.books) == 1
            else "scope_" + hashlib.sha256(json.dumps(self.source_ids).encode()).hexdigest()[:24]
        )
        self.sha256 = self.books[0].sha256 if len(self.books) == 1 else None
        self.chapters = [
            {**chapter, "source_id": book.source_id, "filename": book.name}
            for book in self.books
            for chapter in book.chapters
        ]
        self.search_units = {
            f"{book.source_id}:{uid}": {**unit, "source_id": book.source_id}
            for book in self.books
            for uid, unit in book.search_units.items()
        }
        self.frequencies = {
            uid: Counter(tokens(u["content"])) for uid, u in self.search_units.items()
        }
        self.df = Counter(term for frequency in self.frequencies.values() for term in frequency)
        self.average_length = sum(sum(f.values()) for f in self.frequencies.values()) / max(
            1, len(self.search_units)
        )

    def validate_source(self, source_id: str | None) -> None:
        if source_id is not None and source_id != self.source_id and source_id not in self.by_id:
            raise SourceError("source_not_in_scope")

    def subset(
        self, source_id: str | None = None, source_ids: list[str] | None = None
    ) -> "ScopedBook":
        if source_id is not None and source_ids is not None:
            raise SourceError("choose_source_id_or_source_ids")
        if source_id == self.source_id or (source_id is None and source_ids is None):
            return self
        selected = [source_id] if source_id is not None else source_ids
        if selected is None:
            return self
        if any(sid not in self.by_id for sid in selected):
            raise SourceError("source_not_in_scope")
        return ScopedBook([self.by_id[sid] for sid in dict.fromkeys(selected)])

    def select(self, request: SourceSelection) -> "ScopedBook":
        return self.subset(request.source_id, request.source_ids)

    def chunk_passage(self, chunk: str | dict) -> dict:
        if isinstance(chunk, str):
            if chunk not in self.search_units:
                raise SourceError("unknown_chunk")
            chunk = self.search_units[chunk]
        source_id = chunk.get("source_id")
        if source_id not in self.by_id:
            raise SourceError("source_not_in_scope")
        return self.by_id[source_id].chunk_passage(chunk["id"])

    def lexical(self, query: str, top_k: int) -> list[dict]:
        # The same scorer uses this scope's aggregate document frequencies.
        return SourceBook.lexical(self, query, top_k)

    def _navigation_book(self, request: ToolRequest) -> SourceBook:
        scope = self.select(request)
        cursor_source = (
            (request.cursor or {}).get("source_id") if request.tool in {"next", "back"} else None
        )
        if cursor_source is not None:
            if cursor_source not in scope.by_id:
                raise SourceError("source_not_in_scope")
            return scope.by_id[cursor_source]
        if len(scope.books) != 1:
            raise SourceError("navigation_requires_source_id")
        return scope.books[0]

    def execute(self, request: ToolRequest) -> dict:
        scope = self.select(request)
        if request.tool == "toc":
            return {
                "chapters": scope.chapters[request.offset : request.offset + request.top_k],
                "total": len(scope.chapters),
                "next_offset": (
                    request.offset + request.top_k
                    if request.offset + request.top_k < len(scope.chapters)
                    else None
                ),
                "sources": scope.sources,
                "provenance": "Inferred from extracted headings; not a verified printed TOC",
            }
        if request.tool == "search":
            if not request.query.strip():
                raise SourceError("empty_query")
            return {
                "passages": scope.lexical(request.query, request.top_k),
                "source_ids": scope.source_ids,
            }
        book = self._navigation_book(request)
        routed = request.model_copy(update={"source_id": book.source_id, "source_ids": None})
        return book.execute(routed)
