# Frontend rules

Use **Bun + TypeScript** for all runtime and tooling work. Bun must execute Next.js, including production; adding Bun merely as an installer is insufficient. Scripts use `bun --bun next`; Docker runs the standalone server with `bun`.

Use `@school2036/ui` and its tokens. Business logic, database access, authentication decisions, and provider credentials belong in the Python backend. Use generated contracts from `@school2036/api-client`. Test narrow layouts, keyboard access, and error states. No remote font fetch is required to build this foundation.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
