"""Portable ingestion and provider adapters from the improved RAG-Anything trial."""

from __future__ import annotations

import asyncio
import json
import secrets
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from fastapi import HTTPException, Request
from pydantic import Field

from .config import Settings
from .retrieval_lib.collector import Collector
from .retrieval_lib.source import ScopedBook, SourceBook, SourceError, SourceSelection
from .retrieval_lib.spend import SpendLedger
from .retrieval_lib.vectors import build_vectors

HERE = Path(__file__).resolve().parent

Emit = Callable[[dict[str, Any]], Awaitable[None]]


class Query(SourceSelection):
    question: str = Field(min_length=1, max_length=2000)
    strategy: Literal["fast", "agent"] = "agent"
    planner_model: Literal["gemini-2.5-flash", "gemini-2.5-pro"] = "gemini-2.5-pro"
    dimensions: Literal[768, 1536, 3072] = 768
    top_k: int = Field(default=6, ge=1, le=20)
    max_steps: int = Field(default=8, ge=1, le=8)


class BudgetExceeded(RuntimeError):
    """A provider request was blocked before sending it."""


class Budget:
    """Separate request ceilings from the process-wide interactive allowance."""

    def __init__(
        self,
        generation_limit: int = 12,
        embedding_limit: int = 24,
        character_limit: int = 250_000,
        session_limit: int = 1_000_000_000,
    ) -> None:
        self.generation_limit = generation_limit
        self.embedding_limit = embedding_limit
        self.character_limit = character_limit
        self.session_limit = session_limit
        self.session_calls = 0
        self.reset()

    def reset(self) -> None:
        self.generation_calls = self.embedding_calls = self.characters = 0
        self.prompt_tokens = self.output_tokens = self.thought_tokens = self.images = 0
        self.active = True

    def reserve(self, kind: str, characters: int) -> None:
        calls = self.generation_calls if kind == "generation" else self.embedding_calls
        limit = self.generation_limit if kind == "generation" else self.embedding_limit
        if not self.active or calls >= limit or self.characters + characters > self.character_limit:
            raise BudgetExceeded("request_limit")
        if self.session_calls >= self.session_limit:
            raise BudgetExceeded("session_limit")
        self.session_calls += 1
        self.characters += characters
        if kind == "generation":
            self.generation_calls += 1
        else:
            self.embedding_calls += 1


@dataclass
class Run:
    budget: Budget
    emit: Emit
    trace: list[dict[str, Any]] = field(default_factory=list)


