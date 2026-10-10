"""Verified file → review draft → indexed lesson, without paid provider requests."""

import io
import json
import subprocess
import wave
import zipfile
from unittest.mock import patch

import httpx
import pytest
from school2036.models import StudyLesson
from school2036.study_extract import DOCX, extract_document, recording_audio, transcribe_recording
from school2036.study_jobs import process_study_job
from school2036.study_providers import ProviderUnavailable, StudyProviders
from test_identity import login
from test_media import start, upload
from test_study import BASE, TRANSCRIPT, Providers, claim, other_client, process
from test_study import study as study


def import_text(system):
    client, _, _ = system
    file = upload(client, TRANSCRIPT.encode())
    result = client.post(BASE + "/imports", json={"file_id": file["id"], "title": "Forces"})
    assert result.status_code == 202, result.text
    return file, result.json()


def test_import_review_scope_approval_and_original_file(study):
    client, _, _ = study
    file, lesson = import_text(study)
    assert lesson["has_file"] and lesson["source_kind"] == "document"
    providers = Providers()
    process(study, "study.extract", lesson["id"], providers)
    assert providers.calls == []
    detail = client.get(BASE + f"/lessons/{lesson['id']}").json()
    assert detail["state"] == "review" and detail["transcript"] == TRANSCRIPT
    assert (
        client.post(BASE + "/conversations", json={"lesson_ids": [lesson["id"]]}).status_code == 409
    )
    assert (
        client.post(BASE + "/imports", json={"file_id": file["id"], "title": "Duplicate"}).json()[
            "id"
        ]
        == lesson["id"]
    )
    peer = other_client(study, "bob")
    assert (
        peer.post(BASE + "/imports", json={"file_id": file["id"], "title": "Stolen"}).status_code
        == 404
    )
    path = BASE + f"/lessons/{lesson['id']}"
    assert peer.get(path + "/file").status_code == 404
    client.post(path + "/access", json={"login": "bob"})
    assert peer.get(path + "/file").content == TRANSCRIPT.encode()
    assert peer.post(path + "/approve", json={"transcript": TRANSCRIPT}).status_code == 404
    assert client.post(path + "/approve", json={"transcript": "tiny"}).status_code == 422
    assert client.post(path + "/approve", json={"transcript": TRANSCRIPT}).status_code == 202
    assert client.post(path + "/approve", json={"transcript": TRANSCRIPT}).status_code == 409
    process(study, "study.ingest", lesson["id"], providers)
    assert client.get(path).json()["state"] == "ready"
    client.delete(f"/api/v1/files/{file['id']}")
    assert peer.get(path + "/file").status_code == 404
    assert peer.get(path).json()["transcript"] == TRANSCRIPT


def test_pending_rejected_or_deleted_file_cannot_be_imported(study):
    client, _, _ = study
    value = start(client).json()
    assert (
        client.post(BASE + "/imports", json={"file_id": value["id"], "title": "No"}).status_code
        == 404
    )
    client.delete(f"/api/v1/files/{value['id']}")
    assert (
        client.post(BASE + "/imports", json={"file_id": value["id"], "title": "No"}).status_code
        == 404
    )


def test_deleted_source_during_extraction_cannot_publish(study):
    client, app, config = study
    file, lesson = import_text(study)
    job, attempt = claim(app, "study.extract", lesson["id"])

    def revoke(*_):
        client.delete(f"/api/v1/files/{file['id']}")
        return TRANSCRIPT

    with patch("school2036.study_extract.extract_document", side_effect=revoke):
        process_study_job(app.state.sessions, config, job, attempt, Providers())
    detail = client.get(BASE + f"/lessons/{lesson['id']}").json()
    assert detail["state"] == "failed" and not detail["transcript"]


def test_extraction_recovery_does_not_replay_and_preserves_review(study):
    client, app, config = study
    _, lesson = import_text(study)
    job, _ = claim(app, "study.extract", lesson["id"])
    _, attempt = claim(app, "study.extract", lesson["id"])
    with patch("school2036.study_extract.extract_document") as extract:
        process_study_job(app.state.sessions, config, job, attempt, Providers())
        extract.assert_not_called()
    assert client.get(BASE + f"/lessons/{lesson['id']}").json()["state"] == "failed"
    with app.state.sessions.begin() as db:
        source = db.get(StudyLesson, lesson["id"])
        source.state, source.transcript = "review", TRANSCRIPT
    job, attempt = claim(app, "study.extract", lesson["id"])
    process_study_job(app.state.sessions, config, job, attempt, Providers())
    assert client.get(BASE + f"/lessons/{lesson['id']}").json()["state"] == "review"


def docx(text=TRANSCRIPT):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'
            + text
            + "</w:t></w:r></w:p></w:body></w:document>",
        )
    return data.getvalue()


