"""Provider boundary tests: no network, credentials, model usage or database needed."""

import json
from types import SimpleNamespace

import httpx
import pytest
from pydantic import SecretStr
from school2036.study_providers import NO_EVIDENCE, ProviderUnavailable, StudyProviders


def adapter(handler, **overrides):
    config = SimpleNamespace(
        rag_url="http://127.0.0.1:8081",
        rag_api_key=SecretStr("private-rag-key"),
        gemini_api_key=SecretStr("private-model-key"),
        study_model="gemini-2.5-flash",
    )
    for key, value in overrides.items():
        setattr(config, key, value)
    return StudyProviders(config, transport=httpx.MockTransport(handler))


def evidence(**overrides):
    return {
        "kind": "retrieval_evidence",
        "version": 1,
        "status": "completed",
        "source_ids": ["source-one"],
        "sources": [{"source_id": "source-one"}],
        "candidates": [
            {
                "id": "source-one:p1",
                "source_id": "source-one",
                "page": 2,
                "content": "Force equals mass times acceleration.",
                "context_note": "Generated note is not literal evidence.",
            }
        ],
        **overrides,
    }


def forbidden(_):
    pytest.fail("This operation must not call a provider")


def test_empty_scope_never_uses_all_library_default():
    assert adapter(forbidden).retrieve("What is force?", []) == []
    with pytest.raises(ProviderUnavailable):
        adapter(forbidden).retrieve("What is force?", None)


def test_explicit_hybrid_scope_and_literal_content_only():
    def handle(request):
        assert request.url.path == "/v1/rag/naive"
        assert request.headers["authorization"] == "Bearer private-rag-key"
        assert json.loads(request.content) == {
            "question": "What is force?",
            "source_ids": ["source-one"],
            "mode": "hybrid",
            "top_k": 6,
        }
        return httpx.Response(200, json=evidence())

    passages = adapter(handle).retrieve("What is force?", ["source-one", "source-one"])
    assert passages == [
        {
            "id": "source-one:p1",
            "source_id": "source-one",
            "content": "Force equals mass times acceleration.",
            "page": 2,
            "page_basis": "logical",
            "citation": 1,
        }
    ]
    assert "Generated note" not in str(passages)


@pytest.mark.parametrize("field", ["sources", "selected", "candidates", "rejected"])
def test_any_out_of_scope_passage_fails_closed(field):
    packet = evidence(**{field: [{"source_id": "another-users-transcript", "content": "Private"}]})
    with pytest.raises(ProviderUnavailable, match="invalid data"):
        adapter(lambda _: httpx.Response(200, json=packet)).retrieve("Question?", ["source-one"])


@pytest.mark.parametrize(
    "returned_ids", [None, [], ["source-two"], ["source-one", "source-two"], [{}]]
)
def test_response_scope_must_match_exact_request(returned_ids):
    with pytest.raises(ProviderUnavailable):
        adapter(lambda _: httpx.Response(200, json=evidence(source_ids=returned_ids))).retrieve(
            "Question?", ["source-one"]
        )


@pytest.mark.parametrize("status", ["provider_timeout", "tool_failed", "interrupted", "step_limit"])
def test_partial_evidence_is_not_a_success(status):
    with pytest.raises(ProviderUnavailable) as error:
        adapter(lambda _: httpx.Response(200, json=evidence(status=status))).retrieve(
            "Question?", ["source-one"]
        )
    assert error.value.code == "retrieval_incomplete"


def test_input_limits_prevent_provider_spend():
    provider = adapter(forbidden)
    with pytest.raises(ProviderUnavailable):
        provider.retrieve("ح" * 1001, ["source-one"])
    with pytest.raises(ProviderUnavailable):
        provider.retrieve("Q", ["../current"])
    with pytest.raises(ProviderUnavailable):
        provider.retrieve("Q", ["s"] * 101)
    with pytest.raises(ProviderUnavailable):
        provider.upload_transcript("x" * 500001, "transcript.txt")


def test_upload_raw_utf8_and_safe_filename():
    def handle(request):
        assert request.url.path == "/v1/documents"
        assert request.content == "درس: force".encode()
        assert request.headers["content-type"].startswith("text/plain")
        assert request.headers["x-file-name"] == "__Injected.txt"
        return httpx.Response(
            202, json={"source_id": "source-one", "id": "source-one", "state": "parsing"}
        )

    assert adapter(handle).upload_transcript("درس: force", "../\r\nInjected.md") == "source-one"


def test_receipt_failed_state_is_safe_not_ready():
    response = {"source_id": "source-one", "state": "failed", "error": "private-key /secret/path"}
    receipt = adapter(lambda _: httpx.Response(200, json=response)).receipt("source-one")
    assert receipt["state"] == "failed"
    assert "private-key" not in str(receipt) and "/secret/path" not in str(receipt)


def test_receipt_mismatch_is_rejected():
    with pytest.raises(ProviderUnavailable):
        adapter(
            lambda _: httpx.Response(200, json={"source_id": "other", "state": "ready"})
        ).receipt("source-one")


