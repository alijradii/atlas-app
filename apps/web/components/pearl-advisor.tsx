"use client";

import { Button, Input } from "@school2036/ui";
import { ArrowRight, GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { PageHeading } from "./pearl";
import { Empty, Panel, Status } from "./preview/shared";

/** The original advisor page, with data and actions supplied by either adapter. */
export function PearlAdvisor({
  profile,
  meetings,
  interests,
  steps,
  questions,
  advice,
}: Record<
  "profile" | "meetings" | "interests" | "steps" | "questions" | "advice",
  ReactNode
>) {
  return (
    <div className="grid gap-5">
      <PageHeading
        title="My advisor"
        description="A human specialist who follows your interests, goals and choices over the years."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Your advisor">{profile}</Panel>
        <Panel title="Meetings">{meetings}</Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="My interests & goals">{interests}</Panel>
        <Panel title="Agreed next steps">{steps}</Panel>
        <Panel title="Questions">{questions}</Panel>
        <Panel title="Advice received">{advice}</Panel>
      </div>
    </div>
  );
}

export function PearlAdvisorProfile({
  initials,
  name,
  description,
  qualifications = [],
  languages,
}: {
  initials: string;
  name: string;
  description: string;
  qualifications?: readonly string[];
  languages?: string;
}) {
  return (
    <div className="flex items-start gap-5">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full border bg-surface text-xl">
        {initials}
      </span>
      <div>
        <h2 className="text-2xl">{name}</h2>
        <p className="mt-2 text-muted-foreground">{description}</p>
        {qualifications.length > 0 && (
          <div className="mt-5 space-y-3">
            {qualifications.map((qualification) => (
              <p key={qualification} className="flex gap-3 text-sm">
                <GraduationCap className="size-4 shrink-0 text-cobalt" />
                {qualification}
              </p>
            ))}
          </div>
        )}
        {languages && (
          <p className="mt-5 text-xs text-muted-foreground">
            Speaks {languages}
          </p>
        )}
      </div>
    </div>
  );
}

export type PearlStudent = {
  id: string;
  name: string;
  context: string;
  interests: string[];
  pending: boolean;
  followUp: string;
  href: string;
};

export function PearlStudents({ students }: { students: PearlStudent[] }) {
  const [query, setQuery] = useState("");
  const filtered = students.filter((student) =>
    `${student.name} ${student.interests.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="grid gap-5" data-guide-anchor="students.list">
      <PageHeading
        title="My students"
        description="Different interests, different pathways. Keep the next conversation in sight."
      />
      <div className="relative">
        <Search className="absolute top-3 left-3 size-4" />
        <Input
          aria-label="Search students"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or interest"
          className="pl-10"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {filtered.map((student) => (
          <Panel
            key={student.id}
            title={student.context}
            action={
              student.pending ? <Status>Choice to review</Status> : undefined
            }
          >
            <h2 className="text-2xl">{student.name}</h2>
            <div className="flex flex-wrap gap-2">
              {student.interests.map((interest) => (
                <Status key={interest}>{interest}</Status>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{student.followUp}</p>
            <Button asChild variant="outline">
              <Link href={student.href}>
                Open workspace <ArrowRight />
              </Link>
            </Button>
          </Panel>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title={
            students.length
              ? "No matching students"
              : "No students connected yet"
          }
          text={
            students.length
              ? "Try another name or interest."
              : "Your connected students will appear here."
          }
        />
      )}
    </div>
  );
}

export function PearlAdvisorStudent({
  name,
  context,
  description,
  pathway,
  steps,
  questions,
  advice,
}: {
  name: string;
  context: string;
  description: string;
  pathway: ReactNode;
  steps: ReactNode;
  questions: ReactNode;
  advice: ReactNode;
}) {
  return (
    <div className="grid gap-5">
      <PageHeading eyebrow={context} title={name} description={description} />
      <PearlAdvisorStudentSections
        pathway={pathway}
        steps={steps}
        questions={questions}
        advice={advice}
      />
    </div>
  );
}

export function PearlAdvisorStudentSections({
  pathway,
  steps,
  questions,
  advice,
  pathwayTitle = "Pathway",
  adviceTitle = "Guidance",
}: {
  pathway: ReactNode;
  steps: ReactNode;
  questions: ReactNode;
  advice: ReactNode;
  pathwayTitle?: string;
  adviceTitle?: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={pathwayTitle}>{pathway}</Panel>
        <Panel title="Agreed next steps">{steps}</Panel>
      </div>
      <Panel title="Student questions">{questions}</Panel>
      <Panel title={adviceTitle}>{advice}</Panel>
    </div>
  );
}
