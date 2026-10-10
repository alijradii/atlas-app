"""Explicitly download and verify the pinned MinerU CPU parser files."""

import argparse
import hashlib
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, default=Path("/models"))
    parser.add_argument("--config", type=Path, default=Path("/data/mineru.json"))
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    manifest = json.loads((Path(__file__).resolve().parents[1] / "models.json").read_text())
    model = manifest["models"][0]
    target = args.models_dir.resolve() / model["directory"]
    target.mkdir(parents=True, exist_ok=True)
    if not args.verify_only:
        from huggingface_hub import snapshot_download

        snapshot_download(
            model["repository"],
            revision=model["revision"],
            allow_patterns=[f["path"] for f in model["files"]],
            local_dir=target,
            token=False,
            max_workers=2,
        )
    for entry in model["files"]:
        path = target / entry["path"]
        if not path.is_file() or path.stat().st_size != entry["bytes"]:
            raise RuntimeError(f"Missing or wrong-sized model file: {entry['path']}")
        if "sha256" in entry:
            with path.open("rb") as handle:
                actual = hashlib.file_digest(handle, "sha256").hexdigest()
            if actual != entry["sha256"]:
                raise RuntimeError(f"Model digest mismatch: {entry['path']}")
    args.config.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.config.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"models-dir": {"pipeline": str(target)}, "model-source": "local"})
    )
    temporary.replace(args.config)
    print(f"Verified {len(model['files'])} model files; wrote {args.config}")


if __name__ == "__main__":
    main()
