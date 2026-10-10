# Atlas Pearl implementation

The supplied `../atlas-pearl-kit/atlas-pearl` landing and workspace prototypes have been rebuilt as React/TypeScript pages, using Tailwind CSS 4 and owned shadcn/ui components. The kit is a design reference, not a runtime dependency. No iframe, injected prototype HTML, runtime eval, or external font service is used.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Pearl landing page, interactive assistant examples, flashcards, role tabs, FAQ and explicitly local pilot-form preview |
| `/login` | Real backend sign-in and links to six fictional preview accounts |
| `/files` | Authenticated personal upload, verification, download and deletion |
| `/study` | Authenticated transcript library and Gemini-backed conversations with source passages |
| `/preview/lina/home` | Returning student: subjects, lessons/chapters, study, practice, human adviser, activities |
| `/preview/sami/home` | New student onboarding, interests, adviser-matching empty state, independent practice |
| `/preview/daher/home` | Teacher lessons, publishing form preview, class evidence, misconceptions, teaching flags and follow-ups |
| `/preview/nassar/home` | Adviser caseload, student details, question replies and subject proposals |
| `/preview/karim/home` | Parent choices, shared guidance and illustrative progress |
| `/preview/hajj/home` | School activity review, proposed access matrix, local policy switches and final subject confirmation |

Invalid accounts, sections and detail IDs render the framework not-found screen. The mobile navigation uses an accessible shadcn Sheet; dialogs, tabs, dropdowns, accordions and switches use Radix-backed shadcn primitives. Light/dark themes, keyboard focus and reduced-motion preferences are supported.

## Working services versus samples

Login, sessions, private files and the separate `/study` workspace connect to the Python API. Preview accounts do not create sessions or grant access to files or transcripts. See [Study workspace](STUDY.md) for the real inference path and authorization boundaries.

School records come from the kit's fictional fixtures. Preview actions persist in **sessionStorage for the current tab**, so a proposal can move from student/adviser to parent to staff by switching sample accounts. Practice answers, working and completion survive navigation. Help is paused during an active sample batch. Teacher analytics can be explored with the “At school” scenario. Settings only change preview behavior, never API policy. Reset everything in the scenario dialog.

Within `/preview`, assistant responses and flashcards are scripted. Feedback uses the kit's fixed example answers. No inference, adviser notification, email, pilot signup, video playback, real assessment, or school-record mutation occurs. The lesson-publishing form saves local metadata only; it never sends the selected video. The real private-file service remains limited to TXT/PDF/PNG/JPEG. The sample parent progress policy is still exploratory. Additional student caseload profiles contain summaries, while Lina has the complete guidance example.

## Ownership

- `packages/ui/src/styles.css`: Tailwind entry, Pearl/shadcn theme tokens, accessibility base styles.
- `packages/ui/src/components`: owned shadcn components; attribution in `THIRD_PARTY_NOTICES.md`.
- `apps/web/components/pearl-art.css`: kit's CSS glass/sphere artwork.
- `apps/web/components/landing.tsx`: landing interactions and copy.
- `apps/web/components/preview`: role pages, fixture data and local state.
- `apps/web/components/files-app.tsx`: preserved authenticated file lifecycle, restyled with Pearl.
- `components.json` in web/UI: shadcn monorepo aliases.

Hanken Grotesk is self-hosted from its pinned Fontsource package. No production deployment or release approval is implied by this frontend implementation. See SECURITY.md and VERIFICATION.md.

## Priority home and glass vocabulary — October 10, 2026

The home layout now follows the supplied Iteration 2 priority hierarchy while
retaining Atlas glass. A compact greeting keeps the ambient sphere scene as brand
atmosphere. Tasks follow **Needs you → Continue → Waiting → Done**; a changed task
state changes its group and action, not its identity. Waiting items do not imply a
user action. Completed work is collapsed by default, with the earlier week and
subject details still available under “Your week & subjects”.

Glass artwork depicts its task: a worksheet stack for practice, a play screen for
lessons, an initials medallion for a person, branching nodes for a choice and a fan
of cards for study cards. Practice fill reflects answered fraction. Semantic text
and actions carry all meaning; decorative artwork is hidden from assistive
technology. The person treatment is consistently reused rather than assigning an
unexplained bubble to people. Cobalt remains the action accent and rainbow edges
remain material highlights.

Ambient motion uses continuous compositor transforms, pauses outside the viewport
and honors reduced motion. The helper icons remain unboxed. The assistant dock,
recommendations, rich messages, spotlight guidance and persistent sample pins are
preserved in the preview; these sample school actions are not real AI tools.