class TrialEngine:
    """Lazy imports keep the candidate dependencies out of the application environment."""

    def __init__(self, trial: Path, settings: Settings) -> None:
        self.settings = settings
        self.trial = trial.resolve()
        self.budget = Budget()
        self.ledger = SpendLedger(settings.data_dir / "spend.sqlite", settings.spend_limit_usd)
        self.current_run: Run | None = None

    async def start(self) -> None:
        from google import genai
        from google.genai import types
        from pymilvus import MilvusClient

        index = self.settings.data_dir / "index"
        index.mkdir(parents=True, exist_ok=True)
        self.vector_client = MilvusClient(str(index / "milvus.db"))
        self.client = genai.Client(
            api_key=self.settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=60000, retry_options=types.HttpRetryOptions(attempts=1)
            ),
        )
        self.book = ScopedBook([])

    async def close(self) -> None:
        client, vectors = getattr(self, "client", None), getattr(self, "vector_client", None)
        self.client = self.vector_client = None
        try:
            if vectors is not None:
                vectors.close()
        finally:
            if client is not None:
                await client.aio.aclose()

    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        history_messages: Any = None,
        image_data: str | None = None,
        messages: Any = None,
        **kwargs: Any,
    ) -> str:
        import base64

        from google.genai import types

        parts = []
        if messages:
            for message in messages:
                content = message.get("content", "")
                if message.get("role") == "system":
                    system_prompt = content
                elif isinstance(content, str):
                    parts.append(types.Part.from_text(text=content))
                else:
                    for part in content:
                        if part.get("type") == "text":
                            parts.append(types.Part.from_text(text=part["text"]))
                        elif part.get("type") == "image_url":
                            header, data = part["image_url"]["url"].split(",", 1)
                            if not header.startswith("data:image/"):
                                raise ValueError("Only inline image evidence is supported")
                            parts.append(
                                types.Part.from_bytes(
                                    data=base64.b64decode(data), mime_type=header[5:].split(";")[0]
                                )
                            )
        else:
            if history_messages:
                prompt = json.dumps(history_messages) + "\n" + prompt
            parts.append(types.Part.from_text(text=prompt))
            if image_data:
                parts.append(
                    types.Part.from_bytes(data=base64.b64decode(image_data), mime_type="image/jpeg")
                )
        run = self.current_run
        if run is None:
            raise BudgetExceeded("no_active_query")
        budget = run.budget
        chars = sum(len(part.text or "") for part in parts) + len(system_prompt or "")
        budget.reserve("generation", chars)
        budget.images += sum(bool(part.inline_data) for part in parts)
        keyword = bool(kwargs.get("keyword_extraction"))
        record = {
            "kind": "keywords" if keyword else "planner",
            "system": system_prompt,
            "text": [part.text for part in parts if part.text],
            "images": sum(bool(part.inline_data) for part in parts),
            "thinking_budget": kwargs.get("reasoning_tokens", 0),
            "response_schema": kwargs.get("response_schema"),
            "model": kwargs.get("answer_model", "gemini-2.5-flash"),
        }
        run.trace.append(record)
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0,
            max_output_tokens=4096,
            thinking_config=types.ThinkingConfig(thinking_budget=kwargs.get("reasoning_tokens", 0)),
            response_mime_type="application/json"
            if keyword or kwargs.get("response_schema")
            else "text/plain",
            response_json_schema=kwargs.get("response_schema"),
        )
        call_id = self.ledger.reserve(
            kwargs.get("answer_model", "gemini-2.5-flash"),
            sum(len((part.text or "").encode()) for part in parts)
            + len((system_prompt or "").encode())
            + len(json.dumps(kwargs.get("response_schema", {})).encode()),
            output_tokens=4096 + kwargs.get("reasoning_tokens", 0),
            images=sum(bool(part.inline_data) for part in parts),
        )
        chunks = []
        usage = None
        stream = await self.client.aio.models.generate_content_stream(
            model=kwargs.get("answer_model", "gemini-2.5-flash"),
            contents=[types.Content(role="user", parts=parts)],
            config=config,
        )
        try:
            async for chunk in stream:
                if not budget.active:
                    raise BudgetExceeded("cancelled")
                if chunk.text:
                    chunks.append(chunk.text)
                if chunk.usage_metadata:
                    usage = chunk.usage_metadata
            if not chunks:
                raise RuntimeError("empty_model_response")
            if usage is not None:
                budget.prompt_tokens += usage.prompt_token_count or 0
                budget.output_tokens += usage.candidates_token_count or 0
                budget.thought_tokens += usage.thoughts_token_count or 0
                self.ledger.record(
                    call_id,
                    usage.prompt_token_count or 0,
                    (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0),
                )
            record["output"] = "".join(chunks)
            return record["output"]
        finally:
            await stream.aclose()

    async def embed(self, texts: list[str], context: str = "document", **kwargs: Any) -> Any:
        import numpy as np
        from google.genai import types

        run = self.current_run
        if run is None:
            raise BudgetExceeded("no_active_query")
        if any(len(text.encode("utf-8")) > 2000 for text in texts):
            raise SourceError("embedding_input_exceeds_2000_bytes")
        run.budget.reserve("embedding", sum(map(len, texts)))
        self.ledger.reserve("gemini-embedding-001", sum(len(t.encode()) for t in texts))
        response = await self.client.aio.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
            config=types.EmbedContentConfig(
                output_dimensionality=kwargs.get("dimensions", 768),
                task_type="RETRIEVAL_QUERY" if context == "query" else "RETRIEVAL_DOCUMENT",
            ),
        )
        metadata = getattr(response, "metadata", None)
        billed = getattr(metadata, "billable_character_count", None)
        # Embedding API responses do not consistently report token usage; keep upper reservation.
        if billed is not None:
            self.current_run.trace.append(
                {"kind": "embedding_usage", "billable_characters": billed}
            )
        values = np.asarray([item.values for item in response.embeddings], dtype=float)
        norms = np.linalg.norm(values, axis=1, keepdims=True)
        if not np.isfinite(values).all() or (norms == 0).any():
            raise ValueError("invalid_vectors")
        return values / norms

    async def query(self, query: Query, emit: Emit) -> dict[str, Any]:
        session_calls = self.budget.session_calls
        self.budget = Budget(character_limit=600_000)
        self.budget.session_calls = session_calls
        run = Run(self.budget, emit)
        self.current_run = run
        started, trace_id = time.monotonic(), secrets.token_hex(12)
        try:
            if self.book is None:
                raise SourceError("original_source_unavailable")
            packet = await Collector(self, query, emit).run()
            return {
                "seconds": round(time.monotonic() - started, 2),
                "outcome": packet["status"],
                "generation_calls": self.budget.generation_calls,
                "embedding_calls": self.budget.embedding_calls,
                "trace_id": trace_id,
                "planner_model": query.planner_model,
                "spend": self.ledger.state(),
            }
        finally:
            self.budget.active = False
            self.current_run = None
            self.save_trace(trace_id, query, run)

    async def vector_search(
        self, query: str, top_k: int, dimensions: int, source_ids: list[str] | None = None
    ) -> list[dict]:
        selected = self.book.source_ids if source_ids is None else source_ids
        if not set(selected) <= set(self.book.source_ids):
            raise SourceError("source_outside_selection")
        if not selected:
            return []
        collection = f"context_chunks_{dimensions}"
        client = self.vector_client
        if not client.has_collection(collection):
            raise SourceError("vector_index_not_ready")
        # A fresh service process reopens persisted collections as released.
        client.load_collection(collection_name=collection)
        for uid in selected:
            book = self.book.by_id[uid]
            manifest = book.folder / f"source-vectors-{dimensions}.json"
            if not manifest.exists():
                raise SourceError("vector_index_not_ready")
            metadata = json.loads(manifest.read_text())
            if (
                metadata.get("source_sha256") != book.sha256
                or metadata.get("chunk_fingerprint") != book.chunk_metadata["fingerprint"]
            ):
                raise SourceError("vector_index_source_mismatch")
            count = client.query(
                collection_name=collection,
                filter="source_id == " + json.dumps(uid),
                output_fields=["count(*)"],
            )[0]["count(*)"]
            if int(count) != len(book.search_units):
                raise SourceError("vector_index_incomplete")
        embedding = await self.embed([query], context="query", dimensions=dimensions)
        result = client.search(
            collection_name=collection,
            data=embedding.tolist(),
            filter="source_id in " + json.dumps(selected),
            limit=top_k,
            output_fields=["source_id", "chunk_id"],
            search_params={"metric_type": "COSINE"},
        )
        return [
            {
                **self.book.by_id[row["entity"]["source_id"]].chunk_passage(
                    row["entity"]["chunk_id"]
                ),
                "score": row["distance"],
                "score_kind": "cosine",
                "dimensions": dimensions,
                "embedding_model": "gemini-embedding-001",
            }
            for row in result[0]
        ]

    def save_trace(self, trace_id: str, query: Query, run: Run) -> None:
        """Keep actual model inputs private and bounded; never write them to logs."""
        import os

        if not self.settings.retain_traces:
            return
        folder = self.trial / "query-traces"
        folder.mkdir(mode=0o700, exist_ok=True)
        path = folder / f"{trace_id}.json"
        with open(path, "x", opener=lambda p, flags: os.open(p, flags, 0o600)) as handle:
            json.dump({"query": query.model_dump(), "calls": run.trace}, handle, indent=2)
        for old in sorted(folder.glob("*.json"), key=lambda p: p.stat().st_mtime)[:-30]:
            old.unlink()


