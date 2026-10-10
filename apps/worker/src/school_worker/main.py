from celery import Celery
from school2036.config import get_settings

settings = get_settings()
app = Celery("school2036", broker=settings.redis_url.get_secret_value())
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_default_queue="general",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=600,
    task_soft_time_limit=570,
    broker_connection_retry_on_startup=True,
)


@app.task(name="school2036.ping", ignore_result=True)
def ping() -> dict[str, str]:
    """Infrastructure smoke task; business tasks need persisted jobs and authorization."""
    return {"status": "ok"}


@app.task(name="school2036.outbox", ignore_result=True)
def drain_outbox() -> int:
    from school2036.database import create_session_factory
    from school2036.jobs import drain_one

    engine, sessions = create_session_factory(settings)
    try:
        from school2036.identity import locked_state
        from school2036.media import reconcile_media

        with sessions.begin() as db:
            locked_state(db)
            reconcile_media(db, settings)
        count = 0
        while count < 100 and drain_one(sessions, settings):
            count += 1
        return count
    finally:
        engine.dispose()


app.conf.beat_schedule = {
    "reconcile-outbox": {"task": "school2036.outbox", "schedule": 10.0},
}
