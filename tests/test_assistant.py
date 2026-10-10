"""Provider-independent integration: real MCP protocol, bounded Gemini loop and auth."""

import asyncio
import json

import httpx
import pytest
from mcp.shared.memory import create_connected_server_and_client_session
from pydantic import SecretStr
from school2036.assistant import answer_ui, parse_answer, safe_screen
from school2036.assistant_schemas import AssistantInput, AssistantView
from school2036.config import Settings
from school2036.models import AuditEvent
from school2036.operator import set_roles
from school2036.study_providers import ProviderUnavailable
from school2036.ui_mcp import create_ui_server
from sqlalchemy import select
from test_identity import login

BASE = "/api/v1/assistant/messages"


def reply(answer="Choose Upload materials.", target="upload", suggestions=None):
    return json.dumps({"answer": answer, "target": target, "suggestions": suggestions or []})


def provider_content(parts):
    return {"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": parts}}]}


def config():
    return Settings(_env_file=None, gemini_api_key=SecretStr("synthetic-provider-key"))


def test_actual_mcp_negotiation_list_and_role_scoped_context():
    async def run():
        async with create_connected_server_and_client_session(
            create_ui_server(["student"], "/files")
        ) as client:
            listed = await client.list_tools()
            assert [tool.name for tool in listed.tools] == ["ui_context"]
            assert listed.tools[0].annotations.readOnlyHint
            result = await client.call_tool("ui_context", {"features": ["upload", "sources"]})
            assert not result.isError
            context = json.loads(result.content[0].text)
            assert context["features"][0]["route"] == "/files"
            assert "approval" in json.dumps(context)
            forbidden = await client.call_tool("ui_context", {"features": ["students"]})
            assert forbidden.isError
            extra = await client.call_tool("ui_context", {"roles": ["advisor"]})
            assert extra.isError

    asyncio.run(run())


def test_model_calls_real_mcp_then_returns_safe_guidance_and_followups():
    requests = []

    async def handle(request):
        body = json.loads(request.content)
        requests.append(body)
        assert request.headers["x-goog-api-key"] == "synthetic-provider-key"
        if len(requests) == 1:
            assert body["tools"][0]["functionDeclarations"][0]["name"] == "ui_context"
            return httpx.Response(
                200,
                json=provider_content(
                    [
                        {
                            "functionCall": {
                                "name": "ui_context",
                                "args": {"features": ["upload"]},
                            },
                            "thoughtSignature": "retained-signature",
                        }
                    ]
                ),
            )
        assert len(body["contents"]) == 3
        assert body["contents"][1]["parts"][0]["thoughtSignature"] == "retained-signature"
        tool = body["contents"][2]["parts"][0]["functionResponse"]
        assert tool["response"]["features"][0]["anchor"] == "files.upload"
        assert "tools" not in body  # Hard two-model-call ceiling, no recursive tool loop.
        return httpx.Response(
            200,
            json=provider_content(
                [{"text": reply(suggestions=["How do I review my transcript?"])}]
            ),
        )

    result = asyncio.run(
        answer_ui(
            config(),
            AssistantInput(message="Where can I upload?"),
            ["student"],
            transport=httpx.MockTransport(handle),
        )
    )
    assert len(requests) == 2
    assert result.guidance.route == "/files"
    assert result.guidance.anchor == "files.upload"
    assert result.suggestions == ["How do I review my transcript?"]


def test_general_reply_is_one_real_model_call_without_loading_workflows():
    calls = []

    async def handle(request):
        calls.append(request)
        return httpx.Response(
            200,
            json=provider_content([{"text": reply("Hi! What would you like help with?", None)}]),
        )

    result = asyncio.run(
        answer_ui(
            config(), AssistantInput(message="Hello"), [], transport=httpx.MockTransport(handle)
        )
    )
    assert result.guidance is None
    assert len(calls) == 1


@pytest.mark.parametrize(
    "text,roles,loaded",
    [
        (reply(target="students"), ["student"], {"students"}),
        (reply(target="upload"), ["student"], set()),
        (reply(target="https://evil.example"), ["student"], set()),
        (reply(answer="Click [here](https://evil.example)"), [], {"upload"}),
        (reply(answer="<img src=x>"), [], {"upload"}),
        (reply(suggestions=["Go https://evil.example"]), [], {"upload"}),
        ('{"answer":"okay","target":null,"selector":"body"}', [], set()),
        ("not json", [], set()),
    ],
)
def test_invalid_or_unloaded_highlights_and_links_are_rejected(text, roles, loaded):
    with pytest.raises(ProviderUnavailable):
        parse_answer(text, roles, loaded)


def test_untrusted_screen_never_reaches_model_context():
    assert safe_screen("https://evil.example", ["student"]) == "/workspace"
    assert safe_screen("/workspace?section=students", ["student"]) == "/workspace"
    assert safe_screen("/workspace?section=students", ["advisor"]).endswith("students")


