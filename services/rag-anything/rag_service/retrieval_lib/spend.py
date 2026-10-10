"""Durable conservative reservations: crashes and failed calls never release allowance."""

import math
import sqlite3
import time
from pathlib import Path

# USD per million tokens, checked against Google pricing on 2026-10-08.
# Pro uses the higher long-context tier as a conservative bound.
RATES = {
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-pro": (2.50, 15.0),
    "gemini-embedding-001": (0.15, 0.0),
}


class SpendLimit(RuntimeError):
    pass


class SpendLedger:
    def __init__(self, path: Path, ceiling_usd: float = 9.0) -> None:
        if not math.isfinite(ceiling_usd) or ceiling_usd <= 0:
            raise ValueError("Spend ceiling must be finite and positive")
        self.ceiling = math.floor(ceiling_usd * 1_000_000)
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY, model TEXT, "
                "reserved INTEGER NOT NULL, estimated INTEGER, created REAL)"
            )
        path.chmod(0o600)

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=10)

    def reserve(self, model: str, input_bytes: int, output_tokens: int = 0, images: int = 0) -> int:
        if model not in RATES or min(input_bytes, output_tokens, images) < 0:
            raise SpendLimit("unpriced_request")
        # One token per UTF-8 byte plus framing/schema headroom deliberately overestimates
        # text. Images reserve 65,536 tokens each. No tools/grounding/caching are enabled.
        rate_in, rate_out = RATES[model]
        upper_tokens = input_bytes + 4096 + images * 65536
        amount = math.ceil((upper_tokens * rate_in + output_tokens * rate_out) * 1.25)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            used = db.execute("SELECT COALESCE(SUM(reserved),0) FROM calls").fetchone()[0]
            if used + amount > self.ceiling:
                raise SpendLimit("service_spend_limit")
            row = db.execute(
                "INSERT INTO calls(model,reserved,created) VALUES(?,?,?)",
                (model, amount, time.time()),
            )
            return int(row.lastrowid)

    def record(self, call_id: int, input_tokens: int, output_tokens: int) -> None:
        with self.connect() as db:
            row = db.execute("SELECT model FROM calls WHERE id=?", (call_id,)).fetchone()
            a, b = RATES[row[0]]
            estimate = math.ceil(input_tokens * a + output_tokens * b)
            db.execute("UPDATE calls SET estimated=? WHERE id=?", (estimate, call_id))

    def state(self) -> dict:
        with self.connect() as db:
            reserved, estimate, count, unknown = db.execute(
                "SELECT COALESCE(SUM(reserved),0),COALESCE(SUM(estimated),0),COUNT(*),"
                "COALESCE(SUM(estimated IS NULL),0) FROM calls"
            ).fetchone()
        return {
            "local_ceiling_usd": self.ceiling / 1_000_000,
            "reserved_upper_usd": reserved / 1_000_000,
            "reported_usage_estimate_usd": estimate / 1_000_000,
            "calls": count,
            "calls_without_usage": unknown,
            "note": "List-price estimate, not invoice. Failed reservations remain charged locally.",
        }
