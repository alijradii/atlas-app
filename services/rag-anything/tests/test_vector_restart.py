"""Real local persistence regression; deterministic vectors, no provider credentials/calls."""

import asyncio
from types import SimpleNamespace

import numpy as np
import pytest

from rag_service.retrieval_lib.vectors import build_vectors


def test_reopened_collection_can_ingest_without_losing_previous_sources(tmp_path):
    from pymilvus import MilvusClient

    pytest.importorskip("milvus_lite")
    collection = "context_chunks_768"
    path = str(tmp_path / "index.db")
    original = MilvusClient(path)
    original.create_collection(
        collection_name=collection,
        dimension=768,
        id_type="string",
        max_length=256,
        metric_type="COSINE",
    )
    original.upsert(
        collection_name=collection,
        data=[
            {
                "id": "previous-source:p1",
                "source_id": "previous-source",
                "chunk_id": "p1",
                "vector": [1.0] + [0.0] * 767,
            }
        ],
    )
    original.flush(collection_name=collection)
    original.close()

    reopened = MilvusClient(path)
    # Explicit release makes the regression portable to versions that auto-load on reopen.
    reopened.release_collection(collection_name=collection)
    book = SimpleNamespace(
        folder=tmp_path,
        source_id="new-source",
        sha256="synthetic-hash",
        chunk_metadata={"fingerprint": "synthetic-fingerprint"},
        search_units={"p1": {"id": "p1", "embedding_text": "A synthetic lesson."}},
    )

    async def embed(texts, *, dimensions):
        assert texts == ["A synthetic lesson."]
        return np.asarray([[0.0, 1.0] + [0.0] * (dimensions - 2)])

    try:
        asyncio.run(
            build_vectors(SimpleNamespace(vector_client=reopened, embed=embed), [768], book=book)
        )
        rows = reopened.query(
            collection_name=collection,
            filter='source_id in ["previous-source", "new-source"]',
            output_fields=["source_id"],
        )
        assert {row["source_id"] for row in rows} == {"previous-source", "new-source"}
        assert (tmp_path / "source-vectors-768.json").exists()
    finally:
        reopened.close()
