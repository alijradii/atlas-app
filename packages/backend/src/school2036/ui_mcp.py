"""Official MCP SDK server. Each request gets an immutable, authenticated role scope.

The API connects through MCP's in-process message transport (initialize, tools/list,
tools/call), avoiding an additional public listener, shared bearer secret or daemon.
"""

import json

from mcp import types
from mcp.server.lowlevel import Server

from school2036.ui_guidance import ContextInput, available_features, context_for


def create_ui_server(roles: list[str], screen: str) -> Server:
    features = available_features(roles)
    server = Server("atlas-ui-guidance", version="1.0.0")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name="ui_context",
                description=(
                    "Load Atlas interface instructions before explaining a workflow "
                    "or selecting a highlight. Read-only: cannot act or read private records. "
                    "Choose feature IDs (empty list loads all permitted features): "
                    + ", ".join(f"{key}: {feature.title}" for key, feature in features.items())
                ),
                inputSchema=ContextInput.model_json_schema(),
                annotations=types.ToolAnnotations(
                    readOnlyHint=True,
                    destructiveHint=False,
                    idempotentHint=True,
                    openWorldHint=False,
                ),
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
        if name != "ui_context":
            raise ValueError("Unknown UI tool")
        data = ContextInput.model_validate(arguments)
        result = context_for(features, data.features, screen)
        return [types.TextContent(type="text", text=json.dumps(result))]

    return server