class LibraryEngine:
    """Persistent document catalog; each request binds an immutable ready-source scope."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.root = settings.data_dir / "library"
        self.root.mkdir(parents=True, exist_ok=True)
        self.manifest = self.root / "current.json"
        self.info: dict[str, Any] = {"state": "empty", "name": "No documents", "pages": 0}
        self.documents: dict[str, dict] = {}
        self.books: dict[str, SourceBook] = {}
        self.engine: TrialEngine | None = None
        self.task: asyncio.Task[None] | None = None
        self.folder: Path | None = None

    def save(self) -> None:
        if self.folder:
            receipt = {**self.info, "id": self.folder.name}
            self.documents[self.folder.name] = receipt
            path = self.folder / "receipt.json"
            target = path.with_suffix(".tmp")
            target.write_text(json.dumps(receipt, indent=2))
            target.replace(path)
        target = self.manifest.with_suffix(".tmp")
        target.write_text(json.dumps(self.info, indent=2))
        target.replace(self.manifest)

    def state(self) -> dict[str, Any]:
        state = {**self.info, "id": self.folder.name if self.folder else None}
        if state.get("started") and state["state"] in {"parsing", "indexing"}:
            state["elapsed"] = round(time.time() - state["started"])
        return state

    def catalog(self) -> dict:
        from .documents import FORMATS, parser_requirements

        return {
            "documents": list(self.documents.values()),
            "default_source_ids": sorted(self.books),
            "selection_default": "all_ready",
            "formats": [
                {
                    "extension": f.extension,
                    "media_type": f.media_type,
                    "missing_requirements": parser_requirements(f, self.settings.mineru_config),
                }
                for f in FORMATS.values()
            ],
        }

    def document(self, source_id: str) -> dict:
        if source_id not in self.documents:
            raise HTTPException(404, "Unknown document ID")
        return self.documents[source_id]

    def select(self, source_id: str | None = None, source_ids: list[str] | None = None):
        if self.task and not self.task.done():
            raise HTTPException(409, "Document ingestion is active; poll its receipt")
        selected = (
            [source_id]
            if source_id is not None
            else (sorted(self.books) if source_ids is None else list(dict.fromkeys(source_ids)))
        )
        if any(uid not in self.books for uid in selected):
            raise HTTPException(409, "Every selected source must exist and be ready")
        return ScopedBook([self.books[uid] for uid in selected])

    async def worker(self, selection):
        if self.engine is None:
            self.engine = TrialEngine(self.settings.data_dir, self.settings)
            try:
                await self.engine.start()
            except BaseException:
                await self.engine.close()
                self.engine = None
                raise
        self.engine.book = selection
        return self.engine

    async def start(self) -> None:
        for path in sorted(self.root.glob("*/receipt.json")):
            receipt = json.loads(path.read_text())
            uid = path.parent.name
            if receipt.get("source_id") != uid:
                raise RuntimeError("Invalid document receipt")
            if receipt["state"] == "ready" and not (path.parent / "chunks.json").is_file():
                receipt.update(state="failed", message="Legacy index: upload again to reindex")
            elif receipt["state"] not in {"ready", "failed"}:
                receipt.update(state="failed", message="Processing interrupted; upload again")
            path.write_text(json.dumps(receipt, indent=2))
            self.documents[uid] = receipt
            if receipt["state"] == "ready":
                self.books[uid] = SourceBook(path.parent)
        if self.manifest.exists():
            self.info = json.loads(self.manifest.read_text())
            uid = self.info.get("source_id", "")
            if not uid or Path(uid).name != uid or uid in {".", ".."}:
                raise RuntimeError("Invalid source manifest")
            self.folder = self.root / uid
            if uid in self.documents:
                self.info = self.documents[uid]
            else:
                self.info.update(state="failed", message="Legacy index: upload again to reindex")
                self.save()

    async def close(self) -> None:
        if self.task and not self.task.done():
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
        if self.engine:
            await self.engine.close()

    async def upload(self, request: Request) -> dict[str, Any]:
        import hashlib
        import uuid
        from urllib.parse import unquote

        from .documents import identify_upload, parser_requirements, validate_upload

        if self.task and not self.task.done():
            raise HTTPException(409, "A document is already being processed")
        media = request.headers.get("content-type", "").partition(";")[0]
        name = Path(
            unquote(
                request.headers.get(
                    "x-file-name", "Uploaded.pdf" if media == "application/pdf" else ""
                )
            )
        ).name[:160]
        try:
            info = identify_upload(name, media)
        except ValueError as exc:
            raise HTTPException(415, str(exc)) from None
        length = request.headers.get("content-length", "")
        if length.isdigit() and int(length) > 100 * 1024 * 1024:
            raise HTTPException(413, "Document limit is 100 MiB")
        folder = self.root / uuid.uuid4().hex
        folder.mkdir()
        original = folder / ("original" + info.extension)
        size, digest = 0, hashlib.sha256()
        try:
            with original.open("wb") as output:
                async for block in request.stream():
                    size += len(block)
                    if size > 100 * 1024 * 1024:
                        raise HTTPException(413, "Document limit is 100 MiB")
                    output.write(block)
                    digest.update(block)
            try:
                metadata = await asyncio.to_thread(validate_upload, original, info)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from None
            missing = parser_requirements(info, self.settings.mineru_config)
            if missing:
                raise HTTPException(503, {"missing_requirements": missing})
        except BaseException:
            original.unlink(missing_ok=True)
            folder.rmdir()
            raise
        source = {
            "filename": name,
            "stored_name": original.name,
            "format": info.format,
            "media_type": info.media_type,
            "source_sha256": digest.hexdigest(),
            **metadata,
        }
        (folder / "source.json").write_text(json.dumps(source, indent=2))
        self.folder = folder
        self.info = {
            "state": "parsing",
            "name": name,
            "source_id": folder.name,
            "bytes": size,
            "started": time.time(),
            **source,
        }
        self.save()
        self.task = asyncio.create_task(self.ingest())
        return self.state()

    async def ingest(self) -> None:
        import os
        import signal
        import sys

        from .retrieval_lib.chunking import prepare_chunks

        if self.folder is None:
            raise RuntimeError("Missing document folder")
        folder = self.folder
        process = None
        try:
            with (folder / "parser.log").open("wb") as log:
                env = os.environ.copy()
                env["MINERU_TOOLS_CONFIG_JSON"] = str(self.settings.mineru_config)
                process = await asyncio.create_subprocess_exec(
                    sys.executable,
                    str(HERE / "parse_document.py"),
                    str(folder),
                    stdout=log,
                    stderr=log,
                    env=env,
                    start_new_session=True,
                )
                async with asyncio.timeout(3600):
                    if await process.wait() != 0:
                        raise RuntimeError("parser_failed")
            content = json.loads((folder / "content.json").read_text())
            if not content:
                raise RuntimeError("no_extractable_content")
            metadata_path = folder / "source.json"
            if metadata_path.exists():
                self.info.update(json.loads(metadata_path.read_text()))
            self.info.update(state="indexing", blocks=len(content))
            self.save()
            book = SourceBook(folder)
            worker = await self.worker(ScopedBook([book]))
            budget = Budget(
                generation_limit=128,
                embedding_limit=12000,
                character_limit=25_000_000,
                session_limit=12128,
            )
            worker.budget = budget

            async def progress(event: dict[str, Any]) -> None:
                pass

            worker.current_run = Run(budget, progress)
            async with asyncio.timeout(7200):
                chunks = await prepare_chunks(book, worker.complete, mode=self.settings.chunk_mode)
                (folder / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False))
                book = SourceBook(folder)
                await build_vectors(worker, [768], book=book)
            self.books[book.source_id] = book
            self.info.update(
                state="ready",
                chunks=len(chunks["chunks"]),
                chunk_mode=self.settings.chunk_mode,
                generation_calls=budget.generation_calls,
                embedding_calls=budget.embedding_calls,
                prompt_tokens=budget.prompt_tokens,
                output_tokens=budget.output_tokens,
                seconds=round(time.time() - self.info["started"]),
            )
            self.save()
        except asyncio.CancelledError:
            self.info.update(
                state="failed", message="Processing interrupted; upload again to retry"
            )
            self.save()
            raise
        except Exception as exc:
            from .retrieval_lib.chunking import ChunkingError

            code = str(exc) if isinstance(exc, (ChunkingError, SourceError)) else type(exc).__name__
            self.info.update(
                state="failed",
                error_code=code,
                message=f"Processing stopped ({code}); upload again after resolving the cause. "
                "Extraction failures have details in the private parser.log.",
            )
            self.save()
        finally:
            if process and process.returncode is None:
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    await asyncio.wait_for(process.wait(), timeout=10)
                except TimeoutError:
                    with suppress(ProcessLookupError):
                        os.killpg(process.pid, signal.SIGKILL)
                    await process.wait()
            if self.engine:
                self.engine.budget.active = False
                self.engine.current_run = None
                self.engine.book = ScopedBook([])
