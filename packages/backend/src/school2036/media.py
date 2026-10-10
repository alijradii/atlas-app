"""Bounded capture, immutable quarantine and current-permission file delivery."""

import hashlib
import io
import socket
import struct
import time
import zipfile
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from school2036.identity import audit
from school2036.models import Account, FileObject
from school2036.storage import create_storage


def can_file(db, actor, file):
    return file.state == "accepted" and file.owner == actor.id


def validate_bytes(config, data, file):
    if len(data) != file.expected_size or hashlib.sha256(data).hexdigest() != file.checksum:
        raise ValueError("Size or checksum mismatch")
    detected = None
    if data.startswith(b"%PDF-") and data.rstrip().endswith(b"%%EOF"):
        detected = "application/pdf"
    elif data.startswith(b"\x89PNG\r\n\x1a\n") and data.endswith(b"IEND\xaeB`\x82"):
        detected = "image/png"
    elif data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"):
        detected = "image/jpeg"
    elif len(data) >= 12 and data[4:8] == b"ftyp" and file.media_type in {"video/mp4", "audio/mp4"}:
        detected = file.media_type
    elif data.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in data[:4096]:
        detected = "video/webm"
    elif data.startswith(b"RIFF") and data[8:12] == b"WAVE":
        detected = "audio/wav"
    elif data.startswith(b"ID3") or (len(data) > 2 and data[0] == 255 and data[1] & 224 == 224):
        detected = "audio/mpeg"
    elif data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 1000 or sum(i.file_size for i in entries) > 20 * 1024 * 1024:
                    raise ValueError("Document expands beyond the supported limit")
                if (
                    "word/document.xml" in archive.namelist()
                    and "[Content_Types].xml" in archive.namelist()
                ):
                    if any("vbaProject" in i.filename for i in entries):
                        raise ValueError("Macro documents are not supported")
                    detected = (
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    )
        except zipfile.BadZipFile:
            raise ValueError("Invalid document archive") from None
    else:
        try:
            text = data.decode("utf-8-sig")
            if all(c.isprintable() or c in "\n\r\t" for c in text):
                detected = "text/plain"
        except UnicodeDecodeError:
            pass
    if detected != file.media_type:
        raise ValueError("File bytes do not match a supported media type")
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in data:
        raise ValueError("File rejected by safety checks")
    # Local text-only operation is explicitly bounded; binary files and production
    # always require the scanner. Its failure must never mark a file usable.
    if not config.scanner_host:
        if config.environment != "production" and detected == "text/plain":
            return
        raise OSError("Scanner unavailable")
    scan_with_clamd(config, data)


def scan_with_clamd(config, data):
    with socket.create_connection(
        (config.scanner_host, config.scanner_port), timeout=15
    ) as scanner:
        scanner.settimeout(30)
        scanner.sendall(b"zINSTREAM\x00")
        for start in range(0, len(data), 65536):
            chunk = data[start : start + 65536]
            scanner.sendall(struct.pack("!I", len(chunk)) + chunk)
        scanner.sendall(b"\x00\x00\x00\x00")
        result = b""
        while b"\x00" not in result and len(result) <= 4096:
            chunk = scanner.recv(4096)
            if not chunk:
                break
            result += chunk
        if result != b"stream: OK\x00":
            if b"FOUND" in result:
                raise ValueError("File rejected by malware scanner")
            raise OSError("Scanner did not confirm acceptance")


def process_upload(db, config, file_id):
    storage = create_storage(config)
    file = db.scalar(select(FileObject).where(FileObject.id == file_id).with_for_update())
    if not file:
        return
    if file.state in {"accepted", "rejected", "deleted", "deleting"}:
        return
    owner = db.get(Account, file.owner)
    if not owner or owner.status != "active":
        file.state, file.error = "rejected", "Upload authorization was revoked"
        return
    quarantine = f"quarantine/{file.id}"
    try:
        if file.state != "quarantined":
            data = storage.get(file.staging_key, file.expected_size)
            # Only server credentials can write quarantine/final keys. Scan the captured
            # bytes, never a second read of the still-writable staging URL.
            storage.put(quarantine, data, file.media_type)
            file.state = "quarantined"
        data = storage.get(quarantine, file.expected_size)
        validate_bytes(config, data, file)
        db.refresh(owner)
        if owner.status != "active":
            raise ValueError("Upload authorization was revoked during verification")
        final = f"objects/{file.id}/{file.checksum}"
        storage.put(final, data, file.media_type)
        file.final_key, file.state, file.error = final, "accepted", ""
        audit(db, "file.accepted", file.owner, file.id)
    except ValueError as error:
        file.state, file.error = "rejected", str(error)
        audit(db, "file.rejected", file.owner, file.id)
    except Exception:
        file.error = (
            "Verification unavailable. Retry completion after storage or scanning recovers."
        )
        return
    # Cleanup is retryable and also performed after staging URL expiration.
    try:
        storage.delete(quarantine)
        storage.delete(file.staging_key)
    except Exception:
        pass


def reconcile_media(db, config):
    storage = create_storage(config)
    for file in db.scalars(select(FileObject)):
        if (
            file.state in {"pending", "queued", "quarantined"}
            and file.expires < time.time() - 86400
        ):
            file.state = "deleting"
        if file.state == "deleting":
            try:
                for key in [file.staging_key, f"quarantine/{file.id}", file.final_key]:
                    if key:
                        storage.delete(key)
                file.state = "deleted"
            except Exception:
                file.error = "Deletion pending storage recovery"
        elif file.expires < time.time() and file.state in {"accepted", "rejected", "deleted"}:
            try:
                storage.delete(file.staging_key)
                storage.delete(f"quarantine/{file.id}")
            except Exception:
                continue


def new_upload(db, config, actor, data):
    existing = db.scalars(
        select(FileObject).where(FileObject.owner == actor.id, FileObject.state != "deleted")
    ).all()
    if (
        sum(f.expected_size for f in existing) + data.size > config.media_quota_bytes
        or sum(f.state in {"pending", "queued", "quarantined"} for f in existing) >= 10
    ):
        raise HTTPException(413, "Media quota reached; remove unused uploads or contact staff")
    value = FileObject(
        id=str(uuid4()),
        owner=actor.id,
        filename=data.filename,
        media_type=data.media_type,
        expected_size=data.size,
        checksum=data.checksum,
        staging_key=f"staging/{uuid4()}",
        expires=time.time() + 300,
    )
    db.add(value)
    db.flush()
    audit(db, "file.upload_requested", actor.id, value.id)
    return value
