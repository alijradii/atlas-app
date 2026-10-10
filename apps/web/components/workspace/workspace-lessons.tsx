"use client";

import { Button } from "@school2036/ui";
import { BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LessonLibrary } from "../lesson-library";
import type { Lesson } from "./types";

const lessonStates: Record<Lesson["state"], string> = {
  queued: "Waiting to prepare",
  extracting: "Reading material",
  review: "Review text",
  indexing: "Preparing sources",
  ready: "Ready to study",
  failed: "Preparation failed",
};

export function WorkspaceLessons({
  teacher,
  lessons,
  sharing,
}: {
  teacher: boolean;
  lessons: Lesson[];
  sharing?: ReactNode;
}) {
  const subjects = [
    ...new Set(lessons.map((lesson) => lesson.subject).filter(Boolean)),
  ].sort();
  return (
    <div className="grid gap-5">
      <LessonLibrary
        title={teacher ? "My lessons" : "Lessons"}
        description="Your recordings and documents, together. Revisit a lesson, review its text, and make time to understand."
        action={
          <Button asChild>
            <Link href="/files">
              {teacher ? "Upload a session" : "Add materials"}
            </Link>
          </Button>
        }
        subjects={subjects.map((subject) => ({
          value: subject,
          label: subject,
        }))}
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          subject: lesson.subject,
          subjectLabel: lesson.subject || "Lesson",
          searchText: `${lesson.subject} ${lesson.source_kind}`,
          detail: (
            <>
              {lesson.source_kind === "recording"
                ? "Session transcript"
                : lesson.source_kind === "document"
                  ? "Document"
                  : "Lesson transcript"}
              <br />
              {lesson.owned ? "Your material" : "Shared with you"}
            </>
          ),
          badge: lessonStates[lesson.state],
          href: `/study?lesson=${encodeURIComponent(lesson.id)}`,
          icon:
            lesson.state === "ready" ? (
              <BookOpen className="size-4" />
            ) : (
              <FileText className="size-4" />
            ),
        }))}
      />
      {sharing}
    </div>
  );
}
