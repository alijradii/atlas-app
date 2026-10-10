"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Card } from "@school2036/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "../pearl";
import { RichMessage } from "../preview/rich-message";
import type { Session, Workspace } from "./types";

type Report = components["schemas"]["SchoolReportView"];
export function WorkspaceReports(props: { data: Workspace; session: Session }) {
  return <Reports key={props.session.account_id} {...props} />;
}

function Reports({ data, session }: { data: Workspace; session: Session }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const reads = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    reads.current?.abort();
    const controller = new AbortController();
    reads.current = controller;
    try {
      const next = await api<Report[]>(
        "/school/reports",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      // A different account may have signed in in another tab while this read ran.
      const current = await api<Session>(
        "/auth/me",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (current.account_id !== session.account_id) {
        setReports(null);
        setExpired(true);
        setError(
          "Your account changed. Reopen your workspace to view its reports.",
        );
        return;
      }
      setReports(next);
      setExpired(false);
      setError("");
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        setReports(null);
        setExpired(true);
      }
      setError(
        cause instanceof Error ? cause.message : "Reports could not be loaded.",
      );
    }
  }, [session.account_id]);
  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resume = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") {
        reads.current?.abort();
      } else {
        timer = setTimeout(() => void refresh(), 100);
      }
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      reads.current?.abort();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);
  const student = data.roles.includes("student");
  return (
    <section data-guide-anchor="reports.list" className="space-y-6">
      <PageHeading
        title={student ? "Your shared reports" : "Reports shared with you"}
        description={
          student
            ? "The conversation summaries you reviewed and chose to share."
            : "Student-reviewed interests, questions and project ideas for a conversation together."
        }
      />
      {student && !expired && (
        <Button asChild variant="outline">
          <Link href="/study">
            <FileText />
            Explore an interest and create a report
          </Link>
        </Button>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {expired ? (
            <Button asChild variant="outline">
              <Link href="/login?next=workspace">Reopen workspace</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void refresh()}>
              Try again
            </Button>
          )}
        </div>
      )}
      {!reports && !error && <p role="status">Opening shared reports…</p>}
      {reports?.length === 0 && (
        <Card className="gap-2 p-8">
          <h2 className="text-xl">No shared reports yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {student
              ? "Explore a hobby, question or research idea with your study agent. Create a report, edit it, and choose who can read it."
              : "Reports appear only when a linked student reviews a summary and chooses to share it with you."}
          </p>
        </Card>
      )}
      {reports?.map((report) => (
        <article key={report.id}>
          <Card className="gap-0 p-6">
            <div className="mb-4 flex flex-wrap justify-between gap-3">
              <div>
                <p className="eyebrow">
                  {report.student_id === session.account_id
                    ? "Shared by you"
                    : `From ${report.student_name}`}
                </p>
                <h2 className="mt-2 text-xl">{report.title}</h2>
              </div>
              <time
                className="text-xs text-muted-foreground"
                dateTime={new Date(report.created * 1000).toISOString()}
              >
                {new Date(report.created * 1000).toLocaleDateString()}
              </time>
            </div>
            <RichMessage text={report.body} />
            {student && (
              <p className="mt-4 text-xs text-muted-foreground">
                Shared with{" "}
                {report.recipient_ids
                  .map(
                    (id) =>
                      data.people.find((person) => person.account_id === id)
                        ?.name ?? "Previously linked person",
                  )
                  .join(", ")}
              </p>
            )}
            <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
              Shared report · The private conversation is not included. Use this
              as a starting point for discussion, not a measure of ability.
            </p>
          </Card>
        </article>
      ))}
    </section>
  );
}
