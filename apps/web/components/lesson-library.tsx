"use client";

import { Input } from "@school2036/ui";
import { Play, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { PageHeading, PearlScene } from "./pearl";
import { Empty } from "./preview/shared";

export type LibraryLesson = {
  id: string;
  title: string;
  subject: string;
  subjectLabel: string;
  detail: ReactNode;
  searchText: string;
  badge: string;
  href: string;
  icon?: ReactNode;
};

/** The original lesson-card layout; data and available actions come from its caller. */
export function LessonLibrary({
  title,
  description,
  action,
  lessons,
  subjects,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  lessons: LibraryLesson[];
  subjects: { value: string; label: string }[];
}) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const activeSubject = subjects.some((item) => item.value === subject)
    ? subject
    : "all";
  const visible = lessons.filter(
    (lesson) =>
      (activeSubject === "all" || lesson.subject === activeSubject) &&
      `${lesson.title} ${lesson.searchText}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading title={title} description={description}>
        {action}
      </PageHeading>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-guide-anchor="lessons.search"
            aria-label="Search lessons"
            placeholder="Search lessons or units"
            className="pl-10"
          />
        </div>
        <select
          aria-label="Filter lessons by subject"
          value={activeSubject}
          onChange={(event) => setSubject(event.target.value)}
          className="h-11 rounded-xl border border-input bg-surface px-4"
        >
          <option value="all">All subjects</option>
          {subjects.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {!visible.length ? (
        <Empty
          title="No lessons found"
          text={
            lessons.length
              ? "Try another subject or search term."
              : "Upload a document or recording, or open a lesson shared with you."
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((lesson) => (
            <Link
              key={lesson.id}
              href={lesson.href}
              className="glass-panel group min-w-0 overflow-hidden"
            >
              <div className="relative">
                <PearlScene className="min-h-44" compact />
                <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs text-white">
                  {lesson.badge}
                </span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface/90 transition-transform group-hover:scale-110">
                    {lesson.icon ?? <Play className="size-4" />}
                  </span>
                </span>
              </div>
              <div className="space-y-3 p-5">
                <p className="eyebrow">{lesson.subjectLabel}</p>
                <h2 className="break-words text-xl leading-snug">
                  {lesson.title}
                </h2>
                <p className="text-xs text-muted-foreground">{lesson.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
