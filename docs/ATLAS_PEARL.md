# Atlas Pearl implementation

The supplied `../atlas-pearl-kit/atlas-pearl` landing and workspace prototypes have been rebuilt as React/TypeScript pages, using Tailwind CSS 4 and owned shadcn/ui components. The kit is a design reference, not a runtime dependency. No iframe, injected prototype HTML, runtime eval, or external font service is used.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Pearl landing page, interactive assistant examples, flashcards, role tabs, FAQ and explicitly local pilot-form preview |
| `/login` | Real backend sign-in and links to six fictional preview accounts |
| `/files` | Authenticated personal upload, verification, download and deletion |
| `/preview/lina/home` | Returning student: subjects, lessons/chapters, study, practice, human adviser, activities |
| `/preview/sami/home` | New student onboarding, interests, adviser-matching empty state, independent practice |
| `/preview/daher/home` | Teacher lessons, publishing form preview, class evidence, misconceptions, teaching flags and follow-ups |
| `/preview/nassar/home` | Adviser caseload, student details, question replies and subject proposals |
| `/preview/karim/home` | Parent choices, shared guidance and illustrative progress |
| `/preview/hajj/home` | School activity review, proposed access matrix, local policy switches and final subject confirmation |

Invalid accounts, sections and detail IDs render the framework not-found screen. The mobile navigation uses an accessible shadcn Sheet; dialogs, tabs, dropdowns, accordions and switches use Radix-backed shadcn primitives. Light/dark themes, keyboard focus and reduced-motion preferences are supported.

## Working services versus samples

Only login, sessions and private files connect to the Python API. Preview accounts do not create sessions or grant file access. API authorization and private R2 controls are unchanged.

School records come from the kit's fictional fixtures. Preview actions persist in **sessionStorage for the current tab**, so a proposal can move from student/adviser to parent to staff by switching sample accounts. Practice answers, working and completion survive navigation. Help is paused during an active sample batch. Teacher analytics can be explored with the “At school” scenario. Settings only change preview behavior, never API policy. Reset everything in the scenario dialog.

Assistant responses and flashcards are scripted. Feedback uses the kit's fixed example answers. No inference, adviser notification, email, pilot signup, video playback, real assessment, or school-record mutation occurs. The lesson-publishing form saves local metadata only; it never sends the selected video. The real private-file service remains limited to TXT/PDF/PNG/JPEG. The sample parent progress policy is still exploratory. Additional student caseload profiles contain summaries, while Lina has the complete guidance example.

## Ownership

- `packages/ui/src/styles.css`: Tailwind entry, Pearl/shadcn theme tokens, accessibility base styles.
- `packages/ui/src/components`: owned shadcn components; attribution in `THIRD_PARTY_NOTICES.md`.
- `apps/web/components/pearl-art.css`: kit's CSS glass/sphere artwork.
- `apps/web/components/landing.tsx`: landing interactions and copy.
- `apps/web/components/preview`: role pages, fixture data and local state.
- `apps/web/components/files-app.tsx`: preserved authenticated file lifecycle, restyled with Pearl.
- `components.json` in web/UI: shadcn monorepo aliases.

Hanken Grotesk is self-hosted from its pinned Fontsource package. No production deployment or release approval is implied by this frontend implementation. See SECURITY.md and VERIFICATION.md.
