"""Authenticated backend API with distinct single-search and agent contracts."""

import asyncio
import fcntl
import json
import secrets
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import Field

from .config import Settings
from .engine import Budget, LibraryEngine, Query, Run
from .retrieval_lib.collector import Collector, ToolSession
from .retrieval_lib.source import SourceSelection, ToolRequest


class RetrievalRequest(SourceSelection):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=6, ge=1, le=20)


class NaiveRequest(RetrievalRequest):
    mode: Literal["keyword", "vector", "hybrid"] = "vector"


class AgentRequest(RetrievalRequest):
    planner_model: Literal["gemini-2.5-flash", "gemini-2.5-pro"] = "gemini-2.5-pro"
    max_steps: int = Field(default=8, ge=1, le=8)


def create_app(settings: Settings, library=None) -> FastAPI:
    library = library if library is not None else LibraryEngine(settings)
    busy = asyncio.Lock()
    bearer = HTTPBearer(auto_error=False)

    async def authorize(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> None:
        if credentials is None or not secrets.compare_digest(
            credentials.credentials.encode(), settings.api_key.encode()
        ):
            raise HTTPException(
                401, "Invalid bearer credential", headers={"WWW-Authenticate": "Bearer"}
            )

    @asynccontextmanager
    async def lifespan(app):
        settings.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Milvus Lite and the shared storage file require exactly one owner.
        with (settings.data_dir / "service.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError("This data directory already has a running service") from None
            try:
                await library.start()
                yield
            finally:
                await library.close()

    app = FastAPI(title="RAG-Anything evidence service", version="2.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health/live")
    async def live():
        return {"status": "live"}

    @app.get("/health/ready", dependencies=[Depends(authorize)])
    async def ready():
        return {"status": "ready", "source_state": library.state()["state"], "busy": busy.locked()}

    @app.get("/v1/documents/current", dependencies=[Depends(authorize)])
    async def current():
        return library.state()

    @app.post("/v1/documents", status_code=202, dependencies=[Depends(authorize)])
    async def upload(request: Request):
        if busy.locked():
            raise HTTPException(409, "A retrieval operation is active")
        async with busy:
            return await library.upload(request)

    @app.get("/v1/documents", dependencies=[Depends(authorize)])
    async def documents():
        return library.catalog()

    @app.get("/v1/documents/{source_id}", dependencies=[Depends(authorize)])
    async def document(source_id: str):
        return library.document(source_id)

    async def worker_for(body):
        scope = library.select(body.source_id, body.source_ids)
        try:
            return await library.worker(scope)
        except Exception:
            raise HTTPException(503, "Storage or provider runtime unavailable") from None

    @app.get("/v1/documents/{source_id}/source", dependencies=[Depends(authorize)])
    async def original(source_id: str):
        metadata = library.document(source_id)
        folder = library.root / source_id
        stored_name = metadata.get("stored_name", "source.pdf")
        if Path(stored_name).name != stored_name:
            raise HTTPException(409, "Invalid stored document metadata")
        return FileResponse(
            folder / stored_name,
            media_type=metadata.get("media_type", "application/pdf"),
            filename=metadata["name"],
        )

    @app.get("/source.pdf", dependencies=[Depends(authorize)])
    async def source_pdf(source_id: str):
        if library.document(source_id).get("format", "pdf") != "pdf":
            raise HTTPException(415, "Use the document's source download endpoint")
        return await original(source_id)

    @app.get("/v1/spend", dependencies=[Depends(authorize)])
    async def spend():
        from .retrieval_lib.spend import SpendLedger

        return SpendLedger(settings.data_dir / "spend.sqlite", settings.spend_limit_usd).state()

    @app.post("/v1/tools", dependencies=[Depends(authorize)])
    async def tool(body: ToolRequest):
        if body.dimensions != 768:
            raise HTTPException(422, "This service builds 768-dimensional indexes")
        if busy.locked():
            raise HTTPException(409, "A retrieval operation is active")
        async with busy:
            worker = await worker_for(body)

            async def discard(event):
                pass

            worker.budget = Budget()
            worker.current_run = Run(worker.budget, discard)
            try:
                async with asyncio.timeout(120):
                    return await ToolSession(worker, worker.book).execute(body, "manual")
            except Exception:
                raise HTTPException(503, "Provider or tool unavailable") from None
            finally:
                worker.budget.active = False
                worker.current_run = None

    async def retrieve(body, request: Request, agentic: bool, stream: bool):
        if busy.locked():
            raise HTTPException(409, "A retrieval operation is active")
        await busy.acquire()
        try:
            worker = await worker_for(body)
        except BaseException:
            busy.release()
            raise

        async def execute(emit):
            started = time.monotonic()
            query = Query(
                **body.model_dump(exclude={"mode"}),
                strategy="agent" if agentic else "fast",
            )
            worker.budget = Budget(character_limit=600_000)
            run = Run(worker.budget, emit)
            worker.current_run = run
            collector = Collector(worker, query, emit)
            try:
                try:
                    async with asyncio.timeout(120):
                        if agentic:
                            packet = await collector.run()
                        else:
                            result = await collector.use(
                                ToolRequest(
                                    source_id=worker.book.source_id,
                                    tool="search",
                                    query=body.question,
                                    mode=body.mode,
                                    top_k=body.top_k,
                                ),
                                "naive",
                            )
                            if not result["ok"]:
                                collector.outcome = "tool_failed"
                            packet = await collector.packet()
                except TimeoutError:
                    collector.outcome = "timeout"
                    packet = await collector.packet()
                except Exception as exc:
                    collector.outcome = (
                        "budget_exceeded"
                        if type(exc).__name__ in {"SpendLimit", "BudgetExceeded"}
                        else "provider_or_tool_failed"
                    )
                    packet = await collector.packet()
                packet["retrieval_mode"] = "agentic" if agentic else "naive"
                packet["metrics"] = {
                    "seconds": round(time.monotonic() - started, 3),
                    "generation_calls": worker.budget.generation_calls,
                    "embedding_calls": worker.budget.embedding_calls,
                }
                return packet
            finally:
                worker.budget.active = False
                worker.current_run = None
                if settings.retain_traces:
                    # Optional diagnostic storage must not discard a completed packet.
                    with suppress(OSError):
                        worker.save_trace(secrets.token_hex(12), query, run)

        if not stream:

            async def discard(event):
                pass

            try:
                return await execute(discard)
            finally:
                busy.release()

        async def events():
            queue = asyncio.Queue()

            async def produce():
                try:
                    packet = await execute(queue.put)
                    await queue.put({"type": "done", "data": packet})
                except Exception:
                    await queue.put({"type": "error", "code": "retrieval_failed"})

            task = asyncio.create_task(produce())
            try:
                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=3)
                    except TimeoutError:
                        event = {"type": "heartbeat"}
                    yield json.dumps(event) + "\n"
                    if event["type"] in {"done", "error"}:
                        break
            finally:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
                busy.release()

        return StreamingResponse(events(), media_type="application/x-ndjson")

    @app.post("/v1/rag/naive", dependencies=[Depends(authorize)])
    async def naive(body: NaiveRequest, request: Request, stream: bool = False):
        return await retrieve(body, request, False, stream)

    @app.post("/v1/rag/agentic", dependencies=[Depends(authorize)])
    async def agentic(body: AgentRequest, request: Request, stream: bool = False):
        return await retrieve(body, request, True, stream)

    return app
