"use client";

import { Button } from "@school2036/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Brand } from "../pearl";
import { RichMessage } from "../preview/rich-message";
import { TaskArt } from "../preview/task-art";
import { ThemeToggle } from "../theme-toggle";
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

export default function StudyApp() {
  const study = useStudy();
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
  return <StudyWorkspace key={study.session.account_id} study={study} />;
}

function StudyWorkspace({ study }: { study: Study }) {
  const [importing, setImporting] = useState(false);
  const [inspecting, setInspecting] = useState<{
    id: string;
    citation?: Citation;
  } | null>(null);
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
  return (
    <div className="study-app">
      <header className="study-header">
        <Brand />
        <span className="study-header-title">Your study workspace</span>
        <nav aria-label="Account">
          <Link href="/files">Your files</Link>
          <ThemeToggle />
          <Button
            size="sm"
            variant="ghost"
            aria-label="Sign out"
            disabled={study.busy}
            onClick={() => void study.signOut()}
          >
            <LogOut />
            <span>Sign out</span>
          </Button>
        </nav>
      </header>
      <div className="study-layout">
        <aside className="study-sidebar" aria-label="Lessons and conversations">
          <div className="study-sidebar-intro">
            <p className="eyebrow">{study.session?.name}</p>
            <h2>Your learning space</h2>
            <p>
              Choose the lessons you want to work with. Every answer can lead
              back to its source.
            </p>
          </div>
          <section
            className="study-library"
            aria-labelledby="study-library-title"
          >
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
            <fieldset
              className="study-library-filters"
              aria-label="Filter lessons"
            >
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
                        {lesson.error ||
                          "We could not prepare this transcript."}
                      </p>
                      {lesson.owned && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={study.busy}
                          onClick={() =>
                            void study.mutate(
                              `/study/lessons/${lesson.id}/retry`,
                            )
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
          <section
            className="study-history"
            aria-labelledby="study-history-title"
          >
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
        </aside>
        <main id="main-content" className="study-main">
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
              configured={Boolean(configured)}
              onCitation={(citation) =>
                setInspecting({ id: citation.lesson_id, citation })
              }
              onLesson={(id) => setInspecting({ id })}
            />
          ) : (
            <div className="study-welcome">
              <div className="study-welcome-art">
                <TaskArt kind="lesson" />
              </div>
              <p className="eyebrow">Your lessons, with a little direction</p>
              <h1>Make room for understanding.</h1>
              <p>
                Bring a transcript, choose your lessons and ask a question.
                Explore an explanation, then open its sources to see where it
                came from.
              </p>
              <div className="study-welcome-actions">
                <Button onClick={() => setImporting(true)}>
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
              <div className="study-welcome-principles">
                <span>
                  <BookOpen />
                  Answers grounded in your selected lessons
                </span>
                <span>
                  <Users />
                  Sharing is your choice
                </span>
                <span>
                  <MessageSquare />
                  Conversations saved to your account
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
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
}

function ConversationPane({
  study,
  thread,
  configured,
  onCitation,
  onLesson,
}: {
  study: Study;
  thread: Thread | null;
  configured: boolean;
  onCitation: (citation: Citation) => void;
  onLesson: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const questionTooLong = questionBytes(draft) > 2000;
  const attempt = useRef<{ content: string; id: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
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
        <h1>{thread.title || "New conversation"}</h1>
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
        {!thread.messages.length && (
          <div className="study-chat-empty">
            <TaskArt kind="cards" />
            <h2>What would you like to understand?</h2>
            <p>
              Ask about a concept, compare ideas or work through an example from
              your selected lessons.
            </p>
            <fieldset className="study-starters">
              <legend className="sr-only">Suggested questions</legend>
              {[
                [
                  "Explain the key ideas",
                  "Explain the key ideas in these lessons.",
                ],
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
                    composer.current?.focus();
                  }}
                >
                  {label}
                </Button>
              ))}
            </fieldset>
          </div>
        )}
        <div
          role="log"
          aria-label="Study messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {thread.messages.map((message) => (
            <article
              key={message.id}
              className={`study-message study-message-${message.role}`}
            >
              <p className="study-message-author">
                {message.role === "user" ? "You" : "Atlas"}
              </p>
              {message.role === "assistant" ? (
                <RichMessage text={message.content} />
              ) : (
                <p className="study-user-text">{message.content}</p>
              )}
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
            </article>
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
      <form
        className="study-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="study-message">
          Ask about your lessons
        </label>
        <textarea
          ref={composer}
          aria-invalid={questionTooLong || undefined}
          aria-describedby={
            questionTooLong ? "study-question-length" : undefined
          }
          id="study-message"
          rows={2}
          maxLength={2000}
          value={draft}
          disabled={!configured}
          placeholder={
            configured
              ? "Ask about your selected lessons…"
              : "Responses will be available when the services are connected"
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        {questionTooLong && (
          <p
            className="study-input-hint"
            id="study-question-length"
            role="status"
          >
            This question is too long. Shorten it before sending.
          </p>
        )}
        <div className="study-composer-footer">
          <span>Check the sources. AI explanations can make mistakes.</span>
          {running ? (
            <Button
              type="button"
              variant="outline"
              disabled={study.busy}
              onClick={() =>
                void study.mutate(`/study/conversations/${thread.id}/cancel`)
              }
            >
              <Square />
              Stop response
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={
                study.busy || !configured || !draft.trim() || questionTooLong
              }
              aria-label="Send study message"
            >
              <Send />
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
