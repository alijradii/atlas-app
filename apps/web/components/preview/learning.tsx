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
} from "@school2036/ui";
import { ArrowLeft, ArrowRight, LockKeyhole, Pin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LessonLibrary } from "../lesson-library";
import { PageHeading, PearlScene } from "../pearl";
import { type AccountId, duration, fixture, subjectName } from "./data";
import { Empty, Notice, Panel, Status } from "./shared";
import { usePreview } from "./state";

export function Lessons({ accountId }: { accountId: AccountId }) {
  const teacher = accountId === "daher";
  const { state } = usePreview();
  const lessons = fixture.lessons.filter((lesson) =>
    teacher ? lesson.by === "Mr. Elie Daher" : lesson.grades.includes(10),
  );
  return (
    <>
      <LessonLibrary
        title={teacher ? "My lessons" : "Lessons"}
        description="Recorded by your teachers. Revisit a chapter, pause, and make time to understand."
        action={
          teacher ? (
            <Button asChild>
              <Link href="/files">Upload a session</Link>
            </Button>
          ) : undefined
        }
        subjects={["physics", "math", "cs", "english"].map((subject) => ({
          value: subject,
          label: subjectName(subject),
        }))}
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          subject: lesson.subj,
          subjectLabel: subjectName(lesson.subj),
          searchText: lesson.unit,
          badge: duration(lesson.dur),
          href: `/preview/${accountId}/lesson/${lesson.id}`,
          detail: (
            <>
              {lesson.unit}
              <br />
              {lesson.by}
            </>
          ),
        }))}
      />
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
  const student =
    accountId === "lina" || accountId === "sami" ? accountId : null;
  const pinned = student ? state.lessonPins[student].includes(id) : false;
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
                <Link
                  href={`/preview/${accountId}/${student ? "study" : "chat"}`}
                >
                  {student ? "Study this lesson" : "Open workspace assistant"}{" "}
                  <ArrowRight />
                </Link>
              </Button>
              {student && (
                <Button
                  variant="outline"
                  aria-pressed={pinned}
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      lessonPins: {
                        ...s.lessonPins,
                        [student]: s.lessonPins[student].includes(id)
                          ? s.lessonPins[student].filter((pin) => pin !== id)
                          : [...s.lessonPins[student], id],
                      },
                    }))
                  }
                >
                  <Pin />
                  {pinned ? "Remove shortcut" : "Pin to my home"}
                </Button>
              )}
            </div>
          </Panel>
        </div>
        <Panel title="Chapters">
          <div className="grid gap-2" data-guide-anchor="lesson.chapters">
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
            data-guide-anchor="batch.start"
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
                <Button
                  data-guide-anchor="batch.submit"
                  disabled={ready < 5}
                  className="justify-self-start"
                >
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
                data-guide-anchor="batch.new"
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
  return (
    <>
      <PageHeading
        title="Upload a session"
        description="Bring a document or recording into your private study library."
      />
      <Panel title="Your materials, ready to learn from">
        <div className="grid gap-5">
          <p className="text-sm text-muted-foreground">
            Upload with your own account. Review the extracted text before
            preparing a lesson for the study agent. You can share a prepared
            lesson with connected students from your workspace.
          </p>
          <Button asChild className="justify-self-start">
            <Link href="/files" data-guide-anchor="lessons.upload">
              Open files &amp; recordings <ArrowRight />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Sign in if needed. This example teacher does not own or receive your
            files.
          </p>
        </div>
      </Panel>
    </>
  );
}
