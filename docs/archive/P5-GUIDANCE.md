> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# P5 learning plans, advising and support

Implemented for local synthetic evaluation on 2026-10-09 against section 10.7 of the development plan. Apply `make migrate`; migration `b52f19d82011` follows the existing P4 assessment migration. No dependencies or lockfiles changed. The working tree's earlier P4 work is preserved.

## Learning workflow

**School → Plans & support** provides evidence-linked learner statements, declared interests, goals and contextual feedback. Authorship, uncertainty, review dates and review/challenge/withdrawal history remain visible. Decisions and needs require validated evidence for the same student; an outcome-linked statement must cite assessment of that outcome. Students can challenge a statement. Only an explicit reviewed `ready` decision satisfies a prerequisite; reviewing a developing capability is not readiness. Challenged, withdrawn, expired or superseded-evidence decisions do not satisfy prerequisites. Corrections withdraw a statement and propose its replacement without erasing history. Reviewing a new decision for the same outcome supersedes the older reviewed decision, retaining both review histories.

Current assigned teachers and explicitly assigned advisers review plans. The `adviser.review` capability alone does not grant access to every student; effective dated assignments are managed by academic administration. Administrator/registrar status alone does not authorize academic judgments. Ending an assignment or revoking a capability takes effect on the next request.

Required/recommended prerequisite edges reject cycles and preserve reasoned revision history. Teachers author course-specific activity rules with an outcome, rationale, category, observable milestone, estimated minutes and draft/published/retired state. Only published rules reach current course members. Earlier editions remain in the audit-linked event history. Recommendations explain missing prerequisites and never infer mastery from attendance, scores, clicks or AI.

Plans preserve immutable editions and distinguish proposed plans from educator-approved editions. Each activity carries a goal, activity, milestone, outcome, responsible educator, date and workload estimate. Every plan retains foundations, personal specialization and shared experiences. An educator must explain exceptions to missing required foundations. School-configured daily/weekly guided-work limits and protected break days are enforced on the server. These limits concern the guided activities recorded in the plan; they do not estimate unrecorded homework or total personal workload.

Activity commitments distinguish recommended, approved, scheduled and completed. Scheduled activities reference a published school session or an actual support intervention. School-session completion requires a past session and a delivery record; support completion requires recorded delivery. A progression proposal may name an instructional group, but plan approval does not mutate enrollment, advisory membership or teaching groups. Academic staff apply reviewed membership changes through the existing registrar workflow. No ability labels or automatic social-group movement are introduced.

## Support workflow and confidentiality

An administrator first configures named referral/escalation recipients, actual response arrangements, the school's urgent human-contact procedure and workload limits. There are no assumed emergency services or guaranteed continuous coverage. The optional `support_coordinator` role implies coordination and uses email/password login. `support.coordinate` and `support.provide` can also be explicitly delegated. Case-note access requires current responsibility plus assignment to that case; administration and school-wide capacity oversight do not grant narrative access.

1. An authorized student, educator or guardian requests help using an educational goal and review date. The requester sees the configured recipient/response arrangements. Guardian requests return a receipt without automatically opening the case to the family.
2. The assigned coordinator acknowledges urgent concerns, triages requests, assigns an active provider and explicitly approves support. Approval without available provider capacity becomes an escalation. Escalated requests are not delivery records, and escalation alone cannot bypass approval.
3. Providers/coordinators offer real appointments with a room, service and start/end times. Conflicts include provider, student, room, lessons, room reservations, other support slots, protected break days, holidays and recorded provider availability. Existing timetable/room APIs also check support capacity. Appointments are individual (one learner plus provider), not a group-capacity optimizer.
4. Authorized participants choose an available slot for the assigned provider. Booking rechecks approval, current provider permissions, time, capacity and conflicts under the existing transactional authorization lock. Concurrent requests cannot claim the same slot.
5. The assigned provider records delivered or missed after the session ends. Missed/cancelled commitments remain unmet and escalate. Professionals review the educational outcome before case closure. Goal/review-date corrections retain history; students/families can record disagreement. Closing a reviewed case never invents delivery for an unmet request.

Professional notes occupy a separate table and require explicit audited reads. Corrections append a new note referring to the original. They never enter ordinary profiles, keyword learning search, student notebooks or general capacity summaries. Assigned professionals can explicitly open validated educational evidence, with audited access. There is no AI retrieval or outbound notification integration.

Accommodations are deliberate disclosures of practical actions to a specified course. Current course membership, teaching assignment, review date, withdrawal and case closure govern visibility on each request. Ordinary teacher views omit the case identifier and private narratives. Family case access requires both a coordinator's reviewed disclosure decision and an effective guardian `support` permission; plan participation uses the separate `plans` permission. No guardian is automatically notified. Downloaded or previously read information cannot be revoked retroactively.

Capacity reports contain state counts, available slots and operational escalation identifiers, without case narratives. The in-app queue surfaces urgent unacknowledged, capacity-escalated and overdue cases. Staff must follow the configured human-contact procedure; this is not email/SMS/push delivery or a monitored emergency-response service. If a named professional leaves, school administrators must replace staffing and review affected assignments; automatic professional substitution is not implemented.

## Requirement and acceptance evidence

| Requirements | Implementation and verification |
|---|---|
| CUR-02/03, PLN-01/03/04, STU-08/09 | Prerequisites, authored rules, evidence-linked profiles, challenge history, dated adviser assignments; `tests/test_guidance.py` and browser plan/challenge flow |
| PLN-02/05/06, TCH-12 | Plan editions, review authority, protected breaks/workload, actual-session links and distinct commitment states; approval/denial/history tests; membership remains unchanged |
| CASE-01/02/04, SUPR-01/02/05/06, TCH-13, STU-13 | Named response policy, approval, assignment, scheduling, delivery/missed/review/closure and capacity escalation; booking-race and missed-session tests |
| CASE-03/05, SUPR-03/04/07, PAR-07 | Separate notes, audited access, reasoned corrections, explicit accommodations and dual guardian disclosure checks; guessed-ID, role and relationship revocation tests |
| ADM-09, STF-10, SUPR-08 basics, INS-01 support basics | Aggregate capacity/delivery counts and escalation queue without narratives; advanced longitudinal institutional analytics remain P9 |
| AT-13/14/15 | Plan approval preserves memberships; unavailable support stays escalated; ordinary teachers cannot retrieve restricted notes through direct case APIs or ordinary views |
| Recovery and migration | Model/migration comparison; real encrypted PostgreSQL/media restore reproduces plan/statement histories, case/booking records, accommodations and restricted notes with permissions |

The browser scenario uses the owned design tokens, creates an authored rule and reviewed plan, lets a student challenge evidence and request support, and shows a coordinator's unmet-capacity escalation. Narrow-layout and axe checks supplement API integrity/security tests. They do not establish manual screen-reader, Arabic or school-user acceptance.

## Retained blockers and scope

P5 local functionality does not turn the unfinished P4 assessment slice into R1. P4 grading/moderation, appeals, reporting/exports, family communication/meetings and historical report closure remain mandatory work. Earlier full Arabic/accessibility, department-scoped administration and institutional acceptance gaps also remain.

The recorded Next.js notice remains unresolved. Live private R2, offsite/Contabo installation/upgrade/recovery, container scanning, production privilege separation, monitoring and school-approved staffing/policy evidence remain release gates. No production deployment or real-school data use was performed. The Phase 5 functional acceptance scenarios are implemented and locally tested; full P5 phase acceptance remains dependent on the documented P2–P4 and school/deployment gates.
