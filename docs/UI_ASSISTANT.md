# Atlas interface assistant

Authenticated screens use the same persistent Pearl composer for interface help. Requests and
suggested questions are sent to `POST /api/v1/assistant/messages`; they are not canned chat replies.
The input is a message, a canonical current screen and up to eight recent turns. No roles, account
IDs, arbitrary selectors or executable actions are accepted from the client.

The backend authenticates the cookie, verifies CSRF/origin, derives current roles from the database,
and calls the configured Gemini provider. The assistant can explain interface actions and return
one highlight. It cannot click, submit, upload, change settings or read private lesson content.
Study conversations remain separate: optional selected sources, retrieval, citations and
conversation ownership continue to use the existing study API. Study starts immediately
without a source prerequisite; private materials are accessed only when explicitly selected.
Asking Atlas about a lesson should direct the user into Study rather than fabricate lesson access.

The same account-bound dock serves Teaching assistant, Family assistant and
Advisor assistant on their dedicated Workspace screen. The role comes from the
authenticated workspace response; suggestions and the backend MCP catalog follow
that role. New chat resets this interface conversation for adults, while students
start a Study conversation. Events, Connections and Reports have stable guidance
anchors; teacher-only event management is absent from other roles' catalogs.
Role assistance remains read-only interface help, not access to private student
records or an autonomous school administrator.

## Actual MCP integration

`school2036.ui_mcp.create_ui_server` creates a read-only server with the official Python MCP SDK
(pinned `mcp==1.30.0`). The API connects using the SDK's in-process message transport, performing
initialization, tool discovery and `tools/call`; there is no additional public listener or daemon.
This transport avoids another network hop and does not require a shared MCP service credential.
The model sees a compact tool description first. When it needs interface knowledge it requests
`ui_context`, which loads complete instructions for the requested features (or all allowed features).

The server is created per request with an immutable scope derived from authenticated roles. It
exposes no records and performs no mutations. The catalog in `school2036.ui_guidance` defines each
feature's title, route, stable `data-guide-anchor`, prerequisites, steps and role availability.
Unavailable features fail the tool call. The response's target ID must have been loaded by the
actual MCP call and still belong to the account's allowed catalog. The backend maps it to route,
anchor, title and description. Model-authored URLs, selectors and HTML are rejected. The browser
must also resolve only its known anchors, gracefully handle an absent control, and require user
interaction for every actual mutation.

When changing a screen, update the catalog and its rendered anchor together. Keep descriptions
aligned to actual visible labels. Do not add a pretend workflow to make a suggestion work.

## Latency and limits

A general reply requires one model call; interface help requires at most two (tool selection,
then grounded answer). The MCP operation is local, read-only and inexpensive. Gemini 2.5 Flash
uses zero thinking budget for this narrow task, a 1,200-output-token ceiling, 12-second HTTP
request timeouts and a 25-second overall deadline. There are no automatic paid retries and no
cross-account answer cache. The short role-scoped catalog is loaded on demand rather than sending
page HTML or the whole repository. One local live synthetic upload question completed in 1.68
seconds; this is a measured sample, not a latency guarantee.

The database commits an audit event before generation. Ten attempts per minute and the configured
`SCHOOL_STUDY_DAILY_REQUESTS` per day cap UI assistant usage per account (separately from study
runs). Failed attempts count. Audit events contain no question or history text. The session and
roles are checked again after generation, so a revoked session cannot receive the pending reply.
The model uses the existing server-only `SCHOOL_GEMINI_API_KEY` and `SCHOOL_STUDY_MODEL` settings.
Missing or unavailable providers produce an explicit error, never a scripted success.

## Verification

`tests/test_assistant.py` exercises the real MCP SDK protocol, model-request/tool-response loop,
role scoping, malformed outputs, unknown tools/targets, malicious navigation, missing providers,
authentication, CSRF, attempt limits and revocation during generation. Provider traffic is mocked
for repeatable tests; one separately authorized bounded live Gemini check confirms interoperability.

Implementation references: [official MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk/tree/v1.30.0),
[Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling),
[Gemini thinking configuration](https://ai.google.dev/gemini-api/docs/thinking).


## Browser lifecycle and focus

`AssistantProvider` owns account-bound in-memory messages, draft and dock state in
the root layout. Authenticated shells register the current session; unauthenticated
routes clear memory, account changes abort pending work, and a 401 redirects to
sign-in. Responses are checked against current identity before being displayed.
No private question is placed in a URL, localStorage or sessionStorage. On Study,
the same provider-owned dock is portaled into a stable mount in the conversation
column. Both Study session and Ask Atlas modes stay in that column; source controls
remain in their own sidebar. Other screens use the original floating placement.

A returned guide uses a fixed allowlist and waits for the destination anchor to
mount before opening the shared Spotlight. The saved conversation collapses first;
the spotlight waits for that motion to finish, so the reply cannot cover the control.
The conversation stays saved and can be reopened or replay its Show me action.
When the composer itself is the target, it stays open and the competing UI-help
reply is hidden while guidance is active. Dim and border follow viewport/layout
events rather than a continuous measurement loop. Guidance navigates but never
clicks a control or commits a mutation. Escape dismisses it, and Show me can replay
it. A failed request retains the question for an explicit Retry; Stop aborts the
browser wait but cannot guarantee cancellation/refund of a dispatched provider call.

Focus and visibility events are coalesced before revalidation. Existing authorized
content and unsaved edits stay visible during a same-session read or transient
outage. Confirmed revocation/account changes clear protected data. Text areas expand
with controlled/uncontrolled input, reset on form reset and cap their height before
scrolling internally; no manual resizing is needed.
