"use client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from "@school2036/ui";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Pin,
  Play,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeading, PearlScene } from "../pearl";
import { type AccountId, duration, fixture, subjectName } from "./data";
import { Empty, Notice, Panel, Restricted, Status } from "./shared";
import { usePreview } from "./state";

export function Lessons({ accountId }: { accountId: AccountId }) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const teacher = accountId === "daher";
  const { state } = usePreview();
  if (!state.school && !state.settings.recHome && !teacher)
    return (
      <>
        <PageHeading title="Lessons" />
        <Restricted title="Recordings are available at school" />
      </>
    );
  const lessons = fixture.lessons.filter(
    (l) =>
      (teacher ? l.by === "Mr. Elie Daher" : l.grades.includes(10)) &&
      (subject === "all" || l.subj === subject) &&
      `${l.title} ${l.unit}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={teacher ? "My lessons" : "Lessons"}
        description="Recorded by your teachers. Revisit a chapter, pause, and make time to understand."
      >
        {teacher && (
          <Button asChild>
            <Link href={`/preview/${accountId}/upload`}>Upload a session</Link>
          </Button>
        )}
      </PageHeading>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search lessons"
            placeholder="Search lessons or units"
            className="pl-10"
          />
        </div>
        <select
          aria-label="Filter lessons by subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11 rounded-xl border border-input bg-surface px-4"
        >
          <option value="all">All subjects</option>
          {["physics", "math", "cs", "english"].map((s) => (
            <option key={s} value={s}>
              {subjectName(s)}
            </option>
          ))}
        </select>
      </div>
      {!lessons.length ? (
        <Empty
          title="No lessons found"
          text="Try another subject or search term."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.map((l) => (
            <Link
              key={l.id}
              href={`/preview/${accountId}/lesson/${l.id}`}
              className="glass-panel group overflow-hidden"
            >
              <div className="relative">
                <PearlScene className="min-h-44" compact />
                <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs text-white">
                  {duration(l.dur)}
                </span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface/90 transition-transform group-hover:scale-110">
                    <Play className="size-4" />
                  </span>
                </span>
              </div>
              <div className="space-y-3 p-5">
                <p className="eyebrow">{subjectName(l.subj)}</p>
                <h2 className="text-xl leading-snug">{l.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {l.unit}
                  <br />
                  {l.by}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {teacher && state.lessonDrafts.length > 0 && (
        <Panel title="Preview drafts">
          {state.lessonDrafts.map((l) => (
            <div
              key={l.title}
              className="flex flex-wrap justify-between gap-3 border-b py-3"
            >
              <span>
                {l.title}
                <small className="block text-muted-foreground">
                  {l.filename} · {l.audience}
                </small>
              </span>
              <Status>Draft only</Status>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

export function Lesson({
  accountId,
  id,
}: {
  accountId: AccountId;
  id: string;
}) {
  const { state, setState } = usePreview();
  const [chapter, setChapter] = useState(0);
  const lesson = fixture.lessons.find((l) => l.id === id);
  if (!state.school && !state.settings.recHome && accountId !== "daher")
    return <Restricted title="Recordings are available at school" />;
  if (!lesson)
    return (
      <Empty
        title="Lesson not found"
        text="Return to the lesson library to choose another recording."
      />
    );
  return (
    <>
      <Link
        href={`/preview/${accountId}/lessons`}
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        All lessons
      </Link>
      <PageHeading
        eyebrow={lesson.unit}
        title={lesson.title}
        description={`${lesson.by} · ${duration(lesson.dur)} · ${subjectName(lesson.subj)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl">
            <PearlScene className="min-h-[350px]" />
            <div className="absolute inset-x-4 bottom-4 rounded-xl bg-surface/95 p-5 backdrop-blur-sm">
              <p className="eyebrow mb-2">
                {state.video ? "Lesson player preview" : "Playback unavailable"}
              </p>
              <h2 className="text-xl">
                {state.video
                  ? lesson.chapters[chapter][1]
                  : "Try again when the video service is available."}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.video
                  ? "Explore the chapter navigation. A video recording is not attached to this design preview."
                  : "You can still read the chapter list and return to your other work."}
              </p>
            </div>
          </div>
          <Panel title="What this lesson covers">
            <div className="flex flex-wrap gap-2">
              {lesson.covers.map((c) => (
                <Status key={c}>{c}</Status>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/preview/${accountId}/study`}>
                  Study this lesson <ArrowRight />
                </Link>
              </Button>
              <Button
                variant="outline"
                aria-pressed={state.pinned}
                onClick={() => setState((s) => ({ ...s, pinned: !s.pinned }))}
              >
                <Pin />
                {state.pinned ? "Remove shortcut" : "Pin to my home"}
              </Button>
            </div>
          </Panel>
        </div>
        <Panel title="Chapters">
          <div className="grid gap-2">
            {lesson.chapters.map(([time, title], i) => (
              <button
                type="button"
                key={title}
                className="flex items-center gap-3 rounded-xl border p-4 text-left aria-pressed:border-cobalt aria-pressed:bg-accent"
                aria-pressed={chapter === i}
                onClick={() => setChapter(i)}
              >
                <span className="text-xs text-cobalt">
                  {duration(Number(time))}
                </span>
                {title}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

export function Practice({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const [open, setOpen] = useState(false);
  const fresh = accountId === "sami";
  const answers = fresh ? state.samiAnswers : state.answers;
  const stuck = fresh ? state.samiStuck : state.stuck;
  const batch = fresh ? state.samiBatch : state.batch;
  const ready = answers.filter((a, i) => a.trim() || stuck[i]).length;
  const setAnswer = (i: number, value: string) =>
    setState((s) => ({
      ...s,
      [fresh ? "samiAnswers" : "answers"]: answers.map((v, k) =>
        k === i ? value : v,
      ),
    }));
  const toggleStuck = (i: number) =>
    setState((s) => ({
      ...s,
      [fresh ? "samiStuck" : "stuck"]: stuck.map((v, k) => (k === i ? !v : v)),
    }));
  const correct = (i: number) =>
    !stuck[i] &&
    answers[i].trim() !== "" &&
    Number.isFinite(Number(answers[i])) &&
    Math.abs(Number(answers[i]) - fixture.batch[i].ans) <= fixture.batch[i].tol;
  return (
    <>
      <PageHeading
        title="Practice batch"
        eyebrow="Newton’s second law"
        description="Five problems, done on your own. Feedback comes after you submit the whole set."
      />
      {batch === "none" ? (
        <Panel title="How it works">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Tutor pauses", "No hints or checks during the sample batch."],
              ["Answer all five", "If you’re stuck, mark it and move on."],
              [
                "Then feedback",
                "See the approach after submitting the whole set.",
              ],
            ].map(([title, text]) => (
              <div key={title}>
                <h2 className="text-xl">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <Button
            onClick={() =>
              setState((s) => ({
                ...s,
                [fresh ? "samiBatch" : "batch"]: "active",
              }))
            }
          >
            <LockKeyhole />
            Start the batch
          </Button>
        </Panel>
      ) : (
        <>
          <Notice>
            {batch === "active" ? (
              <span className="flex items-center gap-2">
                <LockKeyhole className="size-4 shrink-0" />
                Study help is paused during this sample batch. {ready} of 5
                ready.
              </span>
            ) : (
              <span>
                Sample independent result:{" "}
                <b>{fixture.batch.filter((_, i) => correct(i)).length} / 5</b>.
                These are fixed example questions, not a school assessment.
              </span>
            )}
          </Notice>
          <Panel
            title={
              batch === "feedback" ? "Your feedback" : `${ready} of 5 ready`
            }
          >
            {fixture.batch.map((q, i) => (
              <div
                key={q.q}
                className="space-y-4 border-b py-5 first:pt-0 last:border-0"
              >
                <p className="eyebrow">Problem {i + 1}</p>
                <h2 className="text-lg leading-relaxed">{q.q}</h2>
                {batch === "active" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        aria-label={`Answer ${i + 1}`}
                        inputMode="decimal"
                        placeholder="Answer"
                        value={answers[i]}
                        disabled={stuck[i]}
                        onChange={(e) => setAnswer(i, e.target.value)}
                      />
                      <Input
                        aria-label={`Working ${i + 1}`}
                        placeholder="Your working (optional)"
                        value={(fresh ? state.samiWork : state.work)[i]}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            [fresh ? "samiWork" : "work"]: (fresh
                              ? s.samiWork
                              : s.work
                            ).map((v, k) => (i === k ? e.target.value : v)),
                          }))
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={stuck[i]}
                        onChange={() => toggleStuck(i)}
                        className="size-4 accent-cobalt"
                      />
                      I couldn’t solve this one
                    </label>
                  </>
                ) : (
                  <div className="space-y-3 rounded-xl bg-secondary p-4">
                    <Status tone={correct(i) ? "success" : "warning"}>
                      {correct(i) ? "Correct" : "Review this one"}
                    </Status>
                    <p className="text-sm">
                      Your answer: {stuck[i] ? "Couldn’t solve" : answers[i]}
                    </p>
                    <p>{q.why}</p>
                  </div>
                )}
              </div>
            ))}
          </Panel>
          {batch === "active" ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={ready < 5} className="justify-self-start">
                  Submit the whole batch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit all five?</DialogTitle>
                  <DialogDescription>
                    You can’t change these sample answers after submitting.
                    Wrong answers are a starting point for feedback.
                  </DialogDescription>
                </DialogHeader>
                <Button
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      [fresh ? "samiBatch" : "batch"]: "feedback",
                    }));
                    setOpen(false);
                  }}
                >
                  Submit batch
                </Button>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/preview/${accountId}/study`}>
                  Review mistakes with agent
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    [fresh ? "samiBatch" : "batch"]: "none",
                    [fresh ? "samiAnswers" : "answers"]: ["", "", "", "", ""],
                    [fresh ? "samiWork" : "work"]: ["", "", "", "", ""],
                    [fresh ? "samiStuck" : "stuck"]: [
                      false,
                      false,
                      false,
                      false,
                      false,
                    ],
                  }));
                }}
              >
                New batch
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function UploadLesson() {
  const { state, setState } = usePreview();
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeading
        title="Upload a session"
        description="A lesson, its chapters, and who it’s for."
      />
      <Notice>
        This is a lesson-publishing preview. The selected video is not uploaded.
        Use{" "}
        <Link href="/files" className="text-cobalt underline">
          Your private files
        </Link>{" "}
        for the working file service.
      </Notice>
      <Panel title="Session details">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            const file = data.get("video");
            setState((s) => ({
              ...s,
              lessonDrafts: [
                ...s.lessonDrafts,
                {
                  title: String(data.get("title")),
                  filename: file instanceof File ? file.name : "No file",
                  audience: String(data.get("audience")),
                },
              ],
            }));
            setMessage(
              "Draft added to the preview lesson list. No video was uploaded or published.",
            );
            form.reset();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="lesson-video">Session recording</Label>
            <Input
              id="lesson-video"
              name="video"
              type="file"
              accept="video/*"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-title">Lesson title</Label>
            <Input
              id="lesson-title"
              name="title"
              placeholder="Momentum: an introduction"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-audience">Audience</Label>
            <select
              id="lesson-audience"
              name="audience"
              className="h-11 rounded-xl border bg-surface px-4"
            >
              <option>Grade 10 · 10A and 10B</option>
              <option>Grade 10 · 10A</option>
              <option>Grade 10 · 10B</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-notes">Chapters and notes</Label>
            <Textarea id="lesson-notes" placeholder="0:00 Introduction" />
          </div>
          <p className="text-sm text-muted-foreground">
            Home availability:{" "}
            {state.settings.recHome
              ? "permitted students"
              : "school network only"}{" "}
            in this preview.
          </p>
          <Button type="submit" className="justify-self-start">
            Save preview draft
          </Button>
          <p role="status" className="text-sm text-cobalt">
            {message}
          </p>
        </form>
      </Panel>
    </>
  );
}
