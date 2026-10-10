# Security and release status

## October 10, 2026 foundation reset

The active application now exposes basic password login, session lookup/logout, health/status, and owner-only personal files. Public setup, default setup passwords, demo login, registration, school workflows and AI inference have been removed. Accounts are provisioned locally by an operator. Existing database records and migration history remain intact.

Retained controls: scrypt passwords, hashed session tokens, HttpOnly/SameSite cookies (Secure in production), explicit installation markers, database-backed login throttling, Origin and CSRF validation, request-size limits, owner-only file access, bounded quarantine capture, checksums and scanner checks. Public R2 buckets are prohibited. No scanner means only plain-text development uploads can complete; production requires ClamAV and private R2. No browser storage credential is exposed.

## Release blocker remains

The previously recorded [Next.js October security notice](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026) remains unresolved. The URL could not be fetched during this reset; the official blog search listing still describes an upcoming October 14 update. Do not treat the locked Next.js 16.4.0 release as cleared. Review affected versions and patched releases, regenerate the lockfile and verify the Bun runtime before changing the release gate.

The [Next.js advisory list](https://github.com/vercel/next.js/security/advisories), [FastAPI advisory list](https://github.com/fastapi/fastapi/security/advisories) and [Bun security page](https://github.com/oven-sh/bun/security) were checked again. This is not a comprehensive advisory applicability review. Automated audits and source review do not cover all container OS, runtime, configuration or unknown vulnerabilities. No advisories are suppressed.

Run `make check`, `make build`, `make audit`, and browser checks before release. Keep direct versions pinned and both lockfiles. CI retains a separate release-readiness gate, which intentionally fails while production approval is false.

Live R2 permissions/CORS/expiration, production privilege separation, container scans, remote recovery and new application acceptance remain unverified. Legacy media needs its own storage backup; the new file service and personal-media backup do not expose or enumerate old course attachments.

## Atlas Pearl frontend — October 10, 2026

The new public landing and `/preview/*` pages contain fictional kit data and local interactions only. Preview personas never authenticate against the API. Browser storage holds only theme preferences and sample workspace state; real session credentials remain in HttpOnly cookies. Only `/login` and `/files` use the retained application API. Scenario and school-policy switches do not authorize backend access.

After adding Tailwind and shadcn/Radix, `make audit` checked 249 JavaScript packages and the Python lock export without reported vulnerabilities. The upstream [Tailwind](https://github.com/tailwindlabs/tailwindcss/security/advisories), [Radix](https://github.com/radix-ui/primitives/security/advisories) and [shadcn](https://github.com/shadcn-ui/ui/security/advisories) advisory pages showed no published advisories when reviewed. The Next.js advisory index was also rechecked. This does not resolve the existing release blocker or establish production readiness.
