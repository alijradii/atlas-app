"""Exercise both HTTP paths through the real collector with synthetic provider tools."""

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from rag_service.api import create_app
from rag_service.config import Settings
from rag_service.engine import LibraryEngine, TrialEngine
from rag_service.retrieval_lib.source import SourceBook, SourceError

KEY = "test-service-key-00000000000000000000"
AUTH = {"Authorization": f"Bearer {KEY}"}


@pytest.fixture
def setup(tmp_path):
    folder = tmp_path / "library" / "source-one"
    folder.mkdir(parents=True)
    pdf = PdfWriter()
    pdf.add_blank_page(width=100, height=100)
    pdf.write(folder / "source.pdf")
    (folder / "content.json").write_text(
        json.dumps(
            [
                {"type": "text", "page_idx": 0, "text_level": 1, "text": "1. Pressure"},
                {"type": "text", "page_idx": 0, "text": "The valve opens at the pressure limit."},
            ]
        )
    )
    settings = Settings(tmp_path, KEY, "fake-provider-key", tmp_path / "mineru.json")
    book = SourceBook(folder)

    class Worker:
        trial = folder

        def __init__(self):
            self.book = book
            self.planner_calls = 0
            self.vector_calls = 0
            self.fail = False

        async def vector_search(self, question, top_k, dimensions, source_ids=None):
            self.vector_calls += 1
            self.budget.reserve("embedding", len(question))
            if self.fail:
                raise TimeoutError()
            return [{**book.passage(book.units["P1B1"], end=3000), "score": 0.98}]

        async def complete(self, prompt, **kwargs):
            self.planner_calls += 1
            self.budget.reserve("generation", len(prompt))
            if self.fail:
                raise TimeoutError()
            payload = json.loads(prompt)
            return json.dumps({"action": "finish", "accept": [payload["evidence"][0]["id"]]})

    class Library(LibraryEngine):
        info = {"state": "ready"}

        def __init__(self):
            super().__init__(settings)
            self.folder = folder
            self.engine = Worker()
            self.info = {"state": "ready"}
            self.books = {book.source_id: book}
            self.documents = {
                book.source_id: {
                    "source_id": book.source_id,
                    "name": "source.pdf",
                    "format": "pdf",
                    "state": "ready",
                }
            }

        async def start(self):
            pass

        async def close(self):
            pass

        def state(self):
            return {**self.info, "id": self.folder.name}

    library = Library()
    return settings, library


def test_separate_routes_no_planner_for_naive_and_literal_selected_agent_evidence(setup):
    settings, library = setup
    with TestClient(create_app(settings, library)) as client:
        body = {"source_id": library.folder.name, "question": "pressure valve"}
        normal = client.post("/v1/rag/naive", headers=AUTH, json=body)
        assert normal.status_code == 200
        packet = normal.json()
        assert packet["retrieval_mode"] == "naive" and packet["status"] == "completed"
        assert library.engine.planner_calls == 0 and library.engine.vector_calls == 1
        assert packet["candidates"][0]["content"] == "The valve opens at the pressure limit."
        assert len(packet["tool_calls"]) == 1
        agent = client.post("/v1/rag/agentic", headers=AUTH, json=body).json()
        assert agent["retrieval_mode"] == "agentic" and agent["selected"]
        assert library.engine.planner_calls == 1
        assert "answer" not in agent
        assert all(p["source_id"] == library.folder.name for p in agent["selected"])


def test_authentication_stale_source_and_input_contracts(setup):
    settings, library = setup
    with TestClient(create_app(settings, library)) as client:
        assert client.get("/health/live").status_code == 200
        for path in ["/v1/documents/current", "/v1/spend", "/source.pdf?source_id=source-one"]:
            assert client.get(path).status_code == 401
        body = {"source_id": library.folder.name, "question": "valve"}
        for path in ["/v1/rag/naive", "/v1/rag/agentic"]:
            assert client.post(path, json=body).status_code == 401
            assert (
                client.post(path, headers=AUTH, json={**body, "source_id": "stale"}).status_code
                == 409
            )
            assert (
                client.post(path, headers=AUTH, json={**body, "question": " "}).status_code == 422
            )
        assert (
            client.post(
                "/v1/rag/naive", headers=AUTH, json={**body, "strategy": "agent"}
            ).status_code
            == 422
        )
        assert (
            client.post("/v1/rag/agentic", headers=AUTH, json={**body, "max_steps": 9}).status_code
            == 422
        )


def test_stream_and_provider_failure_preserve_initial_evidence(setup):
    settings, library = setup
    library.engine.fail = True
    with TestClient(create_app(settings, library)) as client:
        body = {"source_id": library.folder.name, "question": "valve"}
        response = client.post("/v1/rag/agentic?stream=true", headers=AUTH, json=body)
        events = [json.loads(line) for line in response.text.splitlines()]
        assert events[0]["type"] == "status"
        assert events[-1]["type"] == "done"
        assert events[-1]["data"]["status"] == "provider_timeout"
        assert events[-1]["data"]["candidates"]
        # Lock is released even when the provider stops a run.
        normal = client.post("/v1/rag/naive", headers=AUTH, json={**body, "mode": "keyword"})
        assert normal.status_code == 200 and normal.json()["candidates"]
        assert library.engine.vector_calls == 0