@pytest.mark.parametrize(
    "parts",
    [
        [{"functionCall": {"name": "delete_file", "args": {}}}],
        [{"functionCall": {"name": "ui_context", "args": {"features": ["students"]}}}],
        [{"text": reply(target="upload")}],
        ["malformed part"],
    ],
)
def test_bad_model_calls_fail_closed(parts):
    async def handle(request):
        return httpx.Response(200, json=provider_content(parts))

    with pytest.raises(ProviderUnavailable):
        asyncio.run(
            answer_ui(
                config(),
                AssistantInput(message="test"),
                ["student"],
                transport=httpx.MockTransport(handle),
            )
        )


def test_missing_provider_is_explicit_not_scripted_success():
    with pytest.raises(ProviderUnavailable, match="provider configured"):
        asyncio.run(
            answer_ui(
                Settings(_env_file=None, gemini_api_key=SecretStr("")),
                AssistantInput(message="Help me"),
                [],
            )
        )


def test_assistant_auth_csrf_and_roles_are_server_owned(system, monkeypatch):
    client, app, settings = system
    assert client.post(BASE, json={"message": "Where upload?"}).status_code == 401
    login(client)
    assert (
        client.post(
            BASE, headers={"X-CSRF-Token": ""}, json={"message": "Where upload?"}
        ).status_code
        == 403
    )
    assert client.post(BASE, json={"message": "Hi", "roles": ["advisor"]}).status_code == 422
    set_roles(settings, app.state.sessions, "alice", ["student"])
    login(client)
    seen = []

    async def fake(config, data, roles):
        seen.append(roles)
        return AssistantView(answer="Hello from the real provider adapter.")

    monkeypatch.setattr("school_api.assistant_routes.answer_ui", fake)
    response = client.post(BASE, json={"message": "Hi", "screen": "/files"})
    assert response.status_code == 200
    assert seen == [["student"]]
    with app.state.sessions() as db:
        events = list(
            db.scalars(select(AuditEvent).where(AuditEvent.action == "assistant.requested"))
        )
        assert len(events) == 1
        assert events[0].detail == {}  # No message text, history, keys or role claims retained.


def test_provider_errors_safe_and_attempts_count_toward_limit(system, monkeypatch):
    client, _, _ = system
    login(client)

    async def fail(*args):
        raise ProviderUnavailable("bad", "Atlas is temporarily unavailable.")

    monkeypatch.setattr("school_api.assistant_routes.answer_ui", fail)
    for _ in range(10):
        response = client.post(BASE, json={"message": "Help"})
        assert response.status_code == 503
        assert response.json()["detail"] == "Atlas is temporarily unavailable."
    assert client.post(BASE, json={"message": "Help"}).status_code == 429


def test_revoked_session_is_rechecked_after_generation(system, monkeypatch):
    client, _, _ = system
    login(client)

    async def revoke(*args):
        assert (await asyncio.to_thread(client.post, "/api/v1/auth/logout")).status_code == 200
        return AssistantView(answer="Must not be exposed after logout.")

    monkeypatch.setattr("school_api.assistant_routes.answer_ui", revoke)
    assert client.post(BASE, json={"message": "Help"}).status_code == 401


@pytest.mark.parametrize("role", ["teacher", "parent", "advisor"])
def test_adult_context_has_role_help_and_materials_not_student_tutoring(role):
    from school2036.ui_guidance import available_features

    features = available_features([role])
    assert "chat" not in features
    assert "sources" not in features
    assert features["role_assistant"].route == "/workspace?section=assistant"
    assert features["transcript"].route == "/study?materials=1"
    assert safe_screen("/study", [role]) == "/workspace"
    assert safe_screen("/study?materials=1", [role]) == "/study?materials=1"
    with pytest.raises(ProviderUnavailable):
        parse_answer(reply(target="chat"), [role], {"chat"})


@pytest.mark.parametrize("role", ["student", "teacher", "parent", "advisor"])
def test_event_context_is_role_scoped(role):
    from school2036.ui_guidance import available_features

    features = available_features([role])
    assert features["events"].anchor == "events.list"
    assert features["connections"].anchor == "connections.list"
    assert features["reports"].anchor == "reports.list"
    assert safe_screen("/workspace?section=reports", [role]) == "/workspace?section=reports"
    assert ("manage_events" in features) == (role == "teacher")
    if role != "teacher":
        with pytest.raises(ProviderUnavailable):
            parse_answer(reply(target="manage_events"), [role], {"manage_events"})


def test_student_keeps_source_chat_with_multiple_roles():
    from school2036.ui_guidance import available_features

    assert available_features(["student"])["chat"].route == "/study"
    assert available_features(["student", "teacher"])["sources"].route == "/study"
