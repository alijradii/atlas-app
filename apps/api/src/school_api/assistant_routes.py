"""Authenticated UI help; no private records are sent to this model or MCP tool."""

import time

from fastapi import APIRouter, HTTPException, Request
from school2036.assistant import answer_ui
from school2036.assistant_schemas import AssistantInput, AssistantView
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.models import AuditEvent
from school2036.study_providers import ProviderUnavailable
from sqlalchemy import func, select


def assistant_router(config, sessions):
    router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])

    @router.post("/messages", response_model=AssistantView)
    async def message(data: AssistantInput, request: Request):
        with sessions.begin() as db:
            _, user, _ = authenticate(config, db, request)
            roles = list(user.roles)
            attempts = (
                select(func.count())
                .select_from(AuditEvent)
                .where(
                    AuditEvent.actor == user.id,
                    AuditEvent.action == "assistant.requested",
                )
            )
            # Attempts are committed before provider calls; failures cannot bypass the budget.
            recent = db.scalar(attempts.where(AuditEvent.at > time.time() - 60))
            daily = db.scalar(attempts.where(AuditEvent.at > time.time() - 86400))
            if recent >= 10 or daily >= config.study_daily_requests:
                raise HTTPException(429, "Assistant limit reached. Please try again later.")
            audit(db, "assistant.requested", user.id)
        try:
            result = await answer_ui(config, data, roles)
        except ProviderUnavailable as error:
            raise HTTPException(503, error.message) from None
        # Re-check session/roles after an in-flight model call before exposing any guidance.
        with sessions.begin() as db:
            _, user, _ = authenticate(config, db, request)
            if set(user.roles) != set(roles):
                raise HTTPException(409, "Your access changed. Please ask again.")
        return result

    return router
