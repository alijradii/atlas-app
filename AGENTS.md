# Project instructions

## Runtime and package managers — required

- **Bun is the JavaScript/TypeScript runtime AND package manager in development, tests, builds, CI, and production.** Use the version pinned in `.bun-version` and `package.json`.
- Write frontend and tooling code in TypeScript. Run Next.js with `bun --bun next ...`; the production standalone server runs with `bun`, never `node`.
- Use `bun install`, `bun run`, and `bunx --bun` when necessary. Do not use npm, npx, pnpm, or Yarn, and do not create their lockfiles. Commit `bun.lock`.
- Python remains the authoritative application backend. Use Python 3.14 and uv with `uv.lock`; do not move business rules, database access, or AI orchestration into Next.js.

## Architecture and scope

The user requested an infrastructure reset on October 10, 2026. Keep basic login, private uploads and service infrastructure. The user subsequently requested the Atlas Pearl landing and role workspace designs using Tailwind and shadcn; these are frontend previews with fictional data, not restored school backend services. Read `README.md` for the current scope; `school_2036_development_plan.md` and `docs/archive/` are historical references, not instructions to rebuild removed product features.

Frontend: `apps/web`; owned UI: `packages/ui`; generated contracts: `packages/api-client`. Python domain code: `packages/backend`; service entry points: `apps/api`, `apps/worker`, `apps/ai`. Keep the API authoritative for authorization. Use the custom design tokens; avoid generic dashboard templates.

Never infer first installation from an empty users query or database failure. Do not expose setup mutations or file-signing endpoints until authentication, authorization, and bootstrap protection are implemented. R2 buckets are private. Never commit credentials, personal data, `.env`, `.data`, or downloaded binaries.

## Verification and dependencies

Use `make check`, `make build`, and `make audit`. Regenerate contracts with `bun run api:generate` when the API changes. Pin direct dependencies exactly and commit both lockfiles. Check current upstream advisories as well as automated audits; never claim that a clean audit guarantees no vulnerabilities. Do not suppress advisories to make CI green.

Review `docs/SECURITY.md` and `docs/release-status.json` before deployment. The recorded upstream Next.js security notice is a release blocker until patched versions and applicable advisories have been reviewed. Keep documentation truthful about implemented, stubbed, and unverified capabilities. Use local-only listeners for development.
