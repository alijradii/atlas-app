"""Real parser/chunk pipeline with synthetic providers and isolated upload streams."""

import asyncio
import hashlib
import json

import numpy as np

from rag_service.config import Settings
from rag_service.engine import LibraryEngine, TrialEngine
from rag_service.retrieval_lib.source import SourceBook, block_text
from rag_service.retrieval_lib.vectors import build_vectors


class MemoryVectors:
    def __init__(self):
        self.rows = {}
        self.exists = False
        self.loaded = False

    def has_collection(self, collection):
        return self.exists

    def create_collection(self, **kwargs):
        self.exists = True

    def load_collection(self, **kwargs):
        self.loaded = True

    def delete(self, *, filter, **kwargs):
        assert self.loaded, "collection must load before filtered deletion"
        uid = json.loads(filter.split(" == ")[1])
        self.rows = {key: row for key, row in self.rows.items() if row["source_id"] != uid}

    def upsert(self, *, data, **kwargs):
        self.rows.update({row["id"]: row for row in data})

    def flush(self, **kwargs):
        pass

    def query(self, *, filter, **kwargs):
        assert self.loaded, "collection must load before count verification"
        uid = json.loads(filter.split(" == ")[1])
        return [{"count(*)": sum(row["source_id"] == uid for row in self.rows.values())}]

    def close(self):
        self.loaded = False


class Upload:
    def __init__(self, name, text):
        self.headers = {"content-type": "text/plain", "x-file-name": name}
        self.raw = text.encode()

    async def stream(self):
        yield self.raw


def test_real_text_upload_chunk_index_receipt_and_restart(tmp_path, monkeypatch):
    store = MemoryVectors()
    embedding_payloads = []

    async def start(self):
        self.vector_client = store

    async def embed(self, texts, **kwargs):
        embedding_payloads.extend(texts)
        return np.ones((len(texts), kwargs["dimensions"]))

    monkeypatch.setattr(TrialEngine, "start", start)
    monkeypatch.setattr(TrialEngine, "embed", embed)
    settings = Settings(
        tmp_path,
        "test-key-000000000000000000000000000",
        "fake",
        tmp_path / "missing-models.json",
        chunk_mode="structural",
    )

    async def exercise():
        library = LibraryEngine(settings)
        await library.start()
        receipts = []
        for name, text in [
            ("first.txt", "Pressure valve. " * 250 + "END_OF_SOURCE"),
            ("second.md", "# Flow\n\nA flow regulator."),
        ]:
            receipt = await library.upload(Upload(name, text))
            receipts.append(receipt)
            await library.task
            assert library.state()["state"] == "ready", library.state()
        assert len(library.books) == 2
        assert library.select().source_ids == sorted(r["id"] for r in receipts)
        assert library.select(source_ids=[]).source_ids == []
        first = library.books[receipts[0]["id"]]
        assert "".join(c["content"] for c in first.search_units.values()) == first.page_text[1]
        assert "END_OF_SOURCE" in "".join(embedding_payloads)
        assert all(len(text.encode()) <= 2000 for text in embedding_payloads)
        # A rebuild replaces only its own rows and leaves the other source intact.
        before = set(store.rows)
        await build_vectors(library.engine, [768], book=first)
        assert set(store.rows) == before
        await library.close()
        restarted = LibraryEngine(settings)
        await restarted.start()
        assert restarted.select().source_ids == library.select().source_ids
        assert len(restarted.catalog()["documents"]) == 2
        assert not store.loaded
        after_restart = await restarted.upload(Upload("third.txt", "A lesson added after restart."))
        await restarted.task
        assert restarted.state()["state"] == "ready", restarted.state()
        assert store.loaded
        assert before <= set(store.rows)
        assert after_restart["id"] in restarted.select().source_ids
        await restarted.close()

    asyncio.run(exercise())


def test_native_block_fields_are_preserved_once(tmp_path):
    assert block_text({"text": "one\ntwo", "list_items": ["one", "two"]}) == "one\ntwo"
    assert (
        block_text({"img_caption": ["A diagram"], "img_footnote": ["Footnote"]})
        == "A diagram\nFootnote"
    )
    text = "code source"
    (tmp_path / "original.txt").write_text(text)
    (tmp_path / "source.json").write_text(
        json.dumps(
            {
                "filename": "code.txt",
                "stored_name": "original.txt",
                "pages": 1,
                "source_sha256": hashlib.sha256(text.encode()).hexdigest(),
                "page_basis": "logical",
            }
        )
    )
    (tmp_path / "content.json").write_text(
        json.dumps([{"type": "text", "block_kind": "code", "text": text, "page_idx": 0}])
    )
    assert SourceBook(tmp_path).units["P1B0"]["kind"] == "code"