def test_docx_extraction_and_entity_rejection():
    assert extract_document(docx(), DOCX) == TRANSCRIPT
    with pytest.raises(ProviderUnavailable):
        extract_document(docx("<!DOCTYPE bad>"), DOCX)
    with pytest.raises(ProviderUnavailable):
        extract_document(b"not a zip", DOCX)


@pytest.mark.parametrize("text", ["too short", "x" * 45001, "null\x00" * 10])
def test_invalid_extracted_text_is_never_truncated_or_indexed(text):
    with pytest.raises(ProviderUnavailable):
        extract_document(text.encode(), "text/plain")


def test_binary_import_requires_scanning(system):
    client, app, config = system
    login(client)
    data = docx()
    value = start(client, data, filename="lesson.docx", media_type=DOCX).json()
    client.put(value["url"], content=data)
    result = client.post(f"/api/v1/uploads/{value['id']}/complete").json()
    assert result["state"] == "quarantined"
    assert (
        client.post(BASE + "/imports", json={"file_id": value["id"], "title": "No"}).status_code
        == 404
    )
    config.scanner_host = "synthetic-scanner"
    from school2036.media import process_upload

    with patch("school2036.media.scan_with_clamd") as scanner:
        with app.state.sessions.begin() as db:
            process_upload(db, config, value["id"])
        scanner.assert_called_once()
    assert client.get(f"/api/v1/uploads/{value['id']}").json()["state"] == "accepted"


def test_media_type_limits_and_spoofing(system):
    client, _, _ = system
    login(client)
    assert (
        start(
            client, media_type="video/mp4", filename="clip.mp4", size=50 * 1024 * 1024
        ).status_code
        == 200
    )
    assert (
        start(
            client, media_type="video/mp4", filename="clip.mp4", size=50 * 1024 * 1024 + 1
        ).status_code
        == 422
    )
    assert start(client, size=10 * 1024 * 1024 + 1).status_code == 422
    value = start(client, filename="fake.mp4", media_type="video/mp4").json()
    client.put(value["url"], content=b"Private test file\n")
    assert client.post(f"/api/v1/uploads/{value['id']}/complete").json()["state"] == "rejected"


def wav():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(16000)
        stream.writeframes(b"\x00\x00" * 1600)
    return buffer.getvalue()


def test_real_local_audio_conversion():
    audio = recording_audio(wav())
    assert 0 < len(audio) < 12000000


def test_recording_duration_limit_prevents_paid_call():
    with patch("school2036.study_extract._run", return_value=b'{"format":{"duration":"1201"}}'):
        with pytest.raises(ProviderUnavailable, match="20 minutes"):
            recording_audio(wav())


def test_transcription_payload_and_incomplete_output(study):
    _, _, config = study

    def response(request):
        body = json.loads(request.content)
        assert "key=" not in str(request.url)
        assert request.headers["x-goog-api-key"] == config.gemini_api_key.get_secret_value()
        assert body["contents"][0]["parts"][0]["inlineData"]["mimeType"] == "audio/mpeg"
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": TRANSCRIPT}]}}
                ]
            },
        )

    provider = StudyProviders(config, transport=httpx.MockTransport(response))
    with patch("school2036.study_extract.recording_audio", return_value=b"audio"):
        assert transcribe_recording(provider, b"original-video") == TRANSCRIPT
    provider = StudyProviders(
        config,
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"candidates": [{"finishReason": "MAX_TOKENS"}]})
        ),
    )
    with patch("school2036.study_extract.recording_audio", return_value=b"audio"):
        with pytest.raises(ProviderUnavailable, match="incomplete"):
            transcribe_recording(provider, b"original-video")


def test_converter_failure_is_actionable():
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("parser", 40)):
        with pytest.raises(ProviderUnavailable, match="could not be read"):
            recording_audio(wav())


@pytest.mark.parametrize("state", ["queued", "indexing", "failed"])
def test_recovered_extraction_preserves_already_approved_transcript(study, state):
    from school2036.models import OutboxJob

    client, app, config = study
    _, lesson = import_text(study)
    job, _ = claim(app, "study.extract", lesson["id"])
    # Simulate extraction committing, then losing its outbox acknowledgement.
    with app.state.sessions.begin() as db:
        value = db.get(StudyLesson, lesson["id"])
        value.transcript, value.state = TRANSCRIPT, "review"
    assert (
        client.post(
            BASE + f"/lessons/{lesson['id']}/approve", json={"transcript": TRANSCRIPT}
        ).status_code
        == 202
    )
    with app.state.sessions.begin() as db:
        value = db.get(StudyLesson, lesson["id"])
        value.state = state
        value.error = "Later indexing failure" if state == "failed" else ""
    _, attempt = claim(app, "study.extract", lesson["id"])
    with patch("school2036.study_extract.extract_document") as extract:
        process_study_job(app.state.sessions, config, job, attempt, Providers())
        extract.assert_not_called()
    detail = client.get(BASE + f"/lessons/{lesson['id']}").json()
    assert detail["state"] == state
    assert detail["transcript"] == TRANSCRIPT
    if state == "failed":
        assert detail["error"] == "Later indexing failure"
    with app.state.sessions() as db:
        assert db.get(OutboxJob, job).state == "succeeded"


