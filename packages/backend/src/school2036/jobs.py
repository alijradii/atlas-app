"""A database outbox with leased, idempotent consumers and bounded retries.

Internal health and personal media handlers are enabled; no outbound delivery is enabled.
"""

import time
from uuid import uuid4

from sqlalchemy import or_, select

from school2036.identity import audit
from school2036.models import OutboxJob


def enqueue(db, kind, actor=None, payload=None, job_id=None):
    job_id = job_id or str(uuid4())
    existing = db.get(OutboxJob, job_id)
    if existing:
        return existing.id
    db.add(
        OutboxJob(
            id=job_id,
            kind=kind,
            actor=actor,
            payload=payload or {},
            state="queued",
            attempts=0,
            available=time.time(),
        )
    )
    return job_id


def drain_one(sessions, config=None):
    now = time.time()
    with sessions.begin() as db:
        job = db.scalar(
            select(OutboxJob)
            .where(
                OutboxJob.available <= now,
                or_(OutboxJob.state.in_(["queued", "retrying"]), OutboxJob.state == "running"),
            )
            .order_by(OutboxJob.available)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return False
        job.state = "running"
        job.attempts += 1
        job.available = now + 300  # Recover a crashed worker after the lease expires.
        job_id = job.id
        lease_attempt = job.attempts
    with sessions.begin() as db:
        job = db.scalar(select(OutboxJob).where(OutboxJob.id == job_id).with_for_update())
        if job.state != "running" or job.attempts != lease_attempt:
            return True
        try:
            if job.kind == "system.health":
                audit(db, "job.health_completed", target=job.id)
            elif job.kind in {"personal_media.verify", "personal_media.cleanup"} and config:
                from school2036.media import process_upload, reconcile_media
                from school2036.models import FileObject

                if job.kind == "personal_media.verify":
                    process_upload(db, config, job.payload["file_id"])
                    file = db.get(FileObject, job.payload["file_id"])
                    if file and file.state in {
                        "pending",
                        "queued",
                        "quarantined",
                    }:
                        raise ValueError("media_unavailable")
                else:
                    reconcile_media(db, config)
            else:
                raise ValueError("unsupported_job_kind")
            job.state = "succeeded"
            job.error = None
        except ValueError as error:
            job.error = str(error)
            job.state = "failed" if job.attempts >= 3 else "retrying"
            job.available = time.time() + 60 * job.attempts
    return True
