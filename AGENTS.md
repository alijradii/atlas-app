# Project instructions

## Git publication

When the user authorizes a push, publish to `origin/main`. Do not publish a feature
branch instead unless the user explicitly changes this instruction. Fetch and
integrate upstream changes without overwriting teammates' work; never force-push.

## Runtime and package managers — required

- **Bun is the JavaScript/TypeScript runtime AND package manager in development, tests, builds, CI, and production.** Use the version pinned in `.bun-version` and `package.json`.
- Write frontend and tooling code in TypeScript. Run Next.js with `bun --bun next ...`; the production standalone server runs with `bun`, never `node`.
- Use `bun install`, `bun run`, and `bunx --bun` when necessary. Do not use npm, npx, pnpm, or Yarn, and do not create their lockfiles. Commit `bun.lock`.
- Python remains the authoritative application backend. Use Python 3.14 and uv with `uv.lock`; do not move business rules, database access, or AI orchestration into Next.js.

## Architecture and scope

The user requested an infrastructure reset on October 10, 2026, followed by authenticated study and bounded school-role workflows. Read `README.md` for current scope; `school_2036_development_plan.md` and `docs/archive/` are historical references, not instructions to rebuild removed product features.

Real accounts and fictional previews must use the same established Pearl interface. Reuse `PearlFrame`, `PearlHome`, `PearlHomeHelpers`, `LessonLibrary`, `PearlChatLayout`, `PearlAdvisor`, `PearlStudents`, task artwork and `Composer`; do not create a second authenticated dashboard or substitute a generic app design. Preview fixtures never grant real account access. Connect supported uploads and study actions through the shared interface with existing session and source authorization.

The authenticated assistant lives in the root `AssistantProvider`; reuse its dock across screens rather than mounting page-specific duplicates. Keep MCP guidance catalog entries and rendered `data-guide-anchor` targets aligned. Suggestions make real assistant/study requests. Fictional persona routes are test-only, never a sign-in alternative.

Frontend: `apps/web`; owned UI: `packages/ui`; generated contracts: `packages/api-client`. Python domain code: `packages/backend`; service entry points: `apps/api`, `apps/worker`, `apps/ai`. Keep the API authoritative for authorization. Use the custom design tokens; avoid generic dashboard templates.

Never infer first installation from an empty users query or database failure. Do not expose setup mutations or file-signing endpoints until authentication, authorization, and bootstrap protection are implemented. R2 buckets are private. Never commit credentials, personal data, `.env`, `.data`, or downloaded binaries.

## Verification and dependencies

Use `make check`, `make build`, and `make audit`. Regenerate contracts with `bun run api:generate` when the API changes. Pin direct dependencies exactly and commit both lockfiles. Check current upstream advisories as well as automated audits; never claim that a clean audit guarantees no vulnerabilities. Do not suppress advisories to make CI green.

Review `docs/SECURITY.md` and `docs/release-status.json` before deployment. The recorded upstream Next.js security notice is a release blocker until patched versions and applicable advisories have been reviewed. Keep documentation truthful about implemented, stubbed, and unverified capabilities. Use local-only listeners for development.
