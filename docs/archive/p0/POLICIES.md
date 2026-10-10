> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Adopted development policies

> Onboarding update (October 10, 2026): earlier mandatory-MFA and operator-only installer decisions below are superseded by email/password login and the documented, configurable setup password. See [current onboarding and boundaries](../OPERATIONS.md#local-installation). Legacy MFA columns/key remain for database and backup compatibility; they do not gate access.
Version `p0-2026-10-09`. The project sponsor authorized reasonable defaults during implementation. These choices govern development and synthetic acceptance. They do not represent consultation with a particular school or a legal retention determination.

| Area | Adopted default |
|---|---|
| Accountability | Project sponsor owns product acceptance and appointment of school reviewers. School administrator owns account delegation and access reviews. Designated safeguarding/data lead owns guardian checks and disclosures. Operations custodian owns infrastructure, backups and recovery. Engineering supplies evidence; it does not impersonate a school reviewer. |
| Language / calendar | English and Arabic; Asia/Beirut suggested during setup, editable IANA zone; Monday–Friday suggested working week, editable; explicit year start/end dates. |
| Required identity | Name and unique normalized login; no national ID, birth date, email or student data is necessary for P1. A person may exist without a login in later registration. |
| Educational concepts | Official enrollment, advisory membership, instructional groups, evidence and qualifications are separate. Teacher-reviewed evidence drives assessments; no overall intelligence/potential score. |
| Guardian verification | P2 must require staff verification of identity and authority, named verifier, date, linked child, allowed disclosures and restrictions. Family name matching never proves authority. |
| Confidentiality | Default deny. No student/parent records through generic role membership. Case narratives and private reflections are excluded from ordinary profiles/search/AI. Exceptional access needs purpose, explicit approval and audit. |
| Account recovery | Operator verifies identity through school-held contact/identity records and a second authorized custodian for privileged recovery. Record a non-sensitive reason; never copy identity documents into logs. Recover existing active roles only. |
| Delegation | Administrator explicitly grants school-scoped account capabilities. Managing staff may invite teacher/student/parent roles only; no new administrators, managerial privileges or self-elevation. |
| Assessment / reporting | Teachers decide; designated moderator/publisher approves official reports. P4 must preserve rubric, evidence and decision versions. No jurisdiction-specific report format is assumed. |
| Activation / sessions | Invitation validity 24h; installer validity 30m; idle session limit 30m; absolute 8h; sensitive reauthentication 10m; privileged MFA required in development and production. |
| Audit / retention | Preserve audit and identity history during development. Proposed school baseline: audit 365 days, daily encrypted backups 30 days, monthly recovery copies 12 months. No automatic deletion is enabled until school/jurisdiction approval and restore effects are tested. Educational-record retention remains separately approved before P2 live records. |
| Backups | Daily encrypted offsite copy, separate deletion credentials and key custody, two recovery custodians, proposed RPO 24h/RTO 4h, quarterly restore rehearsal and before risky upgrades. Local test timings are not a VPS SLA. |
| Notifications / AI | Email optional and currently disabled. Use private hand-delivered single-use activation codes. AI and all external content processing remain disabled until P6 approvals and evaluations. |
| Access / devices | Same-origin online authorization. No cached administrator mutations or shared-device offline storage. Remote credential entry requires trusted HTTPS. No claims of fully offline R2 access. |
| Optional modules | None enabled automatically. All plan optional modules remain tracked and require a separate product decision. |

Required before live school use: named staff acceptance of these policies, reporting obligations, applicable retention/disclosure rules, verified incident contacts, tested key custody, and production/security gates. Changes receive a new policy version and migration/review notes; existing evidence must not silently change meaning.
