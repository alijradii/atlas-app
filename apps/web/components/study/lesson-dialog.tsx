"use client";

import { ApiError, api } from "@school2036/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@school2036/ui";
import { BookOpen, Check, FileText, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Access, Citation, Lesson, LessonDetail, Session } from "./types";

export type Mutate = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<{ ok: boolean; value?: T }>;

export function ImportLesson({
  open,
  onClose,
  mutate,
  busy,
  apiError,
}: {
  open: boolean;
  onClose: () => void;
  mutate: Mutate;
  busy: boolean;
  apiError: string;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fileError, setFileError] = useState("");
  const fileRead = useRef(0);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (!open) {
      ++fileRead.current;
      setReading(false);
    }
    return () => {
      ++fileRead.current;
    };
  }, [open]);
  const transcriptLength = Array.from(transcript.trim()).length;
  const validTranscript =
    transcriptLength >= 30 &&
    transcriptLength <= 45000 &&
    !transcript.includes("\u0000");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="study-modal">
        <DialogHeader>
          <DialogTitle>Add a lesson transcript</DialogTitle>
          <DialogDescription>
            Paste the words from your lesson or choose a text file. The
            transcript stays private until you share it.
          </DialogDescription>
        </DialogHeader>
        {apiError && (
          <p role="alert" className="study-error">
            {apiError}
          </p>
        )}
        <Button asChild variant="outline">
          <Link href="/files">Upload a document or recording</Link>
        </Button>
        <form
          className="study-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || reading || !title.trim() || !validTranscript) return;
            const result = await mutate<Lesson>("/study/lessons", "POST", {
              title: title.trim(),
              subject: subject.trim(),
              transcript: transcript.trim(),
            });
            if (result.ok) {
              setTitle("");
              setSubject("");
              setTranscript("");
              setFileError("");
              onClose();
            }
          }}
        >
          <div>
            <Label htmlFor="study-title">Lesson title</Label>
            <Input
              id="study-title"
              disabled={busy}
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Newton’s second law"
            />
          </div>
          <div>
            <Label htmlFor="study-subject">Subject (optional)</Label>
            <Input
              id="study-subject"
              disabled={busy}
              maxLength={80}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Physics"
            />
          </div>
          <div>
            <Label htmlFor="study-text-file">
              Import a text file (optional)
            </Label>
            <Input
              id="study-text-file"
              disabled={busy}
              type="file"
              accept="text/plain,.txt,.md,.vtt,.srt"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const version = ++fileRead.current;
                setReading(false);
                setFileError("");
                if (file.size > 180000) {
                  setFileError(
                    "Choose a text file with at most 45,000 characters.",
                  );
                  return;
                }
                setReading(true);
                try {
                  const bytes = await file.arrayBuffer();
                  if (version !== fileRead.current) return;
                  const text = new TextDecoder("utf-8", { fatal: true }).decode(
                    bytes,
                  );
                  if (
                    Array.from(text.trim()).length > 45000 ||
                    text.includes("\u0000")
                  ) {
                    setFileError(
                      "Choose a readable text transcript with at most 45,000 characters.",
                    );
                    return;
                  }
                  setTranscript(text);
                  setTitle(
                    (value) =>
                      value || file.name.replace(/\.[^.]+$/, "").slice(0, 160),
                  );
                } catch {
                  if (version === fileRead.current)
                    setFileError(
                      "This file could not be read as UTF-8 text. Paste the transcript below instead.",
                    );
                } finally {
                  if (version === fileRead.current) setReading(false);
                }
              }}
            />
          </div>
          {reading && <p role="status">Reading your text file…</p>}
          {fileError && (
            <p role="alert" className="study-error">
              {fileError}
            </p>
          )}
          <div>
            <Label htmlFor="study-transcript">Transcript</Label>
            <Textarea
              id="study-transcript"
              disabled={busy}
              required
              maxLength={90000}
              aria-describedby="study-transcript-length"
              rows={9}
              value={transcript}
              onChange={(event) => {
                ++fileRead.current;
                setReading(false);
                setTranscript(event.target.value);
              }}
              placeholder="Paste the lesson transcript here…"
            />
            <small>
              {transcriptLength.toLocaleString()} / 45,000 characters
            </small>
            <p className="study-input-hint" id="study-transcript-length">
              {transcriptLength < 30
                ? "Add at least 30 characters of lesson content."
                : transcriptLength > 45000
                  ? "Use at most 45,000 characters of lesson content."
                  : transcript.includes("\u0000")
                    ? "Use readable text without null characters."
                    : "Only this transcript will be added to your library."}
            </p>
          </div>
          <div className="study-form-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || reading || !title.trim() || !validTranscript}
            >
              <FileText />
              {busy ? "Saving…" : "Add transcript"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LessonDialog({
  id,
  citation,
  session,
  mutate,
  busy,
  onClose,
  onExpired,
  onError,
  apiError,
}: {
  id: string;
  citation?: Citation;
  session: Session;
  mutate: Mutate;
  busy: boolean;
  onClose: () => void;
  onExpired: () => void;
  onError: (text: string) => void;
  apiError: string;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [draft, setDraft] = useState("");
  // Keep unsaved corrections in memory only while rechecking access. Never show
  // them again until the same owned review source has been reauthorized.
  const reviewDraft = useRef<{ id: string; text: string } | null>(null);
  const [access, setAccess] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [login, setLogin] = useState("");
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(!citation);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately reloads access after a share/revoke or retry.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setLesson(null);
    setDraft("");
    setAccess([]);
    void (async () => {
      try {
        const detail = await api<LessonDetail>(
          `/study/lessons/${encodeURIComponent(id)}`,
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        const grants = detail.owned
          ? await api<Access[]>(
              `/study/lessons/${encodeURIComponent(id)}/access`,
              "GET",
              undefined,
              undefined,
              controller.signal,
            )
          : [];
        if (!controller.signal.aborted) {
          setLesson(detail);
          setDraft(
            detail.owned &&
              detail.state === "review" &&
              reviewDraft.current?.id === id
              ? reviewDraft.current.text
              : detail.transcript,
          );
          setAccess(grants);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          reviewDraft.current = null;
        if (cause instanceof ApiError && cause.status === 401) onExpired();
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "This source could not be loaded.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    const revisit = () => {
      controller.abort();
      setLesson(null);
      setDraft("");
      setAccess([]);
      setLoading(true);
      if (document.visibilityState !== "hidden")
        setRevision((value) => value + 1);
    };
    document.addEventListener("visibilitychange", revisit);
    window.addEventListener("focus", revisit);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", revisit);
      window.removeEventListener("focus", revisit);
    };
  }, [id, revision, onExpired]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="study-modal">
        <DialogHeader>
          <DialogTitle>{lesson?.title || "Lesson source"}</DialogTitle>
          <DialogDescription>
            {lesson
              ? `${lesson.subject || "Transcript"} · ${lesson.owned ? "Owned by you" : "Shared with you"}`
              : "Checking your access to this source…"}
          </DialogDescription>
        </DialogHeader>
        {apiError && (
          <p role="alert" className="study-error">
            {apiError}
          </p>
        )}
        {loading && <p role="status">Opening transcript…</p>}
        {error && (
          <div role="alert" className="study-error">
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try source again
            </Button>
          </div>
        )}
        {lesson && (
          <div className="study-source-body">
            {citation && (
              <section className="study-citation-quote">
                <p className="eyebrow">
                  Source {citation.index} ·{" "}
                  {citation.location || "Lesson transcript"}
                </p>
                <blockquote>{citation.quote}</blockquote>
                <Button
                  variant="outline"
                  onClick={() => setShowTranscript((value) => !value)}
                >
                  <BookOpen />
                  {showTranscript
                    ? "Hide full transcript"
                    : "Read full transcript"}
                </Button>
              </section>
            )}
            {lesson.has_file && (
              <Button asChild variant="outline">
                <a
                  href={`/api/v1/study/lessons/${encodeURIComponent(id)}/file`}
                >
                  Download original material
                </a>
              </Button>
            )}
            {lesson.owned && lesson.state === "review" && (
              <form
                className="study-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await mutate(
                    `/study/lessons/${encodeURIComponent(id)}/approve`,
                    "POST",
                    { transcript: draft.trim() },
                  );
                  if (result.ok) onClose();
                }}
              >
                <Label htmlFor="review-transcript">
                  Review the extracted transcript
                </Label>
                <p className="study-input-hint">
                  Check the words and correct any mistakes before using them as
                  study sources. Recording timestamps are approximate.
                </p>
                <Textarea
                  id="review-transcript"
                  disabled={busy}
                  rows={12}
                  value={draft}
                  onChange={(event) => {
                    const text = event.target.value;
                    reviewDraft.current = { id, text };
                    setDraft(text);
                  }}
                  maxLength={90000}
                />
                <small>
                  {Array.from(draft.trim()).length.toLocaleString()} / 45,000
                  characters
                </small>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    Array.from(draft.trim()).length < 30 ||
                    Array.from(draft.trim()).length > 45000 ||
                    draft.includes("\u0000")
                  }
                >
                  <Check />
                  Approve and prepare lesson
                </Button>
              </form>
            )}
            {showTranscript && lesson.state !== "review" && (
              <section
                aria-label="Full transcript"
                className="study-transcript-text"
              >
                {lesson.transcript}
              </section>
            )}
            {lesson.owned && (
              <section className="study-access" aria-label="Lesson sharing">
                <h3>Who can study this lesson?</h3>
                <p>
                  Direct sharing gives access to this transcript and its
                  original file, not your conversations. Published classroom
                  access is managed in Workspace.
                </p>
                {access.map((person) => (
                  <div className="study-access-person" key={person.account_id}>
                    <span>
                      {person.name}
                      <small>{person.login}</small>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove access for ${person.login}`}
                      disabled={busy}
                      onClick={async () => {
                        const result = await mutate(
                          `/study/lessons/${encodeURIComponent(id)}/access/${person.account_id}`,
                          "DELETE",
                        );
                        if (result.ok) setRevision((value) => value + 1);
                      }}
                    >
                      <X />
                      Remove
                    </Button>
                  </div>
                ))}
                <form
                  className="study-share-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      login.trim().toLowerCase() === session.login.toLowerCase()
                    ) {
                      onError("This is already your lesson.");
                      return;
                    }
                    const result = await mutate(
                      `/study/lessons/${encodeURIComponent(id)}/access`,
                      "POST",
                      { login: login.trim() },
                    );
                    if (result.ok) {
                      setLogin("");
                      setRevision((value) => value + 1);
                    }
                  }}
                >
                  <div>
                    <Label htmlFor="study-share-login">
                      Share with an account login
                    </Label>
                    <Input
                      id="study-share-login"
                      required
                      maxLength={100}
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      placeholder="Their login"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={busy || !login.trim()}
                  >
                    <UserPlus />
                    Share lesson
                  </Button>
                </form>
                <div className="study-delete-zone">
                  {deleting ? (
                    <>
                      <p>Delete this lesson and remove access to its source?</p>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          const result = await mutate(
                            `/study/lessons/${encodeURIComponent(id)}`,
                            "DELETE",
                          );
                          if (result.ok) onClose();
                        }}
                      >
                        <Check />
                        Delete lesson
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDeleting(false)}
                      >
                        Keep lesson
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setDeleting(true)}>
                      <Trash2 />
                      Delete lesson
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
