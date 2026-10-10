from contextlib import asynccontextmanager
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis import Redis
from school2036.config import Settings, get_settings
from school2036.database import create_session_factory
from school2036.identity import check_marker
from school2036.models import InstallationState
from sqlalchemy.exc import SQLAlchemyError

from school_api.account_routes import account_router
from school_api.activity_routes import activity_router
from school_api.assistant_routes import assistant_router
from school_api.identity_routes import identity_router
from school_api.media_routes import media_router
from school_api.school_event_routes import school_event_router
from school_api.school_report_routes import school_report_router
from school_api.school_routes import school_router
from school_api.study_routes import study_router


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = "0.1.0"


class SetupStatus(BaseModel):
    state: Literal["setup_required", "initialized"]
    setup_available: bool = False
    development: bool = False


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    engine, sessions = create_session_factory(config)
    broker = Redis.from_url(
        config.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=2
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        engine.dispose()
        broker.close()

    app = FastAPI(
        title="School 2036 API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs" if config.environment != "production" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if config.environment != "production" else None,
    )

    app.state.sessions = sessions
    app.state.engine = engine
    app.include_router(identity_router(config, sessions))
    app.include_router(account_router(config, sessions))
    app.include_router(assistant_router(config, sessions))
    app.include_router(media_router(config, sessions))
    app.include_router(study_router(config, sessions))
    app.include_router(school_router(config, sessions))
    app.include_router(school_report_router(config, sessions))
    app.include_router(activity_router(config, sessions))
    app.include_router(school_event_router(config, sessions))

    @app.middleware("http")
    async def browser_security(request: Request, call_next):
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if request.headers.get("origin") != config.public_origin:
                return JSONResponse({"detail": "Untrusted request origin"}, status_code=403)
            limit = (
                50 * 1024 * 1024
                if request.method == "PUT"
                and request.url.path.startswith("/api/v1/uploads/")
                and request.url.path.endswith("/bytes")
                else 262144
                if (
                    request.url.path == "/api/v1/study/lessons"
                    or request.url.path.endswith("/approve")
                )
                else 65536
            )
            chunks = []
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit:
                    return JSONResponse({"detail": "Request too large"}, status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Request-ID"] = str(uuid4())
        return response

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_request, _error):
        return JSONResponse({"detail": "School storage is unavailable"}, status_code=503)

    @app.exception_handler(OSError)
    async def file_error(_request, _error):
        return JSONResponse({"detail": "Installation requires operator attention"}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, error):
        # Validation errors must never reflect submitted credentials or tokens.
        return JSONResponse(
            {"detail": [{"loc": e["loc"], "msg": e["msg"]} for e in error.errors()]},
            status_code=422,
        )

    @app.get("/api/v1/health/live", response_model=Health, tags=["health"])
    def live() -> Health:
        return Health()

    @app.get("/api/v1/health/ready", response_model=Health, tags=["health"])
    def ready() -> Health:
        try:
            setup_status()
            broker.ping()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "A required service is unavailable") from None
        return Health()

    @app.get("/api/v1/setup/status", response_model=SetupStatus, tags=["setup"])
    def setup_status() -> SetupStatus:
        try:
            with sessions() as session:
                state = session.get(InstallationState, 1)
                if state is None:
                    raise HTTPException(503, "Installation state requires operator attention")
                if state.initialized or state.deployment_id or config.installation_marker.exists():
                    check_marker(config, state)
                return SetupStatus(
                    state="initialized" if state.initialized else "setup_required",
                    setup_available=False,
                    development=config.environment == "development",
                )
        except SQLAlchemyError, ValueError:
            raise HTTPException(503, "Installation state is unavailable") from None

    return app


app = create_app()
