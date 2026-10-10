"""Run one service process; all runtime side effects belong in the data volume."""

import argparse
import os
from pathlib import Path

from .api import create_app
from .config import Settings


def main():
    import uvicorn

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8081, type=int)
    args = parser.parse_args()
    settings = Settings.from_env()
    os.umask(0o077)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    runtime = settings.data_dir / "runtime"
    runtime.mkdir(exist_ok=True)
    os.chdir(runtime)
    os.environ["TIKTOKEN_CACHE_DIR"] = str(runtime / "token-cache")
    # RAG-Anything verifies the parser command using PATH.
    import sys

    os.environ["PATH"] = str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"]
    uvicorn.run(create_app(settings), host=args.host, port=args.port, access_log=False)


if __name__ == "__main__":
    main()
