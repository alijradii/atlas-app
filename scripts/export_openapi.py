import json
from pathlib import Path

from school2036.config import Settings
from school_api.main import create_app

app = create_app(Settings(_env_file=None, environment="test"))
Path("packages/api-client/openapi.json").write_text(
    json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
)
