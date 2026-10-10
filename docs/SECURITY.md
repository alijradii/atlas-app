# Security and release status

## Persistent assistant and local demo accounts — October 10, 2026

The interface assistant uses an authenticated, CSRF-protected endpoint and a
role-scoped read-only MCP catalog. Model guidance can only select registered UI
anchors loaded through the tool; it cannot execute mutations or retrieve private
records. Session/role checks run again after generation. Attempt limits include
failures, and audit records omit prompt/history text. See [UI_ASSISTANT.md](UI_ASSISTANT.md).

Public fictional persona buttons are removed; fixture routes return 404 outside
the explicit browser-test harness. The four local demo accounts remain ordinary
DB accounts, with scrypt hashes and normal session checks. At the user's request,
a guarded operator migration assigned simple role logins and the shared password
`password` to exactly these accounts, preserving their synthetic data and revoking
old sessions. This is not a runtime authentication bypass or a changed general
password policy. These known local demo credentials do not clear public deployment
approval; do not put sensitive records in these accounts.

## Connected hackathon workflows — October 10, 2026

The authenticated application now includes `/workspace` school workflows and
`/account` password/session controls. Roles and teacher/advisor/parent relationships
are operator-provisioned; no browser endpoint grants them. Every school request
rechecks active accounts, roles and explicit relationships. A role alone does not
grant access to students or transcripts. Teacher publication adds a separate lesson
grant tied to a current student relationship; revocation also affects source reads
and study history. Advisor conversations remain private to the student and advisor.
No access decision depends on a school network. See [SCHOOL.md](SCHOOL.md) and
[ACCOUNT.md](ACCOUNT.md) for lifecycle and recovery details.

Verified owned documents and recordings can produce review drafts through bounded
local converters and Gemini audio transcription. The owner must approve the text
before indexing. Conversion process limits are not a full parser sandbox. Sharing
or publishing a lesson also permits its accepted original-file download; deleting
that original does not delete the separately reviewed transcript. Provider billing,
retention, native parser updates and the release blockers below remain applicable.
No real school or personal recording was used in the provider smoke check.

The dated sections below preserve earlier verification scope; they do not override
the current explicit publication grants or newly implemented workflows.

## October 10, 2026 foundation reset

The active application exposes password login, session lookup/logout, health/status, owner-only personal files and authenticated transcript-based study. Public setup, default passwords, demo login and public registration remain unavailable. School domain previews do not authorize real study access. Accounts are provisioned locally by an operator. Existing database records and migration history remain intact.

Retained controls: scrypt passwords, hashed session tokens, HttpOnly/SameSite cookies (Secure in production), explicit installation markers, database-backed login throttling, Origin and CSRF validation, request-size limits, owner-only file access, bounded quarantine capture, checksums and scanner checks. Public R2 buckets are prohibited. No scanner means only plain-text development uploads can complete; production requires ClamAV and private R2. No browser storage credential is exposed.

## Release blocker remains

The previously recorded [Next.js October security notice](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026) remains unresolved. The URL could not be fetched during this reset; the official blog search listing still describes an upcoming October 14 update. Do not treat the locked Next.js 16.4.0 release as cleared. Review affected versions and patched releases, regenerate the lockfile and verify the Bun runtime before changing the release gate.

