"""Reserved internal service boundary; no inference or provider integration enabled."""

from fastapi import FastAPI

app = FastAPI(title="Internal AI service", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok", "capabilities": "disabled"}
