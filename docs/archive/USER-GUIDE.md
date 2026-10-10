> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Atlas administrator, teacher, student and guardian guide

## Appearance

Choose **Appearance** in any page header to select System, Light, or Dark colors; Blue, Graphite, or Green accents; and Comfortable or Compact spacing. Changes apply immediately and are remembered in this browser. **Reset defaults** restores System, Blue, and Comfortable. These settings affect your view only.

## First administrator

Open the school home and choose English or Arabic. Enter the setup password **`school2036`** (unless your operator changed it), supply the school’s details and academic year, and create your administrator with an email address. Optionally add a colleague and select **Start with a demo school**. Save and review, choose your administrator password of at least 15 characters, and finish. Save or print the receipt and deliver any colleague activation codes privately.

Demo setup adds eight fictional accounts across six roles, two courses with lessons, two students and their linked parent. Production setup asks you to choose the demo accounts’ shared password. Development uses `school2036-demo!` and shows **Explore a role** buttons on the sign-in page; choose one to sign in immediately. Your own administrator uses the password you chose. Sample memberships follow your selected academic-year dates.

Sign in with email and password. No authenticator code or enrollment is required, including for existing accounts that previously used MFA. Existing non-email login names remain supported for compatibility. Email delivery is not required.

## Invite and delegate

In the school workspace, create an invitation using a name, unique login and role. The recipient receives a code valid for 24 hours and chooses their own password through **Activate or recover an account**. Do not send a shared permanent password. Managing staff can receive permission to invite teachers, students and parents; they cannot create administrators or grant additional authority.

Select an account to review roles, delegated invitation rights and active/suspended state. Enter a meaningful reason before applying the change. Role/status changes revoke that person’s sessions immediately. The last active administrator cannot be suspended or demoted until another administrator has activated. Pending invitations must activate before the role-edit workflow is available.

Sensitive changes require authentication within the last ten minutes. Expand the identity-confirmation section and enter your password, then retry the change.

## Sessions and recovery

Review **Your sessions** and revoke any session you no longer need. Revoking the current session signs you out. Signing out invalidates the server session. A role change or suspension invalidates all affected sessions.

If you lose a password, contact the school’s recovery operator. After verifying your identity and authority, they can issue a one-time recovery code. Recovery revokes existing sessions and requires a new password. It preserves your current permissions and never reopens school setup.

## What this phase includes

School setup, baseline account management, security history and continuity status are available for synthetic evaluation. Registration, guardian verification, attendance, courses and submissions now have a functional P2/P3 workspace; formal assessment and reports remain P4. The design catalogue shows clearly labelled prototypes, not completed school workflows. Follow `PHASE-STATUS.md` before planning live use.

## P2 / P3 school workspace

Teachers land on **My courses** after sign-in or when reopening the home page. Choose a course card to open its classroom. **Announcements** shows and publishes updates for that course; **Materials** lists its lessons, resources, and assignments; **Students** shows the current course roster; **Student work** contains that course’s submissions and assessment history. Use **New material** to open the editor, or select existing material to read, edit, or publish it. Each course tab has its own URL, so refresh and browser Back keep the course context.

Use **My courses** to switch classrooms. **School tools** keeps timetable/attendance, notebook, projects, support, and other school-wide workflows available. **Account & security** opens sessions and account controls at `/account`. Enrollment remains managed by authorized school administrators; the Students tab does not grant teachers registration privileges.

Other roles can choose **Open school workspace** after sign-in. Administrative controls depend on explicit capabilities granted under **Account & security**. Grant only the required school-wide registration, academic administration or attendance responsibility. Assigned teachers work within their courses; parents see records only through currently verified, permitted relationships.

1. **Administration → People / Import:** register a person or paste a CSV with headings. Map columns, inspect every error and previewed row, and commit the reviewed batch. Repeating the same commit returns the prior result. Conflicting logins or identifiers must be corrected; two people sharing a name need an explicit distinct-person review. Deliver individual activation codes privately. They expire after 24 hours and do not require email.
2. **Structure / Memberships:** configure years, groups, courses and rooms, then assign official enrollment, course membership, advisory membership and teaching separately. Dates preserve history. End a membership with a reason before recording a transfer; do not erase the earlier record.
3. **Guardians:** verify each parent-child relationship with effective dates, evidence and allowed actions. Free-text restrictions describe the evidence; the selected allowed actions enforce access. Change or revoke permissions immediately when authorization changes.
4. **Timetable:** prepare a session, then publish after review. The server checks the actual teacher assignment, calendar, room capacity and overlapping people/resources again at publication. Changing a published session returns it to draft. A session with attendance remains historical. A substitute needs a valid teaching assignment. Rooms/equipment can also be reserved from **School tools → Timetable** for teachers, or **Today** for other authorized roles.
5. **Attendance / Requests:** teachers record attendance for assigned sessions. Staff corrections add a new revision with a reason. Parents may submit permitted absence, pickup, contact or correction requests; approval records a decision and does not silently rewrite attendance or a profile. Staff apply an approved correction to the relevant record separately.
6. **Rollover:** create next year's groups, preview placements, review every person and commit. The UI reviews one group mapping at a time; the API supports multiple mappings atomically. Advisory memberships change only when deliberately included. Rollover records no learning achievement.
7. **Courses:** choose a course, upload resources, author a draft, review it, then publish. Preserve source links, page/chapter references and permitted-use information. Revised editions retain prior versions. Students see published material; course membership and retirement affect subsequent downloads.
8. **Submissions:** students respond to an assignment and may submit another revision. Each revision chain keeps its original instructions even when a teacher publishes new material. Teachers review the exact submission version or record practical/offline work for an enrolled student.
9. **Notebook:** create private notes, annotations, bookmarks, flashcards or dated revision tasks. Existing text autosaves after a pause; wait for **Saved on server**, and use retry after an error. Share only through the explicit audience control. Parents never receive notebook items automatically. Own notebook records can be exported as JSON.

