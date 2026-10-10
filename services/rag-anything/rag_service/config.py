"""Deployment configuration; secrets are read only from the process environment."""

import math
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    api_key: str
    gemini_api_key: str
    mineru_config: Path
    spend_limit_usd: float = 9.0
    retain_traces: bool = False
    chunk_mode: str = "contextual"

    def __post_init__(self) -> None:
        if self.chunk_mode not in {"contextual", "structural"}:
            raise ValueError("RAG_CHUNK_MODE must be contextual or structural")
        if len(self.api_key) < 32 or not self.api_key.isascii():
            raise ValueError("RAG_API_KEY must contain at least 32 ASCII characters")
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required")
        if not math.isfinite(self.spend_limit_usd) or self.spend_limit_usd <= 0:
            raise ValueError("RAG_SPEND_LIMIT_USD must be finite and positive")

    @classmethod
    def from_env(cls) -> "Settings":
        data = Path(os.environ.get("RAG_DATA_DIR", "./data")).resolve()
        return cls(
            data_dir=data,
            api_key=os.environ.get("RAG_API_KEY", ""),
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            mineru_config=Path(
                os.environ.get("MINERU_TOOLS_CONFIG_JSON", str(data / "mineru.json"))
            ).resolve(),
            spend_limit_usd=float(os.environ.get("RAG_SPEND_LIMIT_USD", "9")),
            chunk_mode=os.environ.get("RAG_CHUNK_MODE", "contextual"),
            retain_traces=os.environ.get("RAG_RETAIN_TRACES", "0") == "1",
        )