The [Next.js advisory list](https://github.com/vercel/next.js/security/advisories), [FastAPI advisory list](https://github.com/fastapi/fastapi/security/advisories) and [Bun security page](https://github.com/oven-sh/bun/security) were checked again. This is not a comprehensive advisory applicability review. Automated audits and source review do not cover all container OS, runtime, configuration or unknown vulnerabilities. No advisories are suppressed.

Run `make check`, `make build`, `make audit`, and browser checks before release. Keep direct versions pinned and both lockfiles. CI retains a separate release-readiness gate, which intentionally fails while production approval is false.

Live R2 permissions/CORS/expiration, production privilege separation, container scans, remote recovery and new application acceptance remain unverified. Legacy media needs its own storage backup; the new file service and personal-media backup do not expose or enumerate old course attachments.

## Atlas Pearl frontend — October 10, 2026

The new public landing and `/preview/*` pages contain fictional kit data and local interactions only. Preview personas never authenticate against the API. Browser storage holds only theme preferences and sample workspace state; real session credentials remain in HttpOnly cookies. `/login`, `/files` and `/study` use the authenticated application API. Scenario and school-policy switches do not authorize backend access.

After adding Tailwind and shadcn/Radix, `make audit` checked 249 JavaScript packages and the Python lock export without reported vulnerabilities. The upstream [Tailwind](https://github.com/tailwindlabs/tailwindcss/security/advisories), [Radix](https://github.com/radix-ui/primitives/security/advisories) and [shadcn](https://github.com/shadcn-ui/ui/security/advisories) advisory pages showed no published advisories when reviewed. The Next.js advisory index was also rechecked. This does not resolve the existing release blocker or establish production readiness.

## Authenticated study — October 10, 2026

A real session is required for every `/api/v1/study/*` route. Mutations use the same
Origin/CSRF protections as personal files. Transcript owners can grant read/study
access to an explicitly named active account. Readers cannot grant access, retry
ingestion or delete somebody else's lesson. Conversation history belongs to its
creator, even when its lessons are shared. There is no role-derived access and no
public access to a library catalog.

The browser submits application lesson IDs, never raw RAG source IDs. The backend
checks ownership or an explicit grant and sends an exact source list on every hybrid
search. Empty selection never expands to all documents. Provider response scope and
every evidence source are verified; partial retrieval and invalid citations fail
closed. Source text/history are bounded and treated as untrusted model input. The
model has no executable tools and cannot grant permissions or change app state.
Prompting does not establish factual correctness; users can inspect literal citations.

Workers recheck session validity, active account, selected-source authorization,
run cancellation and job lease before generation and before committing an answer.
Revocation hides affected conversation history and citations on subsequent reads;
a result generated after revocation is discarded. Content already read or copied
by a recipient cannot be withdrawn. Cancellation prevents subsequent publication;
it does not guarantee cancellation of an already dispatched provider request or
refund its cost. Lost provider work is not automatically replayed.

Keys remain server-side. Neither provider raw errors nor RAG service credentials
are sent to the client. The RAG bearer key grants library-wide access: keep the
listener private and never distribute it to users, browser code or public MCP
clients. The local runner binds loopback. Gemini receives selected source text,
questions and bounded conversation context; institutional consent, provider data
terms and retention must be reviewed before real school deployment.

Deletion currently revokes application access but does not physically erase saved
transcripts, messages or RAG indexes. The upstream service has no deletion route.
A retention/erasure implementation and recovery rehearsal covering `.data/rag` are
production requirements. The default $1 RAG spend ledger excludes answer-model
charges; per-account daily request limits do not replace provider account budgets.

The vendored parser stack retains its own dependency lock and licenses; it must be
audited separately from `uv.lock`. [MinerU's license](../services/rag-anything/licenses/mineru-LICENSE.md)
requires attribution and has separate commercial-use conditions. Production approval
remains false. See [study operations and tests](STUDY.md).

## Vendored RAG dependency audit — October 10, 2026

A separate metadata-only audit of `services/rag-anything/requirements.lock` checked
142 package entries and returned **33 advisory records across four packages**
(21 distinct advisory IDs; the feed includes duplicates). This is a failing audit
and an additional production blocker; no findings were suppressed:

| Locked package | Findings and remediation status |
| --- | --- |
| `gradio==6.8.0` | Three distinct IDs covering session handling/cache/file access; published fixes include 6.15.0–6.16.0. |
| `lightrag-hku==1.4.16` | Seven distinct IDs covering its server/WebUI/authentication and parser behavior; published fixes include 1.5.4–1.5.5. The supplied RAG-Anything dependency constrains LightRAG below 1.5, so upgrading requires a compatibility change. |
| `starlette==0.52.1` | Five distinct IDs covering URL handling, endpoint dispatch, static files and form parsing; published fixes span 1.0.1–1.3.1. |
| `transformers==4.57.6` | Six distinct IDs covering unsafe model/checkpoint/loading or file-writing paths; some fixes require 5.x, and some records list no fix. |

The runner does not start Gradio or LightRAG's own API/WebUI; the current app accepts
plain transcripts rather than arbitrary model files. These facts narrow exposure
but are not a complete per-advisory applicability review. The parser dependency
chain and private service still need compatible upgrades, regression testing and
an explicit deployment review. Do not mark the vendored stack clean because the
application's separate `uv.lock` audit passes.

Reproduce without downloading/installing packages:

```sh
uv run --frozen pip-audit --disable-pip --no-deps \
  -r services/rag-anything/requirements.lock
```

The review also checked upstream
[PyMilvus security](https://github.com/milvus-io/pymilvus/security),
[MinerU advisories](https://github.com/opendatalab/MinerU/security/advisories) and
[RAG-Anything advisories](https://github.com/HKUDS/RAG-Anything/security/advisories).
The first two showed no published advisories; that does not clear their dependencies.
Reviewed primary examples include
[Starlette's form-parsing advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-82w8-qh3p-5jfq)
and [LightRAG's CORS advisory](https://github.com/HKUDS/LightRAG/security/advisories/GHSA-6x6h-qqr7-855w).
