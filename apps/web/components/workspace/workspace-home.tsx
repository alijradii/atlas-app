"use client";

import { Button } from "@school2036/ui";
import { BookOpen, FileUp, Flag, MessageCircle, SquarePen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PearlHome } from "../pearl-home";
import { PearlHomeHelpers } from "../pearl-home-helpers";
import { HomePanel, WorkRows } from "../preview/home-sections";
import { saveStudyDraft } from "../study/draft-handoff";
import { workspaceHomeCards } from "./home-cards";
import type { Lesson, Session, Workspace } from "./types";

export function WorkspaceHome({
  session,
  data,
  lessons,
}: {
  session: Session;
  data: Workspace;
  lessons: Lesson[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const studyActions = [
    {
      id: "explain",
      label: "Explain a difficult part of my lesson",
      icon: BookOpen,
    },
    {
      id: "practice",
      label: "Make practice questions from my material",
      icon: SquarePen,
    },
    { id: "recap", label: "Summarize the key ideas", icon: Flag },
  ];
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => setDate(new Date()), []);
  const cards = workspaceHomeCards(data, lessons);
  const firstName = session.name.trim().split(/\s+/)[0] || "there";
  const roleLabel = data.roles.length
    ? data.roles.join(" · ")
    : "Your workspace";
  return (
    <PearlHome
      firstName={firstName}
      roleLabel={roleLabel}
      cards={cards}
      date={date}
    >
      <PearlHomeHelpers
        description="Choose what you’d like help with. You’ll select your lesson sources and review the question before sending."
        items={studyActions.map((item) => ({
          ...item,
          enabled: selected.includes(item.id),
        }))}
        onToggle={(id) =>
          setSelected((items) =>
            items.includes(id)
              ? items.filter((item) => item !== id)
              : [...items, id],
          )
        }
        actionLabel={
          selected.length ? "Start with these" : "Open your study space"
        }
        onAction={() => {
          if (selected.length)
            saveStudyDraft(
              session.account_id,
              studyActions
                .filter((item) => selected.includes(item.id))
                .map((item) => item.label)
                .join(". "),
            );
          router.push("/study");
        }}
      />
      <details className="pearl-home-overview">
        <summary>
          {data.roles.includes("student")
            ? "Your week & subjects"
            : "Your workspace overview"}
        </summary>
        <div className="pearl-home-overview-content">
          <HomePanel
            title="Schoolwork"
            action={
              <Link href="/workspace?section=work" className="text-xs">
                View all
              </Link>
            }
          >
            <WorkRows
              rows={data.assignments.map((item) => ({
                icon: SquarePen,
                title: item.title,
                subtitle: item.feedback || item.instructions,
                href: "/workspace?section=work",
                action: item.state === "reviewed" ? "Feedback" : "Open",
              }))}
            />
            {!data.assignments.length && (
              <p className="p-5 text-sm text-muted-foreground">
                No assignments yet. Shared work will appear here.
              </p>
            )}
          </HomePanel>
          <HomePanel
            title="Your materials"
            action={
              <Link href="/files" className="text-xs">
                Upload materials
              </Link>
            }
          >
            <WorkRows
              rows={lessons.map((item) => ({
                icon: BookOpen,
                title: item.title,
                subtitle: item.subject || "Study material",
                href: `/study?lesson=${item.id}`,
                action: item.state === "review" ? "Review" : "Open",
              }))}
            />
            {!lessons.length && (
              <p className="p-5 text-sm text-muted-foreground">
                Upload a document or session to build your study library.
              </p>
            )}
          </HomePanel>
        </div>
      </details>
      {!cards.length && (
        <HomePanel
          title="Bring your first material"
          action={
            <Button asChild size="sm">
              <Link href="/files">
                <FileUp />
                Upload materials
              </Link>
            </Button>
          }
        >
          <p className="p-5 text-sm text-muted-foreground">
            Documents and recorded sessions stay in your private files. Review
            their transcripts before preparing them for study.
          </p>
        </HomePanel>
      )}
      {data.roles.includes("advisor") && (
        <HomePanel title="Up next">
          <WorkRows
            rows={data.proposals
              .filter((item) => item.state === "pending_advisor")
              .map((item) => ({
                icon: MessageCircle,
                title: item.title,
                subtitle: "Ready for your review",
                href: "/workspace?section=plans",
                action: "Review",
              }))}
          />
        </HomePanel>
      )}
    </PearlHome>
  );
}
