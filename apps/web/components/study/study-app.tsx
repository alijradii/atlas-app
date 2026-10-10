"use client";

import { Button } from "@school2036/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  LoaderCircle,
  MessageSquare,
  Plus,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConnectedShell } from "../connected-shell";
import { Brand, PageHeading } from "../pearl";
import {
  PearlChatEmpty,
  PearlChatLayout,
  PearlChatMessage,
} from "../pearl-chat";
import { AssistantDock } from "../preview/assistant-dock";
import { Composer } from "../preview/composer";
import { Panel } from "../preview/shared";
import { consumeStudyDraft } from "./draft-handoff";
import { ImportLesson, LessonDialog } from "./lesson-dialog";
import {
  activeRun,
  type Citation,
  type Conversation,
  type Lesson,
  type Thread,
} from "./types";
import { useStudy } from "./use-study";
import "./study.css";

type Study = ReturnType<typeof useStudy>;
const maxConversationLessons = 8;
const questionBytes = (text: string) =>
  new TextEncoder().encode(text.trim()).length;
const lessonState = {
  queued: "Waiting to prepare",
  indexing: "Preparing sources",
  extracting: "Reading your material",
  review: "Review transcript",
  ready: "Ready to study",
  failed: "Preparation failed",
};
const runState = {
  queued: "Your question is queued",
  retrieving: "Finding passages in your lessons",
  answering: "Writing an answer from your sources",
  completed: "Answer ready",
  failed: "The response could not be completed",
  cancelled: "Response stopped",
};

export default function StudyApp({
  embedded = false,
  newConversation = false,
  initialLessonId,
}: {
  embedded?: boolean;
  newConversation?: boolean;
  initialLessonId?: string;
}) {
  const study = useStudy();
  const router = useRouter();
  const selectThread = study.selectThread;
  useEffect(() => {
    if (!newConversation) return;
    selectThread(null);
    router.replace("/study", { scroll: false });
  }, [newConversation, router, selectThread]);
  if (study.signedOut)
    return (
      <main id="main-content" className="study-gate">
        <Brand />
        <h1>Sign in to your study workspace</h1>
        <p>Your lessons and conversations are private to your account.</p>
        <Button asChild>
          <Link href="/login?next=study">Sign in</Link>
        </Button>
      </main>
    );
  if (study.loading && !study.session)
    return (
      <main id="main-content" className="study-gate">
        <Brand />
        <p role="status">Opening your study workspace…</p>
      </main>
    );
  if (!study.session)
    return (
      <main id="main-content" className="study-gate">
        <Brand />
        <h1>Your workspace is unavailable</h1>
        <p role="alert">{study.error || "We could not check your session."}</p>
        <Button onClick={study.refresh}>Try again</Button>
      </main>
    );
  return (
    <StudyWorkspace
      key={study.session.account_id}
      study={study}
      embedded={embedded}
      initialLessonId={initialLessonId}
    />
  );
}