The functional school workspace is currently English. Approved downloads can be used offline; the application does not promise offline sign-in or browser draft synchronization. Assessment evidence is available as described below; controlled report publishing remains outstanding P4 work. Consult `PHASE-STATUS.md` for the remaining acceptance gates before using real school records.

## P4 assessment workflow

In **Courses**, an assigned teacher selects a course and opens **Rubric workshop**. Create criteria mapped to the school's outcomes, optionally add maximum scores, and save an edition. Select that edition in the material editor before reviewing and publishing the assignment. Students see the published criteria and declare any assistance when submitting.

For each submission, use **Record assessment evidence** to record criterion judgments, observed assistance, accommodations used, feedback, uncertainty and next steps. Saving a draft does not share it with the student. Use **Validate and share assessment** after reviewing it. To correct a decision, save a new draft with a correction reason and validate it; earlier decisions remain in the history. Use **Reload decision history** if another teacher has changed the record.

Rubric changes apply to newly selected editions; existing submissions retain their original instructions and criteria. Older tasks without a rubric need a new assessment task. Guardian reports, moderation, formal appeals and report exports are still being developed. See [P4 assessment status](P4-ASSESSMENT.md).


## Learning plans and support (P5)

Open **School → Plans & support**. Administrators first use Account & security to assign support coordinators/providers/adviser capabilities, then configure actual staffed response arrangements, workload limits, prerequisites and dated adviser assignments. See [P5-GUIDANCE.md](P5-GUIDANCE.md) for the exact permissions and setup order.

Teachers can publish next-step rules, cite reviewed assessment evidence in a learner statement, and propose/review plans containing foundations, personal choices and shared experiences. Students can declare interests/goals, propose plans and challenge inaccurate statements. New editions preserve earlier decisions. A plan approval does not change social or instructional membership.

Use **Request support** for a named human coordinator. Professionals triage, assign and approve a need, publish appointment capacity, record delivery or missed sessions, and review the outcome. An unmet need stays visibly escalated. Restricted notes must be opened explicitly by an assigned professional; publish only practical classroom actions as accommodations. Guardian participation requires current `plans`/`support` permissions and, for cases, an explicit disclosure decision. Follow the configured school procedure for urgent concerns; the app does not offer emergency or continuous human monitoring.

## Learning with AI (P6)

Open **Learning with AI** in the school workspace. It initially shows **School AI is disabled**. Administrators approve a configured provider only after a teacher has reviewed a passing model evaluation, and choose permitted capabilities, processing purpose, spending limits and retention.

Teachers select a published activity, choose independent/learning/production assistance, explain the boundaries and queue source extraction. Check the extraction limitations before using a source. Students select their activity, choose approved sources and ask a question or share an attempt for a further hint. Responses show exact source passages and coverage limits. Generated responses are not evidence of independent mastery.

Teachers can edit and review a generated lesson/practice/template draft, then use the normal Courses review/publication workflow. Feedback drafts address the exact selected submission and are disclosed only after teacher approval. A private revision task can be added to Notebook. Report a factual, language, educational, privacy, safety or injection concern through the response's issue form. Severe reports pause AI pending review and reevaluation. School lessons, attendance and records remain available when AI is disabled or its provider fails.

Provider setup and the real-model acceptance process are described in [P6-AI.md](P6-AI.md). No approved provider is enabled by this implementation.


## Timetable proposals and projects

School managers can open **Timetable proposals**, select published future lessons, prepare room/teacher replacements and save a proposal. Review the before/after comparison and conflicts. An administrator records an approval or rejection with a reason. Approval rechecks availability and publishes every change together; affected course audiences see an in-app notice. This workflow keeps lesson times and groups fixed. Use an effective teaching assignment for a substitute.

Teachers can open **Projects → New project**, choose an assigned course and learning outcomes, add team responsibilities and milestone evidence requirements, and save a draft. Review the brief before launching it. Students open the active project and submit their own contribution with an assistance declaration. Teachers review the current contribution edition, provide feedback and record observed understanding. Every learner and milestone needs verified current evidence before the teacher can record the shared outcome and complete the project. Earlier contributions/reviews remain visible to the student and teachers. Peers cannot read one another's individual explanations.

See [P7-P8-COORDINATION.md](P7-P8-COORDINATION.md) for current limits and the remaining phases. No mentor access, public portfolio publication or offline synchronization is enabled by these workflows.
