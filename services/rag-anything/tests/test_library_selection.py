"""Independent integration QA for actual library, API, collector and vector contracts."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import httpx
import numpy as np
import pytest
from fastapi import HTTPException

from rag_service import documents
from rag_service import engine as engine_module
from rag_service.api import create_app
from rag_service.config import Settings
from rag_service.engine import LibraryEngine, TrialEngine

KEY = "selection-test-key-00000000000000000"
AUTH = {"Authorization": f"Bearer {KEY}"}


class MemoryVectors:
    def __init__(self):
        self.rows = {}
        self.filters = []
        self.exists = False
        self.fail_upsert = False
        self.loaded = False

    def has_collection(self, name):
        return self.exists

    def create_collection(self, **kwargs):
        self.exists = True

    def load_collection(self, **kwargs):
        self.loaded = True

    def delete(self, *, filter, **kwargs):
        source_id = json.loads(filter.split(" == ", 1)[1])
        self.rows = {k: v for k, v in self.rows.items() if v["source_id"] != source_id}

    def upsert(self, *, data, **kwargs):
        if self.fail_upsert:
            raise RuntimeError("simulated vector write failure")
        self.rows.update({row["id"]: row for row in data})

    def flush(self, **kwargs):
        pass

    def query(self, *, filter, **kwargs):
        assert self.loaded, "collection must load before count verification"
        source_id = json.loads(filter.split(" == ", 1)[1])
        return [{"count(*)": sum(row["source_id"] == source_id for row in self.rows.values())}]

    def search(self, *, filter, limit, **kwargs):
        assert self.loaded, "collection must load after restart"
        self.filters.append(filter)
        selected = json.loads(filter.split(" in ", 1)[1])
        return [
            [
                {"entity": row, "distance": 0.9}
                for row in self.rows.values()
                if row["source_id"] in selected
            ][:limit]
        ]

    def close(self):
        pass


class ProviderRuntime(TrialEngine):
    async def start(self):
        self.vector_client = MemoryVectors()
        self.client = None
        self.decisions = []
        self.embedded = []

    async def embed(self, texts, context="document", **kwargs):
        self.budget.reserve("embedding", sum(map(len, texts)))
        self.embedded.extend(texts)
        return np.asarray([[1.0, 0.0] for _ in texts])

    async def complete(self, prompt, **kwargs):
        self.budget.reserve("generation", len(prompt))
        if self.decisions:
            return json.dumps(self.decisions.pop(0))
        return json.dumps({"action": "finish"})


@pytest.fixture
def setup(tmp_path, monkeypatch):
    settings = Settings(
        tmp_path, KEY, "synthetic-provider", tmp_path / "mineru.json", chunk_mode="structural"
    )
    library = LibraryEngine(settings)
    monkeypatch.setattr(engine_module, "TrialEngine", ProviderRuntime)
    monkeypatch.setattr(documents, "parser_requirements", lambda *args: [])

    async def parse(*args, **kwargs):
        folder = Path(args[2])
        metadata = json.loads((folder / "source.json").read_text())
        text = (folder / metadata["stored_name"]).read_text()
        (folder / "content.json").write_text(
            json.dumps(
                [
                    {"type": "text", "page_idx": 0, "text": "Scope heading", "text_level": 1},
                    {"type": "text", "page_idx": 0, "text": text},
                ]
            )
        )

        async def wait():
            return 0

        return SimpleNamespace(wait=wait, returncode=0)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", parse)
    return settings, library


async def upload(client, library, name, text):
    response = await client.post(
        "/v1/documents",
        headers={**AUTH, "X-File-Name": name, "Content-Type": "text/plain"},
        content=text,
    )
    assert response.status_code == 202, response.text
    source_id = response.json()["source_id"]
    await library.task
    return source_id


def test_api_real_upload_all_subset_empty_and_hybrid_vector_filters(setup):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            b = await upload(client, library, "beta.txt", "valve beta source")
            assert set(library.books) == {a, b}
            catalog = (await client.get("/v1/documents", headers=AUTH)).json()
            assert set(catalog["default_source_ids"]) == {a, b}
            for mode in ("keyword", "vector", "hybrid"):
                base = {"question": "valve", "mode": mode}
                all_result = await client.post("/v1/rag/naive", headers=AUTH, json=base)
                assert all_result.status_code == 200, all_result.text
                assert {p["source_id"] for p in all_result.json()["candidates"]} == {a, b}
                subset = (
                    await client.post(
                        "/v1/rag/naive", headers=AUTH, json={**base, "source_ids": [b, b]}
                    )
                ).json()
                assert subset["source_ids"] == [b]
                assert {p["source_id"] for p in subset["candidates"]} == {b}
                empty = (
                    await client.post(
                        "/v1/rag/naive", headers=AUTH, json={**base, "source_ids": []}
                    )
                ).json()
                assert empty["source_ids"] == [] and empty["candidates"] == []
                bad = await client.post(
                    "/v1/rag/naive", headers=AUTH, json={**base, "source_ids": [a, "unknown"]}
                )
                assert bad.status_code == 409
            assert library.engine.vector_client.filters[-1] == "source_id in " + json.dumps([b])
            assert all(len(t.encode()) <= 2000 for t in library.engine.embedded)
            assert all(
                (book.folder / "source-vectors-768.json").exists()
                for book in library.books.values()
            )
            raw = await client.get(f"/v1/documents/{a}/source", headers=AUTH)
            assert raw.status_code == 200 and raw.text == "valve alpha source"

    asyncio.run(exercise())


def test_agent_scope_escape_rejected_and_navigation_stays_selected(setup):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            b = await upload(client, library, "beta.txt", "valve beta secret")
            library.engine.decisions = [
                {"action": "read_page", "source_id": b, "page": 1},
                {"action": "read_page", "source_id": a, "page": 1},
                {"action": "finish"},
            ]
            response = await client.post(
                "/v1/rag/agentic", headers=AUTH, json={"source_ids": [a], "question": "valve"}
            )
            assert response.status_code == 200
            packet = response.json()
            assert packet["status"] == "completed"
            assert {p["source_id"] for p in packet["candidates"]} == {a}
            denied = [c for c in packet["tool_calls"] if not c["ok"]]
            assert len(denied) == 1 and denied[0]["code"] == "source_not_in_scope"
            first = (
                await client.post(
                    "/v1/tools", headers=AUTH, json={"tool": "read_page", "source_id": a}
                )
            ).json()
            switched = (
                await client.post(
                    "/v1/tools",
                    headers=AUTH,
                    json={"tool": "read_page", "source_id": b, "cursor": first["data"]["cursor"]},
                )
            ).json()
            assert switched["ok"]
            assert {p["source_id"] for p in switched["data"]["passages"]} == {b}

    asyncio.run(exercise())


def test_scope_snapshot_and_ready_catalog_survive_new_upload_and_restart(setup):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            snapshot = library.select()
            b = await upload(client, library, "beta.txt", "valve beta source")
            assert snapshot.source_ids == [a]
            assert {p["source_id"] for p in snapshot.lexical("valve", 20)} == {a}
            assert set(library.select().source_ids) == {a, b}
            resumed = LibraryEngine(settings)
            await resumed.start()
            assert set(resumed.books) == {a, b}
            assert {p["source_id"] for p in resumed.select().lexical("valve", 20)} == {a, b}
            assert resumed.state()["state"] == "ready"

    asyncio.run(exercise())


def test_failed_vector_ingestion_keeps_prior_sources_ready_and_failure_persists(setup):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            library.engine.vector_client.fail_upsert = True
            failed = await upload(client, library, "broken.txt", "valve failed source")
            assert library.documents[failed]["state"] == "failed"
            assert set(library.books) == {a}
            assert library.select().source_ids == [a]
            with pytest.raises(HTTPException):
                library.select(source_ids=[failed])
            resumed = LibraryEngine(settings)
            await resumed.start()
            assert resumed.documents[failed]["state"] == "failed"
            assert resumed.select().source_ids == [a]

    asyncio.run(exercise())


def test_interrupted_receipt_is_failed_on_restart_never_selected(setup):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            library.documents[a]["state"] = "indexing"
            (library.root / a / "receipt.json").write_text(json.dumps(library.documents[a]))
            resumed = LibraryEngine(settings)
            await resumed.start()
            assert resumed.documents[a]["state"] == "failed"
            assert resumed.select().source_ids == []
            with pytest.raises(HTTPException):
                resumed.select(source_id=a)

    asyncio.run(exercise())


def test_cancelled_ingestion_records_failure_and_keeps_existing_catalog(setup, monkeypatch):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            entered = asyncio.Event()

            async def slow_parse(*args, **kwargs):
                async def wait():
                    entered.set()
                    await asyncio.Event().wait()

                return SimpleNamespace(wait=wait, returncode=0)

            monkeypatch.setattr(asyncio, "create_subprocess_exec", slow_parse)
            response = await client.post(
                "/v1/documents",
                headers={**AUTH, "X-File-Name": "cancel.txt", "Content-Type": "text/plain"},
                content="A valid text upload.",
            )
            assert response.status_code == 202
            cancelled = response.json()["source_id"]
            await entered.wait()
            blocked = await client.post(
                "/v1/rag/naive", headers=AUTH, json={"question": "valve", "source_ids": [a]}
            )
            assert blocked.status_code == 409
            library.task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await library.task
            assert library.documents[cancelled]["state"] == "failed"
            assert library.select().source_ids == [a]
            resumed = LibraryEngine(settings)
            await resumed.start()
            assert resumed.documents[cancelled]["state"] == "failed"
            assert resumed.select().source_ids == [a]

    asyncio.run(exercise())


@pytest.mark.parametrize(
    "damage,expected",
    [
        ("fingerprint", "vector_index_source_mismatch"),
        ("count", "vector_index_incomplete"),
        ("missing_manifest", "vector_index_not_ready"),
    ],
)
def test_stale_or_partial_vector_index_fails_before_query_embedding(setup, damage, expected):
    settings, library = setup

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(settings, library)), base_url="http://test"
        ) as client:
            a = await upload(client, library, "alpha.txt", "valve alpha source")
            manifest = library.books[a].folder / "source-vectors-768.json"
            if damage == "fingerprint":
                metadata = json.loads(manifest.read_text())
                metadata["chunk_fingerprint"] = "stale-pipeline-fingerprint"
                manifest.write_text(json.dumps(metadata))
            elif damage == "count":
                library.engine.vector_client.rows.clear()
            else:
                manifest.unlink()
            for mode in ("vector", "hybrid"):
                response = await client.post(
                    "/v1/rag/naive",
                    headers=AUTH,
                    json={"question": "valve", "mode": mode, "source_ids": [a]},
                )
                assert response.status_code == 200
                packet = response.json()
                assert packet["status"] == "tool_failed"
                assert packet["tool_calls"][0]["code"] == expected
                assert packet["metrics"]["embedding_calls"] == 0
                assert packet["candidates"] == []
            # Lexical source evidence is still intact and independently available.
            lexical = (
                await client.post(
                    "/v1/rag/naive",
                    headers=AUTH,
                    json={"question": "valve", "mode": "keyword", "source_ids": [a]},
                )
            ).json()
            assert lexical["status"] == "completed" and lexical["candidates"]

    asyncio.run(exercise())