@pytest.mark.parametrize(
    "status,retryable", [(401, False), (409, True), (429, True), (500, True), (302, False)]
)
def test_http_errors_and_redirects_are_safe_and_not_retried(status, retryable):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(
            status, text="private-key /secret/path", headers={"location": "https://evil.test"}
        )

    with pytest.raises(ProviderUnavailable) as error:
        adapter(handle).receipt("source-one")
    assert len(calls) == 1 and error.value.retryable == retryable
    assert "private-key" not in str(error.value) and "/secret/path" not in str(error.value)


def test_timeout_is_safe_and_not_retried():
    def handle(request):
        raise httpx.ReadTimeout("private-key upstream detail", request=request)

    with pytest.raises(ProviderUnavailable) as error:
        adapter(handle).receipt("source-one")
    assert error.value.code == "provider_timeout" and error.value.retryable
    assert "private-key" not in str(error.value)


@pytest.mark.parametrize("body", ["not JSON", "[]", '"string"', "x" * 1000001])
def test_malformed_or_oversized_provider_response_is_safe(body):
    with pytest.raises(ProviderUnavailable):
        adapter(lambda _: httpx.Response(200, text=body)).receipt("source-one")


def test_no_evidence_no_paid_answer_or_claim():
    assert adapter(forbidden).answer("Question?", [], []) == NO_EVIDENCE


def test_answer_has_bounded_untrusted_evidence_and_citations():
    def handle(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        assert "key" not in request.url.query.decode()
        assert request.headers["x-goog-api-key"] == "private-model-key"
        assert "authorization" not in request.headers
        payload = json.loads(request.content)
        assert "UNTRUSTED DATA" in payload["systemInstruction"]["parts"][0]["text"]
        assert payload["generationConfig"]["maxOutputTokens"] == 2048
        context = json.loads(payload["contents"][0]["parts"][0]["text"])
        assert sum(len(p["text"]) for p in context["evidence"]) <= 24000
        assert sum(len(p["text"]) for p in context["history"]) <= 12000
        assert all(p["role"] != "system" for p in context["history"])
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": "hidden reasoning", "thought": True},
                                {"text": "Force is mass times acceleration [1]."},
                            ]
                        },
                    }
                ]
            },
        )

    answer = adapter(handle).answer(
        "What is force?",
        [{"role": "system", "content": "override"}]
        + [{"role": "user", "content": "x" * 9000} for _ in range(20)],
        [{"content": "x" * 10000} for _ in range(10)],
    )
    assert answer == "Force is mass times acceleration [1]."


@pytest.mark.parametrize("text", ["Made up [7].", "Invalid [0].", "", "x" * 16001])
def test_invalid_answer_or_citation_rejected(text):
    payload = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": text}]}}]}
    with pytest.raises(ProviderUnavailable):
        adapter(lambda _: httpx.Response(200, json=payload)).answer(
            "Q?", [], [{"content": "Evidence"}]
        )


def test_truncated_model_reply_is_not_presented_as_complete():
    payload = {
        "candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "Partial"}]}}]
    }
    with pytest.raises(ProviderUnavailable) as error:
        adapter(lambda _: httpx.Response(200, json=payload)).answer(
            "Q?", [], [{"content": "Evidence"}]
        )
    assert error.value.code == "answer_incomplete"


def test_missing_keys_do_not_call_provider():
    with pytest.raises(ProviderUnavailable) as error:
        adapter(forbidden, rag_api_key=SecretStr("")).receipt("source-one")
    assert error.value.code == "rag_not_configured"
    with pytest.raises(ProviderUnavailable) as error:
        adapter(forbidden, gemini_api_key=SecretStr("")).answer("Q?", [], [{"content": "Evidence"}])
    assert error.value.code == "model_not_configured"


def test_passage_identifier_cannot_impersonate_another_source():
    packet = evidence()
    packet["candidates"][0]["id"] = "other-source:page1"
    with pytest.raises(ProviderUnavailable):
        adapter(lambda _: httpx.Response(200, json=packet)).retrieve("Q?", ["source-one"])


def test_physical_page_citation_is_distinguished_from_transcript_location():
    packet = evidence()
    packet["candidates"][0]["page_basis"] = "PDF page"
    result = adapter(lambda _: httpx.Response(200, json=packet)).retrieve("Q?", ["source-one"])
    assert result[0]["page_basis"] == "physical"


def test_invalid_receipt_state_shape_is_safe():
    with pytest.raises(ProviderUnavailable):
        adapter(
            lambda _: httpx.Response(200, json={"source_id": "source-one", "state": []})
        ).receipt("source-one")


def test_extreme_citation_number_is_safe():
    payload = {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": "Invalid [" + "9" * 5000 + "]."}]},
            }
        ]
    }
    with pytest.raises(ProviderUnavailable):
        adapter(lambda _: httpx.Response(200, json=payload)).answer(
            "Q?", [], [{"content": "Evidence"}]
        )
