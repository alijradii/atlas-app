> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Threat model and permissions

> Onboarding update (October 10, 2026): earlier mandatory-MFA and operator-only installer decisions below are superseded by email/password login and the documented, configurable setup password. See [current onboarding and boundaries](../OPERATIONS.md#local-installation). Legacy MFA columns/key remain for database and backup compatibility; they do not gate access.
Trust boundaries: browser → same-origin proxy → Python API → PostgreSQL; operator → deployment marker/key; worker → database outbox; API → private R2 adapter. External identity, email and AI are not prerequisites for P1.

| Threat | Control | Evidence / remaining work |
|---|---|---|
| First visitor takes ownership | Expiring server-issued code, hashed tokens, origin and CSRF checks, shared rate limiter | Unauthorized/expired/rate-limit integration tests |
| Two installers claim school | Row lock, singleton constraints, atomic account/settings/installed transaction, idempotency receipt | Concurrent real PostgreSQL test |
| DB outage or empty accounts reopens wizard | Persistent marker comparison; never infer setup from accounts | Failure/restart/mismatch tests |
| Restored DB paired with wrong deployment | Deployment UUID + installed flag; mismatch returns unavailable | Marker mismatch and restore verification |
| Stolen cookie or login CSRF | HttpOnly, Secure production, SameSite Strict, CSRF, exact configured origin, MFA, bounded sessions | Browser/API tests; production TLS rehearsal open |
| Brute force | Per-source and per-login PostgreSQL windows; generic login failures; scrypt | Rate-limit and secret-redaction tests; proxy source handling and load test open |
| Privilege escalation | Server checks capabilities; managers cannot create privileged roles or delegate rights | Negative API tests and durable denial event |
| Last admin removed | Serialize account changes, require another active MFA-enrolled administrator | Last-admin regression test |
| Removed rights remain in session | Revocation on role/status/recovery changes; permissions read from database | Suspension/recovery tests |
| MFA DB disclosure | Fernet encryption key outside DB, 0600 local key, backup encryption | Key-custody and remote storage acceptance pending |
| Lost access | Operator verifies identity and issues expiring single-use activation; preserves roles and installed state | Email-free recovery integration test |
| Sensitive input leaks | Validation strips submitted values; no credential query parameters; no session tokens in audit; no-store responses | Redaction tests; infrastructure logging review required |
| Duplicate/crashed jobs | Durable outbox, lease, bounded retries, atomic internal effects/completion | Job tests; external handlers must add current-authorization checks |
| Backup theft/destruction | Encrypted archive, separate key, restore-only-new-db guard | Local restore drill; offsite separate credentials still pending |
| Restricted files leak | No browser signing/upload endpoints in P1 | R2 adapter internal only; P3 upload/ACL gate remains |

## P1 action matrix

| Action | Administrator | Delegated managing staff | Teacher/student/parent |
|---|---|---|---|
| Read own identity and sessions | Yes | Yes | Yes |
| Revoke own sessions | Yes | Yes | Yes |
| List school accounts / read audit / settings | Yes | No | No |
| Invite admin/managing staff | Yes, recent authentication | No | No |
| Invite teacher/student/parent | Yes | `accounts.invite`, recent authentication | No by default |
| Change roles / suspend | Yes, recent authentication and succession rule | No | No |
| Recover ordinary account | Yes | Explicit `accounts.recover` only | No by default |
| Recover privileged account | Server operator after identity verification | Server operator | Server operator |
| Run backup/restore / reconcile markers | Server operator CLI | No | No |

Capabilities are school-scoped P1 identity actions only. An account can hold several roles. P2 must add department/group/guardian scopes before any student record disclosure; P1 role membership never grants a future content endpoint. No account type grants confidential case-note access by default.

Application audit endpoints are read-only; this is not protection against an unrestricted database/server administrator. Separate migration/runtime/backup database roles, offsite integrity-protected audit copies, automated retention, incident alert routing, compromised-password screening and security review remain production gates.
