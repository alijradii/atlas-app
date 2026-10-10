> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P0 decisions and school acceptance register

> Onboarding update (October 10, 2026): earlier mandatory-MFA and operator-only installer decisions below are superseded by email/password login and the documented, configurable setup password. See [current onboarding and boundaries](../OPERATIONS.md#local-installation). Legacy MFA columns/key remain for database and backup compatibility; they do not gate access.
Date: 2026-10-09. Scope authority: `school_2036_development_plan.md` v1.2.

P0 engineering decisions use sponsor-authorized reasonable defaults in `POLICIES.md`. P0 school validation is **in progress**, not signed off. Engineering can prepare and test the foundation; representative school users must approve workflows and institutional policy. No names or approvals are invented. The project remains the full P0–P10 catalogue. P1 is not R1: R1 includes P1–P4 and production gates.

## Decision log

| Decision | Implementation / rationale | Status |
|---|---|---|
| One installation, one school | Singleton installation and school rows; no tenant parameter, subscription, or public registration. | Implemented baseline |
| Python authoritative core | FastAPI routes call shared identity commands; SQLAlchemy transactions own authorization and writes. Next.js only presents and forwards. | Adopted |
| Bun / Python runtimes | Bun 1.4.2 executes Next.js and TypeScript; Python 3.14 with uv. Exact direct pins and both lockfiles. | Adopted |
| PostgreSQL identity serialization | Singleton row lock protects setup and account succession; drafts/accounts use revision checks. PostgreSQL integration tests apply real migrations in isolated schemas. | Implemented; scale test outstanding |
| Installer authorization | Server-generated 256-bit random code, SHA-256 digest, 30-minute expiry, database rate limiting, separate bootstrap cookie, CSRF, origin check. No email dependency. | Implemented |
| Installation recovery | Independent durable marker includes deployment UUID and installed state. Any mismatch fails closed. Only operator reconciliation can repair an installed marker. | Implemented; external restore drill pending |
| Sessions | HTTP-only SameSite=Strict cookies; Secure in production. Hashed opaque tokens, 8-hour maximum / 30-minute inactivity; privileged mutations require authentication within 10 minutes. | Implemented |
| Privileged MFA | TOTP enrollment required for administrators, managing staff and delegated account capabilities. Encrypted secrets, replay prevention, server-assisted recovery. | Implemented; human usability review pending |
| Passwords | Minimum 15 / maximum 128 characters; scrypt N=131072, r=8, p=1; random salt; no forced composition rules. | Implemented; compromised-password screening remains open |
| UI primitives | Base UI for owned components; React Aria retained only in the comparison catalogue. Avoid introducing a second application design system. | Provisional pending school UX acceptance |
| Visual direction | Editorial learning studio with paper, ink, restrained terracotta; field-notebook alternative renders the same prototypes. | Prototypes available, no human sign-off |
| Language | English and Arabic identity copy, RTL and logical CSS; local system font fallback. | Provisional; bundled Arabic fonts and native-language review outstanding |
| Storage | Local development adapter; private R2 production adapter. No public object URLs or signing endpoints. Files wait for P3 authorization/quarantine flow. | Adapter present; live R2 acceptance pending |
| Jobs | PostgreSQL outbox is source of truth; Celery beat reconciles, workers lease/retry bounded internal jobs. Redis is not the durable business ledger. | Internal health consumer implemented; domain handlers added with their phase |
| Recovery objectives | Proposed RPO 24 hours / RTO 4 hours; encrypted logical database backup plus marker and identity key. Offsite copies and custody require school approval. | Provisional, not a promise |
| AI | Disabled. No setup choice can enable external processing. | Enforced |

## Required school decisions

| Decision / accountable responsibility | Proposed working assumption | Required acceptance evidence |
|---|---|---|
| Project sponsor (requesting user) | All mandatory plan features retained; optional modules need explicit selection. | Sponsor authorized reasonable development defaults; actual school walkthrough and optional selections remain |
| School educational lead (unassigned) | Academic year, official enrollment, advisory community, teaching groups and qualification pathway remain separate. | Curriculum terminology, reporting obligations, assessment authority |
| Safeguarding/data lead (unassigned) | Default deny, no parent link without verification, restricted case notes excluded from ordinary records. | Guardian verification and disclosure policy; jurisdiction-specific review |
| Operations owner (unassigned) | School-controlled VPS, separately controlled encrypted backup destination, two authorized recovery custodians. | Contabo target, DNS, key custody, retention, incident contacts |
| UX/accessibility owner (unassigned) | English/Arabic, WCAG 2.2 AA engineering target, younger-learner variant. | Representative users; manual screen-reader, keyboard, native-language and mobile acceptance |
| Quality owner (unassigned) | Synthetic fixtures only until release gates pass. | Signed test report and accepted open defects |

The sponsor has delegated reasonable development defaults, recorded in `POLICIES.md`; school-specific acceptance remains a separate gate. No production use or phase-complete claim is warranted until these rows have real owners and evidence.

## Workflow acceptance worksheets

| R1 workflow | Owner responsibility | Authorization boundary | Acceptance / phase |
|---|---|---|---|
| Install and recover | Operations + administrator | Installer code; durable markers; privileged MFA | AT-01/02/03/23, P1 |
| Register and activate | Registrar + data lead | Delegated target roles and scope; no self-elevation | AT-04/07, P1/P2 |
| Verify guardian | Data/safeguarding lead | Verified, restricted, expiring child relationship | AT-05/08, P2/P4 |
| Structure, attendance, timetable | Managing staff + educational lead | Explicit assignment, session records and correction reasons | AT-06, P2 |
| Teach and submit | Teachers + educational lead | Assigned groups, protected files, student ownership | AT-09 and plan P3 tests |
| Assess and report | Assessment authority | Evidence provenance, moderation, publication approval | Plan P4 tests; never AI-finalized |
| Communicate with family | Registrar + data lead | Recheck guardian restriction at delivery | AT-05/08, P4 |
| Annual closure | Administrator + registrar | Versioned archives, rollover preview and approval | Plan P2/P4 closure acceptance |

P5 support, P6 AI, P7 optimization, P8 projects, P9 operations and P10 handover remain in the traceability register; none are silently removed.
