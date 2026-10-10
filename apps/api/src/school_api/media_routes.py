import time
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request, Response
from school2036.authentication import authenticate
from school2036.identity import audit
from school2036.jobs import enqueue
from school2036.media import can_file, new_upload, process_upload
from school2036.models import FileObject, OutboxJob
from school2036.schemas import UploadInput, UploadView
from school2036.storage import R2Storage, create_storage
from sqlalchemy import select


def media_router(config, sessions):
    router = APIRouter(prefix="/api/v1", tags=["media"])

    def auth(db, request):
        return authenticate(config, db, request)[1]

    def get(db, model, file_id):
        value = db.get(model, file_id)
        if value is None:
            raise HTTPException(404, "File not found")
        return value

    def own(db, actor, file_id):
        value = get(db, FileObject, file_id)
        if value.owner != actor.id:
            raise HTTPException(404, "Record not found")
        return value

    def view(value, url=None):
        return {
            "id": value.id,
            "filename": value.filename,
            "size": value.expected_size,
            "state": value.state,
            "expires": value.expires,
            "error": value.error,
            "url": url,
        }

    @router.get("/files", response_model=list[UploadView])
    def files(request: Request):
        with sessions.begin() as db:
            actor = auth(db, request)
            return [
                view(value)
                for value in db.scalars(
                    select(FileObject)
                    .where(FileObject.owner == actor.id, FileObject.state != "deleted")
                    .order_by(FileObject.expires.desc())
                )
            ]

    @router.post("/uploads", response_model=UploadView)
    def upload(data: UploadInput, request: Request):
        with sessions.begin() as db:
            value = new_upload(db, config, auth(db, request), data)
            storage = create_storage(config)
            try:
                url = (
                    storage.sign_upload(value.staging_key, value.media_type)
                    if isinstance(storage, R2Storage)
                    else f"/api/v1/uploads/{value.id}/bytes"
                )
            except Exception:
                raise HTTPException(503, "Media storage is unavailable") from None
            return view(value, url)

    @router.put("/uploads/{file_id}/bytes", response_model=UploadView)
    async def local_bytes(file_id: str, request: Request):
        if config.storage_backend != "local":
            raise HTTPException(404, "Use the private storage upload URL")
        data = await request.body()
        with sessions.begin() as db:
            value = own(db, auth(db, request), file_id)
            if value.expires < time.time() or value.state != "pending":
                raise HTTPException(409, "Upload expired or already completed")
            if len(data) != value.expected_size:
                raise HTTPException(422, "Uploaded size differs from declared size")
            create_storage(config).put(value.staging_key, data, value.media_type)
            return view(value)

    @router.post("/uploads/{file_id}/complete", response_model=UploadView)
    def complete(file_id: str, request: Request):
        with sessions.begin() as db:
            actor = auth(db, request)
            value = own(db, actor, file_id)
            if value.state == "accepted":
                return view(value)
            if value.state not in {"pending", "queued", "quarantined"}:
                raise HTTPException(409, "This upload cannot be completed")
            if value.state == "pending" and value.expires < time.time():
                raise HTTPException(410, "Upload expired; create a new upload")
            active_jobs = db.scalars(
                select(OutboxJob).where(
                    OutboxJob.kind == "personal_media.verify",
                    OutboxJob.state.in_(["queued", "running", "retrying"]),
                )
            )
            if any(job.payload.get("file_id") == value.id for job in active_jobs):
                return view(value)
            if value.expires < time.time() - 86400:
                raise HTTPException(410, "Verification window expired; create a new upload")
            if config.storage_backend == "r2" or config.scanner_host:
                if value.state == "pending":
                    value.state = "queued"
                enqueue(db, "personal_media.verify", actor.id, {"file_id": value.id})
                return view(value)
            process_upload(db, config, value.id)
            if value.state not in {"accepted", "rejected"}:
                enqueue(db, "personal_media.verify", actor.id, {"file_id": value.id})
            return view(value)

    @router.get("/uploads/{file_id}", response_model=UploadView)
    def upload_status(file_id: str, request: Request):
        with sessions.begin() as db:
            return view(own(db, auth(db, request), file_id))

    @router.get("/files/{file_id}/download")
    def download(file_id: str, request: Request):
        with sessions.begin() as db:
            actor = auth(db, request)
            value = get(db, FileObject, file_id)
            if not can_file(db, actor, value):
                raise HTTPException(404, "Record not found")
            try:
                data = create_storage(config).get(value.final_key, value.expected_size)
            except Exception:
                raise HTTPException(
                    503, "File storage is unavailable. Try the download again."
                ) from None
            audit(db, "file.downloaded", actor.id, value.id)
            return Response(
                data,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": "attachment; filename*=UTF-8''"
                    + quote(value.filename, safe=""),
                    "Content-Security-Policy": "sandbox; default-src 'none'",
                },
            )

    @router.delete("/files/{file_id}", response_model=UploadView)
    def delete_file(file_id: str, request: Request):
        with sessions.begin() as db:
            actor = auth(db, request)
            value = get(db, FileObject, file_id)
            if value.owner != actor.id:
                raise HTTPException(404, "Record not found")
            value.state = "deleting"
            enqueue(db, "personal_media.cleanup", actor.id)
            audit(db, "file.deletion_requested", actor.id, value.id)
            return view(value)

    return router