function StudyWorkspace({
  study,
  embedded,
  initialLessonId,
}: {
  study: Study;
  embedded: boolean;
  initialLessonId?: string;
}) {
  const [pendingDraft, setPendingDraft] = useState("");
  const draftRead = useRef(false);
  useEffect(() => {
    if (draftRead.current || !study.session) return;
    draftRead.current = true;
    setPendingDraft(consumeStudyDraft(study.session.account_id));
  }, [study.session]);
  const [importing, setImporting] = useState(false);
  const [inspecting, setInspecting] = useState<{
    id: string;
    citation?: Citation;
  } | null>(null);
  const sourceRouter = useRouter();
  useEffect(() => {
    if (!initialLessonId) return;
    setInspecting({ id: initialLessonId });
    sourceRouter.replace("/study", { scroll: false });
  }, [initialLessonId, sourceRouter]);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "own" | "shared">("all");
  const ready = study.lessons.filter((lesson) => lesson.state === "ready");
  const selectedReady = selected.filter((id) =>
    ready.some((lesson) => lesson.id === id),
  );
  const lessons = study.lessons.filter(
    (lesson) =>
      filter === "all" || (filter === "own" ? lesson.owned : !lesson.owned),
  );
  const configured =
    study.status?.rag_configured && study.status.answer_configured;
  const openLesson = (lesson: Lesson) => {
    study.setError("");
    setInspecting({ id: lesson.id });
  };
  const start = async () => {
    if (!selectedReady.length || selectedReady.length > maxConversationLessons)
      return;
    const result = await study.mutate<Conversation>(
      "/study/conversations",
      "POST",
      { lesson_ids: selectedReady },
    );
    if (result.ok && result.value) study.selectThread(result.value.id);
  };
  const tools = (
    <Panel className="study-sidebar" title="Your learning space">
      <div className="study-sidebar-intro">
        <p className="eyebrow">{study.session?.name}</p>
        <p>
          Choose the lessons you want to work with. Every answer can lead back
          to its source.
        </p>
      </div>
      <section className="study-library" aria-labelledby="study-library-title">
        <div className="study-section-heading">
          <h2 id="study-library-title">Lesson library</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              study.setError("");
              setImporting(true);
            }}
          >
            <Plus />
            Add lesson
          </Button>
        </div>
        <fieldset className="study-library-filters" aria-label="Filter lessons">
          {(["all", "own", "shared"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : value === "own"
                  ? "Your lessons"
                  : "Shared with you"}
            </button>
          ))}
        </fieldset>
        <p className="study-small">
          {selectedReady.length === maxConversationLessons
            ? "8 of 8 lessons selected. Uncheck one to choose another."
            : "Select up to 8 ready lessons for a new conversation."}
        </p>
        <div className="study-lesson-list">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`study-lesson-row ${selectedReady.includes(lesson.id) ? "selected" : ""}`}
            >
              <label className="study-lesson-select">
                <input
                  type="checkbox"
                  aria-label={`Use ${lesson.title}`}
                  disabled={
                    lesson.state !== "ready" ||
                    (selectedReady.length >= maxConversationLessons &&
                      !selectedReady.includes(lesson.id))
                  }
                  checked={selectedReady.includes(lesson.id)}
                  onChange={(event) =>
                    setSelected((ids) =>
                      event.target.checked
                        ? [
                            ...new Set([
                              ...ids.filter((id) =>
                                ready.some((item) => item.id === id),
                              ),
                              lesson.id,
                            ]),
                          ].slice(0, maxConversationLessons)
                        : ids.filter((id) => id !== lesson.id),
                    )
                  }
                />
                <span>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.owned ? "Your lesson" : "Shared with you"}
                    {lesson.subject ? ` · ${lesson.subject}` : ""}
                  </small>
                  <span className={`study-lesson-state ${lesson.state}`}>
                    <span aria-hidden="true">
                      {lesson.state === "ready" ? (
                        <Check />
                      ) : lesson.state === "failed" ? (
                        <X />
                      ) : (
                        <LoaderCircle className="study-spinner" />
                      )}
                    </span>
                    {lessonState[lesson.state]}
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="study-icon-button"
                aria-label={`Open ${lesson.title}`}
                onClick={() => openLesson(lesson)}
              >
                <ChevronRight />
              </button>
              {lesson.state === "failed" && (
                <div className="study-lesson-failure">
                  <p>
                    {lesson.error || "We could not prepare this transcript."}
                  </p>
                  {lesson.owned && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={study.busy}
                      onClick={() =>
                        void study.mutate(`/study/lessons/${lesson.id}/retry`)
                      }
                    >
                      Retry preparation
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {!lessons.length && (
            <div className="study-library-empty">
              <BookOpen />
              <p>
                {filter === "shared"
                  ? "Lessons shared with your account will appear here."
                  : filter === "own"
                    ? "You haven’t added a lesson yet."
                    : "Add your first transcript to begin."}
              </p>
            </div>
          )}
        </div>
        <Button
          className="study-new-chat"
          disabled={study.busy || !selectedReady.length}
          onClick={() => void start()}
        >
          <Plus />
          New conversation
          {selectedReady.length
            ? ` · ${selectedReady.length} lesson${selectedReady.length === 1 ? "" : "s"}`
            : ""}
        </Button>
      </section>
      <section className="study-history" aria-labelledby="study-history-title">
        <div className="study-section-heading">
          <h2 id="study-history-title">Conversations</h2>
          <button
            type="button"
            className="study-icon-button"
            aria-label="Back to study overview"
            onClick={() => study.selectThread(null)}
          >
            <BookOpen />
          </button>
        </div>
        {!study.conversations.length && (
          <p className="study-small">
            Your saved conversations will appear here.
          </p>
        )}
        {study.conversations.map((conversation) => (
          <div key={conversation.id} className="study-history-row">
            <button
              type="button"
              aria-current={
                study.selectedId === conversation.id ? "page" : undefined
              }
              onClick={() => {
                setDeleting(null);
                study.selectThread(conversation.id);
              }}
            >
              <MessageSquare />
              <span>{conversation.title || "New conversation"}</span>
            </button>
            <button
              type="button"
              className="study-icon-button"
              aria-label={`Delete conversation ${conversation.title || "New conversation"}`}
              onClick={() => setDeleting(conversation.id)}
            >
              <Trash2 />
            </button>
            {deleting === conversation.id && (
              <div className="study-history-confirm">
                <p>Delete this conversation?</p>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={study.busy}
                  onClick={async () => {
                    const result = await study.mutate(
                      `/study/conversations/${conversation.id}`,
                      "DELETE",
                    );
                    if (result.ok) {
                      setDeleting(null);
                      if (study.selectedId === conversation.id)
                        study.selectThread(null);
                    }
                  }}
                >
                  Delete conversation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(null)}
                >
                  Keep
                </Button>
              </div>
            )}
          </div>
        ))}
      </section>
    </Panel>
  );
  const content = (
    <div className="study-app study-app-embedded">
      <PageHeading
        title="Study with your agent"
        description="A little direction when you need it. Space to think for yourself."
      />
      <PearlChatLayout className="study-layout" tools={tools}>
        <section className="study-main" aria-label="Study workspace">
          {study.error && (
            <div className="study-error-banner" role="alert">
              <p>{study.error}</p>
              <Button size="sm" variant="outline" onClick={study.refresh}>
                Reload workspace
              </Button>
              <button
                type="button"
                aria-label="Dismiss error"
                className="study-icon-button"
                onClick={() => study.setError("")}
              >
                <X />
              </button>
            </div>
          )}
          {study.status && !configured && (
            <div className="study-service-notice">
              <p>
                <strong>Study responses aren’t connected yet.</strong>{" "}
                {!study.status.rag_configured
                  ? "The lesson retrieval service needs to be configured."
                  : "The answer service needs to be configured."}{" "}
                Your saved lessons and conversations remain available.
              </p>
            </div>
          )}
          {study.selectedId ? (
            <ConversationPane
              key={study.selectedId}
              study={study}
              thread={study.thread}
              initialDraft={pendingDraft}
              onDraftConsumed={() => setPendingDraft("")}
              configured={Boolean(configured)}
              onCitation={(citation) =>
                setInspecting({ id: citation.lesson_id, citation })
              }
              onLesson={(id) => setInspecting({ id })}
            />
          ) : (
            <PearlChatEmpty description="Choose the lessons you want to work through, or add a document or recording. We’ll take it one step at a time.">
              {pendingDraft && (
                <div className="study-draft-notice">
                  <strong>Your question is ready</strong>
                  <p>{pendingDraft}</p>
                  <span>
                    Choose ready lessons, then start a conversation to review
                    and send it.
                  </span>
                  <button type="button" onClick={() => setPendingDraft("")}>
                    Discard question
                  </button>
                </div>
              )}
              <div className="study-welcome-actions">
                <Button asChild>
                  <Link href="/files">
                    <Upload />
                    Upload documents or recordings
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setImporting(true)}>
                  <FileText />
                  Add a transcript
                </Button>
                {selectedReady.length > 0 && (
                  <Button
                    variant="outline"
                    disabled={study.busy}
                    onClick={() => void start()}
                  >
                    Study selected lessons
                    <ArrowRight />
                  </Button>
                )}
              </div>
            </PearlChatEmpty>
          )}
        </section>
      </PearlChatLayout>
      <ImportLesson
        open={importing}
        onClose={() => setImporting(false)}
        mutate={study.mutate}
        busy={study.busy}
        apiError={study.error}
      />
      {inspecting && study.session && (
        <LessonDialog
          key={`${inspecting.id}-${inspecting.citation?.index ?? "lesson"}`}
          id={inspecting.id}
          citation={inspecting.citation}
          session={study.session}
          mutate={study.mutate}
          busy={study.busy}
          onClose={() => setInspecting(null)}
          onExpired={study.expire}
          onError={study.setError}
          apiError={study.error}
        />
      )}
    </div>
  );
  return embedded || !study.session ? (
    content
  ) : (
    <ConnectedShell
      session={study.session}
      section="study"
      onSignOut={() => void study.signOut()}
    >
      {content}
    </ConnectedShell>
  );
}

