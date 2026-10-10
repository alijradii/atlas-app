# Private account controls

`/account` uses the authenticated API and the Pearl interface. It shows active sessions with start and last-active times, identifies the current session, and lets the signed-in person sign out all other sessions. Device names and locations are not inferred: the existing session model does not record them. No session token, token hash, IP address, or cross-account identifier is returned.

Changing a password requires the current password and the existing 15–128 character policy. The API accepts valid Unicode, does not normalize or trim passwords, and forbids extra input fields. Both mutations require the normal Origin and CSRF checks. Failed password changes are audited without credential contents. A database-backed limit permits ten password-change attempts per account and forty per client IP in a 15-minute window, including attempts across multiple sessions.

A successful password change revokes every old session, including the current one, then issues a fresh current cookie and CSRF value. Other tabs must refresh before their next mutation. Jobs tied to the old authenticated session are subject to the existing study session-revocation checks. Signing out other sessions alone preserves the current cookie and CSRF value.

Forgotten-password recovery remains a local operator action: `uv run --frozen python -m school2036.operator reset-password --login USER`. There is no public registration, password-reset email, recovery token, or email-delivery claim. Account creation still uses the local operator command. Network location never determines access; a valid account and the resource's permissions do.