def test_navigation_and_authenticated_pdf(setup):
    settings, library = setup
    with TestClient(create_app(settings, library)) as client:
        response = client.post(
            "/v1/tools", headers=AUTH, json={"source_id": "source-one", "tool": "read_page"}
        )
        assert response.status_code == 200 and response.json()["ok"]
        assert response.json()["data"]["passages"]
        pdf = client.get("/source.pdf?source_id=source-one", headers=AUTH)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")


def test_one_process_owns_data_directory(setup):
    settings, library = setup
    with TestClient(create_app(settings, library)):
        with pytest.raises(RuntimeError, match="already has"):
            with TestClient(create_app(settings, library)):
                pass


def test_partial_engine_close_is_safe_and_idempotent(setup):
    settings, library = setup
    engine = TrialEngine(library.folder, settings)

    async def exercise():
        await engine.close()
        await engine.close()

    asyncio.run(exercise())


def test_missing_vector_index_is_not_reported_as_completed(setup):
    settings, library = setup

    async def missing(*args, **kwargs):
        raise SourceError("vector_index_not_ready")

    library.engine.vector_search = missing
    with TestClient(create_app(settings, library)) as client:
        response = client.post(
            "/v1/rag/naive",
            headers=AUTH,
            json={"source_id": "source-one", "question": "valve"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "tool_failed"
        assert response.json()["tool_calls"][0]["code"] == "vector_index_not_ready"


def test_startup_failure_cleans_engine_and_a_later_upload_can_succeed(setup, monkeypatch):
    import rag_service.engine as module

    settings, source = setup
    settings.mineru_config.write_text("{}")
    closed = []

    class FailingEngine:
        def __init__(self, *args):
            self.budget = type("BudgetState", (), {"active": True})()

        async def start(self):
            raise RuntimeError("synthetic_startup_failure")

        async def close(self):
            closed.append(True)

    class CompletedParser:
        returncode = 0

        async def wait(self):
            return 0

    async def fake_parser(*args, **kwargs):
        (Path(args[2]) / "content.json").write_text((source.folder / "content.json").read_text())
        return CompletedParser()

    monkeypatch.setattr(module, "TrialEngine", FailingEngine)
    monkeypatch.setattr(module.asyncio, "create_subprocess_exec", fake_parser)
    library = LibraryEngine(settings)
    library.folder = source.folder
    library.info = {
        "state": "parsing",
        "name": "test.pdf",
        "started": 0,
        "source_id": source.folder.name,
    }
    asyncio.run(library.ingest())
    assert library.info["state"] == "failed" and library.engine is None and closed == [True]

    # Failed startup leaves no partially opened worker, allowing a later retry.
    assert library.select(source_ids=[]).source_ids == []


def test_persistence_relocation_and_interrupted_ingestion(setup):
    settings, library = setup
    # Receipts contain a source ID, never an absolute machine path.
    (settings.data_dir / "library/current.json").write_text(
        json.dumps(
            {
                "source_id": "source-one",
                "state": "indexing",
                "name": "Synthetic.pdf",
                "pages": 1,
            }
        )
    )
    engine = LibraryEngine(settings)
    asyncio.run(engine.start())
    assert engine.info["state"] == "failed"
    assert engine.folder == library.folder
    assert json.loads(engine.manifest.read_text())["state"] == "failed"


def test_malformed_upload_does_not_replace_current_source(setup):
    settings, _ = setup
    settings.mineru_config.write_text("{}")
    with TestClient(create_app(settings)) as client:
        assert client.post("/v1/documents", headers=AUTH, content=b"bad").status_code == 415
        result = client.post(
            "/v1/documents", headers={**AUTH, "Content-Type": "application/pdf"}, content=b"bad"
        )
        assert result.status_code == 422
        assert client.get("/v1/documents/current", headers=AUTH).json()["state"] == "empty"


def test_unavailable_worker_is_explicit_and_admission_lock_recovers(setup):

    settings, library = setup
    original = library.worker

    async def fail(scope):
        raise RuntimeError("synthetic storage unavailable")

    library.worker = fail
    with TestClient(create_app(settings, library)) as client:
        result = client.post("/v1/rag/naive", headers=AUTH, json={"question": "valve"})
        assert result.status_code == 503
        library.worker = original
        result = client.post(
            "/v1/rag/naive", headers=AUTH, json={"question": "valve", "mode": "keyword"}
        )
        assert result.status_code == 200


def test_trace_write_failure_does_not_discard_successful_evidence(setup):
    from dataclasses import replace

    settings, library = setup

    def fail(*args):
        raise OSError("synthetic trace disk failure")

    library.engine.save_trace = fail
    with TestClient(create_app(replace(settings, retain_traces=True), library)) as client:
        result = client.post(
            "/v1/rag/naive", headers=AUTH, json={"question": "valve", "mode": "keyword"}
        )
        assert result.status_code == 200 and result.json()["candidates"]


def test_multibyte_embedding_input_is_rejected_before_any_provider_reservation(setup):
    from rag_service.engine import Budget, Run

    settings, library = setup
    worker = TrialEngine(library.folder, settings)
    budget = Budget()

    async def discard(event):
        pass

    worker.current_run = Run(budget, discard)
    with pytest.raises(SourceError, match="2000_bytes"):
        asyncio.run(worker.embed(["界" * 700]))
    assert budget.embedding_calls == 0
    assert worker.ledger.state()["calls"] == 0