def test_import_retries_share_daily_attempt_limit_and_preserve_failed_state(study):
    import time
    from uuid import uuid4

    from school2036.models import OutboxJob
    from sqlalchemy import func, select

    client, app, _ = study
    file, lesson = import_text(study)
    with app.state.sessions.begin() as db:
        value = db.get(StudyLesson, lesson["id"])
        value.state, value.error = "failed", "Provider could not transcribe this recording"
        for _ in range(19):
            db.add(
                OutboxJob(
                    id=str(uuid4()),
                    kind="study.extract",
                    actor=value.owner,
                    payload={"lesson_id": value.id},
                    state="failed",
                    attempts=1,
                    available=time.time() + 600,
                )
            )
    path = BASE + f"/lessons/{lesson['id']}/retry"
    assert client.post(path).status_code == 429
    detail = client.get(BASE + f"/lessons/{lesson['id']}").json()
    assert detail["state"] == "failed" and detail["error"]
    with app.state.sessions.begin() as db:
        assert (
            db.scalar(
                select(func.count()).select_from(OutboxJob).where(OutboxJob.kind == "study.extract")
            )
            == 20
        )
        old = db.scalar(select(OutboxJob).where(OutboxJob.kind == "study.extract").limit(1))
        old.available = time.time() - 86401
    assert client.post(path).status_code == 200
    with app.state.sessions() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(OutboxJob)
                .where(OutboxJob.kind == "study.extract", OutboxJob.available > time.time() - 86400)
            )
            == 20
        )
    # Idempotently looking up the already-imported file is not a new paid attempt.
    assert (
        client.post(
            BASE + "/imports", json={"file_id": file["id"], "title": "Existing"}
        ).status_code
        == 202
    )


def test_ingestion_retry_does_not_consume_transcription_quota(study):
    import time
    from uuid import uuid4

    from school2036.models import OutboxJob

    client, app, _ = study
    _, lesson = import_text(study)
    with app.state.sessions.begin() as db:
        value = db.get(StudyLesson, lesson["id"])
        value.transcript, value.state = TRANSCRIPT, "failed"
        for _ in range(20):
            db.add(
                OutboxJob(
                    id=str(uuid4()),
                    kind="study.extract",
                    actor=value.owner,
                    payload={"lesson_id": value.id},
                    state="failed",
                    attempts=1,
                    available=time.time() + 600,
                )
            )
    assert client.post(BASE + f"/lessons/{lesson['id']}/retry").status_code == 200


def test_bom_transcript_upload_keeps_original_bytes_and_extracts_clean_text(study):
    client, _, _ = study
    original = b"\xef\xbb\xbf" + TRANSCRIPT.encode()
    file = upload(client, original)
    assert file["state"] == "accepted"
    lesson = client.post(
        BASE + "/imports", json={"file_id": file["id"], "title": "Windows transcript export"}
    ).json()
    process(study, "study.extract", lesson["id"], Providers())
    path = BASE + f"/lessons/{lesson['id']}"
    assert client.get(path).json()["transcript"] == TRANSCRIPT
    assert client.get(path + "/file").content == original


@pytest.mark.parametrize(
    "failure",
    [
        ValueError("private object details"),
        RuntimeError("private provider details"),
        OSError("private storage path"),
    ],
)
def test_original_source_storage_errors_are_actionable_and_do_not_leak_details(study, failure):
    client, _, _ = study
    _, lesson = import_text(study)
    with patch("school_api.study_routes.create_storage") as storage:
        storage.return_value.get.side_effect = failure
        response = client.get(BASE + f"/lessons/{lesson['id']}/file")
    assert response.status_code == 503
    assert response.json()["detail"] == "File storage is unavailable. Try the download again."
    assert "private" not in response.text


def test_upload_rejects_unpaired_unicode_filename_before_storage(study):
    client, _, _ = study
    payload = {
        "filename": "bad\ud800.txt",
        "media_type": "text/plain",
        "size": 1,
        "checksum": "a" * 64,
    }
    response = client.post(
        "/api/v1/uploads", content=json.dumps(payload), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert "unicode" in response.text.lower()
    assert client.get("/api/v1/files").json() == []
    response = client.post("/api/v1/uploads", json={**payload, "filename": "درس 🧪.txt"})
    assert response.status_code == 200


def test_real_pdf_text_layer_extraction():
    # A complete, deterministic one-page PDF; no dependency on a downloaded fixture.
    content = f"BT /F1 12 Tf 72 700 Td ({TRANSCRIPT}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    start = len(pdf)
    pdf.extend(b"xref\n0 6\n0000000000 65535 f \n")
    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    extracted = extract_document(bytes(pdf), "application/pdf")
    assert "Force equals mass times acceleration." in extracted
