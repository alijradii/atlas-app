# Atlas — School of 2036 demo brief

## Formal problem statement

Learning needs do not follow the school timetable. Students need to revisit lessons
and ask questions when difficulties arise, including after class, but support is
split across lesson materials, assignments and disconnected conversations. At the
same time, introducing AI as a replacement for thinking or human guidance risks
weakening the very learning it should support. Subject and pathway choices also
require discussion with people who understand the student.

Atlas addresses the continuity gap between classroom learning, independent study
and human guidance: timely support beyond the school day, without transferring
assessment or personal decisions to an AI.
This is Atlas's proposed problem framing, not a measured finding from a user study.
The official *School of 2036 — Topic Brief* asks teams to reinvent an aspect of the
student, teacher, parent or school experience and demonstrate a working solution.
It does not prescribe the six problems below.

## What Atlas does

Atlas connects self-directed study with human guidance in one learning workspace.
Students can begin with a question, or ground a conversation in approved lesson
transcripts and documents. Teachers share lessons, review submitted work and give
feedback. Students and advisors discuss choices, with parents participating in
explicit proposal decisions. A persistent assistant explains the interface and
highlights the relevant control when a user needs help.

The principle is **support between lessons, with people responsible for feedback
and decisions**. Materials remain private unless explicitly shared; model replies
and source quotations remain visible for inspection. The prototype demonstrates
these workflows; it does not establish improvements in educational outcomes.

## Six candidate problems: claim only what the demo supports

| Candidate problem | Defensible Atlas response today | Boundary |
| --- | --- | --- |
| Difficulty sustaining attention | A prioritized home, one question at a time, a collapsible assistant, and contextual UI guidance reduce navigation overhead. | We have not measured attention or learning gains. Avoid claiming to cure short attention spans. |
| Dependence on AI | Tutoring encourages reasoning; learners submit their own work and teachers give feedback. Source-based answers expose quotations for checking. | No reliable detection of AI-written work or enforced independent-assessment mode is claimed. |
| Undiscovered interests | Students can bring ideas and subject proposals to a human advisor. | This is a discussion and decision workflow, not an implemented interest-discovery engine. |
| Limited social connection | Private student–advisor conversations and linked family decisions connect learners to people. | Peer chat, clubs and peer matching are not implemented. Do not present this as a peer-social platform. |
| Unseen learning needs | Teachers can inspect submitted answers and give individualized feedback. | Automated misconception diagnosis and class-wide learning analytics are not implemented in the authenticated app. |
| Limited individual attention | AI offers on-demand study help between lessons, with optional grounding in the student's authorized materials. | AI responses can be wrong; human feedback and decisions remain separate. |

Prioritize **individual support**, **visible student work**, and **human guidance**
in the pitch. The other themes are motivation or design intent, not six proven
outcomes.

## Suggested spoken pitch (about 60 seconds)

What if education stopped being a place students leave behind at 3 PM?

A student's questions do not end when class does. They need a way to revisit a
lesson, get help when they are stuck, and talk through decisions about their future.
AI can help, but it should support learning rather than replace the student's
thinking or the people around them.

Atlas connects that experience. Start with a question immediately. When you need
help with your own lesson, select approved material and inspect the passages behind
the answer. If you cannot find a feature, ask Atlas and it highlights the control.

The work still belongs to the student. Teachers review it and provide feedback.
Advisors discuss interests and pathway choices, with families involved in the
relevant decisions.

Our prototype connects those workflows today. Our 2036 vision is a learning
experience that continues beyond the school gate, with AI available to help and
people still responsible for judgment.

## Alignment with the unfinished team presentation

Read `Atlas Presentation.pptx.pdf` as a work in progress. Its opening eight pages
establish the team's hook, the three targeted problems, the connected-school vision,
the source-backed study flow, the demo slot and the team. Later generic research,
planetary examples and numerical charts are template placeholders, not project
evidence. This brief does not treat them as findings or edit the supplied deck.

Two presentation details should match the demonstration:

- The student flow now has two entry paths: **ask immediately**, or **upload → review
  → prepare/index → select → ask with sources**. Source selection is optional for
  general tutoring, required for answers grounded in private lesson materials.
- Monitoring staff performance at school level is a vision statement, not a shipped
  authenticated feature. Do not frame it as part of the current working demo.

## Screen recording plan

- Pearl home and task priorities: one place to see what needs attention.
- Collapse and restore the assistant: support stays available without covering work.
- Ask where to upload: a real model request, then contextual dim and highlight.
- Study: ask a question without choosing a source first; show the actual saved reply.
- Approved lesson sources and source quotations: optional grounding, shown distinctly.
- Advisor conversation and subject plans: people retain responsibility for decisions.
- Teacher feedback: connect learning support to the learner's submitted work.

Use real authenticated application screens with fictional, persisted demonstration
data. Do not substitute test-provider output or preview fixtures. Opening/closing
titles and caption bands are editorial overlays, not product features. The recording
can shorten navigation or processing time; it is a highlight reel, not a latency
benchmark. Do not claim that all flows shown occur in a single uninterrupted session.

## Submission constraint from the official brief

The required deliverable is pitch slides exported as PDF and a private YouTube video
of **up to five minutes** with the team presenting the pitch and demonstrating the
work. This application reel can be inserted into the team's presentation; it does
not replace the team introduction or slide portion. Uploading to YouTube or submitting
the entry is a separate publishing action.

Source: local `School of 2036 - Topic Brief.pdf`, pages 1–2, supplied with this project.

Pitch alignment source: supplied `Atlas Presentation.pptx.pdf`, opening eight pages.

## Technical slide labels for the implemented application

- Browsers → HTTPS reverse proxy (Caddy): deployment topology; the local demo uses HTTP.
- Next.js + TypeScript: Bun runtime, shared Pearl components and presentation.
- Python / FastAPI: authenticated permissions, business rules, transactions and read-only MCP UI guidance.
- PostgreSQL: accounts, relationships, records, conversations and durable job state.
- Redis + Celery workers: job delivery, upload verification, extraction/transcription, ingestion and study-answer jobs.
- Private RAG service: Milvus Lite, Gemini embeddings and explicitly scoped retrieval.
- Gemini: general tutoring and grounded answer generation through the Python application/worker; UI-help calls run in the API.

Replace the old worker label “solver.” Replace “Internal AI service” with “Private
RAG service”; the separate older AI service is only a health placeholder. RAG is
optional for general study sessions and required for selected-source study. Private
file storage (local development / R2 deployment) is a separate component if space
permits. This is implemented topology, not proof of production deployment readiness.

## Recorded deliverable

The captioned, silent application reel is saved locally at
`.cache/output/playwright/atlas-demo/Atlas-2036-Demo.mp4` (1600×900, 30 fps,
about 1 minute 56 seconds). It contains actual authenticated interactions with
fictional persisted accounts and real model responses. One source-processing wait
is shortened and labeled. The framing excludes browser chrome and desktop edges.
Screenshots, raw WebM captures and the editing manifest are beside it in the ignored
artifact folder. No credentials or session storage files are included in the video.

The team can speak over this reel or insert it into the up-to-five-minute pitch.
No upload or submission has been performed.
