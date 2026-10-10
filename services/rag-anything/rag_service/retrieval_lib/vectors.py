"""Index the same lossless contextual chunks used by lexical retrieval."""

import json


async def build_vectors(engine, dimensions: list[int], *, book) -> None:
    client = engine.vector_client
    units = list(book.search_units.values())
    if not units:
        raise ValueError("no_searchable_chunks")
    texts = [u["embedding_text"] for u in units]
    if any(len(text.encode("utf-8")) > 2000 for text in texts):
        raise ValueError("embedding_payload_exceeds_chunk_contract")
    for dimension in dimensions:
        collection = f"context_chunks_{dimension}"
        if not client.has_collection(collection):
            client.create_collection(
                collection_name=collection,
                dimension=dimension,
                id_type="string",
                max_length=256,
                metric_type="COSINE",
            )
        # Persistent Milvus Lite collections reopen released. Loading is required
        # before filtered deletion and the count query, not only similarity search.
        # This preserves all existing source rows; never recreate the collection.
        client.load_collection(collection_name=collection)
        # Source IDs are immutable upload identities. Rebuilding this source cannot
        # leave stale chunks from an earlier partial attempt.
        scope = "source_id == " + json.dumps(book.source_id)
        client.delete(collection_name=collection, filter=scope)
        for start in range(0, len(units), 8):
            vectors = await engine.embed(texts[start : start + 8], dimensions=dimension)
            client.upsert(
                collection_name=collection,
                data=[
                    {
                        "id": f"{book.source_id}:{u['id']}",
                        "vector": v.tolist(),
                        "source_id": book.source_id,
                        "chunk_id": u["id"],
                    }
                    for u, v in zip(units[start : start + 8], vectors, strict=True)
                ],
            )
        client.flush(collection_name=collection)
        count = client.query(collection_name=collection, filter=scope, output_fields=["count(*)"])[
            0
        ]["count(*)"]
        if int(count) != len(units):
            raise RuntimeError("source_vector_count_mismatch")
        (book.folder / f"source-vectors-{dimension}.json").write_text(
            json.dumps(
                {
                    "version": 2,
                    "chunk_fingerprint": book.chunk_metadata["fingerprint"],
                    "model": "gemini-embedding-001",
                    "dimensions": dimension,
                    "source_sha256": book.sha256,
                    "chunks": len(units),
                    "embedding_text_max_bytes": 2000,
                    "source_boundaries_unchanged": True,
                },
                indent=2,
            )
        )