function ConversationPane({
  study,
  thread,
  configured,
  initialDraft,
  onDraftConsumed,
  onCitation,
  onLesson,
}: {
  study: Study;
  thread: Thread | null;
  configured: boolean;
  initialDraft: string;
  onDraftConsumed: () => void;
  onCitation: (citation: Citation) => void;
  onLesson: (id: string) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => {
    if (initialDraft) onDraftConsumed();
  }, [initialDraft, onDraftConsumed]);
  const questionTooLong = questionBytes(draft) > 2000;
  const attempt = useRef<{ content: string; id: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const running = activeRun(thread?.run);
  const contentVersion = `${thread?.messages.map((message) => message.id).join("-")}-${thread?.run?.state}`;
  useEffect(() => {
    if (contentVersion && nearEnd.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [contentVersion]);
  async function send(content: string, retry = false) {
    if (
      !thread ||
      !content.trim() ||
      questionBytes(content) > 2000 ||
      running ||
      !configured ||
      study.busy
    )
      return;
    if (retry || attempt.current?.content !== content.trim())
      attempt.current = { content: content.trim(), id: crypto.randomUUID() };
    const result = await study.mutate(
      `/study/conversations/${thread.id}/messages`,
      "POST",
      { content: content.trim(), request_id: attempt.current?.id },
    );
    if (result.ok) {
      setDraft("");
      attempt.current = null;
      nearEnd.current = true;
    }
  }
  if (!thread)
    return (
      <div className="study-conversation-loading" role="status">
        Opening your conversation…
      </div>
    );
  const lastQuestion = [...thread.messages]
    .reverse()
    .find((message) => message.role === "user");
  return (
    <section className="study-conversation" aria-label="Study conversation">
      <header className="study-conversation-header">
        <p className="eyebrow">Saved to your account</p>
        <h2>{thread.title || "New conversation"}</h2>
        <section
          className="study-source-chips"
          aria-label="Conversation lessons"
        >
          {thread.lesson_ids.map((id) => (
            <button type="button" key={id} onClick={() => onLesson(id)}>
              <BookOpen />
              {study.lessons.find((lesson) => lesson.id === id)?.title ||
                "Lesson source"}
            </button>
          ))}
        </section>
      </header>
      <div
        className="study-messages"
        ref={scroll}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearEnd.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            90;
        }}
      >
        {!thread.messages.length && <PearlChatEmpty />}

        <div
          className="space-y-6"
          role="log"
          aria-label="Study messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {thread.messages.map((message) => (
            <PearlChatMessage
              key={message.id}
              className={`study-message-${message.role}`}
              role={message.role}
              text={message.content}
            >
              {message.citations?.length > 0 && (
                <section
                  className="study-citations"
                  aria-label="Answer sources"
                >
                  {message.citations.map((citation) => (
                    <button
                      type="button"
                      key={`${citation.index}-${citation.lesson_id}`}
                      onClick={() => onCitation(citation)}
                    >
                      <span>{citation.index}</span>
                      <span>
                        {citation.title}
                        <small>
                          {citation.location || "Transcript passage"}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </section>
              )}
            </PearlChatMessage>
          ))}
        </div>
        {thread.run &&
          (running || ["failed", "cancelled"].includes(thread.run.state)) && (
            <div className="study-run-status" role="status">
              {running && (
                <span className="study-thinking" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <p>
                {runState[thread.run.state]}
                {thread.run.error && <small>{thread.run.error}</small>}
              </p>
              {!running && lastQuestion && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={study.busy || !configured}
                  onClick={() => void send(lastQuestion.content, true)}
                >
                  Try response again
                </Button>
              )}
            </div>
          )}
      </div>
      <fieldset className="atlas-chat-suggestions">
        <legend className="sr-only">Suggested questions</legend>
        {[
          ["Explain the key ideas", "Explain the key ideas in these lessons."],
          [
            "Walk me through an example",
            "Walk me through an example from these lessons, one step at a time.",
          ],
          [
            "Ask me a practice question",
            "Ask me a practice question based on these lessons. Let me try before showing the answer.",
          ],
        ].map(([label, question]) => (
          <Button
            type="button"
            key={label}
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(question);
              const launcher =
                composer.current?.querySelector<HTMLButtonElement>(
                  ".atlas-dock-launcher",
                );
              if (launcher?.getAttribute("aria-expanded") === "false")
                launcher.click();
              else composer.current?.querySelector("textarea")?.focus();
            }}
          >
            {label}
          </Button>
        ))}
      </fieldset>
      <div className="study-composer-slot" ref={composer}>
        {questionTooLong && (
          <p
            className="study-input-hint"
            id="study-question-length"
            role="status"
          >
            This question is too long. Shorten it before sending.
          </p>
        )}
        <AssistantDock>
          {(minimize) => (
            <Composer
              inline
              value={draft}
              onChange={setDraft}
              onSubmit={(text) => void send(text)}
              label="Ask about your lessons"
              sendLabel="Send study message"
              disabled={!configured}
              sendDisabled={study.busy || running || questionTooLong}
              inputInvalid={questionTooLong}
              inputDescription={
                questionTooLong ? "study-question-length" : undefined
              }
              placeholder={
                configured
                  ? "Ask about your selected lessons…"
                  : "Responses will be available when the services are connected"
              }
              hint="Check the sources. AI explanations can make mistakes."
              moreOptions={[
                { label: "Upload documents or recordings", href: "/files" },
              ]}
              onMinimize={minimize}
              action={
                running ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={study.busy}
                    onClick={() =>
                      void study.mutate(
                        `/study/conversations/${thread.id}/cancel`,
                      )
                    }
                  >
                    <Square /> Stop response
                  </Button>
                ) : undefined
              }
            />
          )}
        </AssistantDock>
      </div>
    </section>
  );
}
