"use client";

import { api, type components } from "@school2036/api-client";
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
import { FileText, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Person, Session } from "../workspace/types";

type Draft = {
  title: string;
  body: string;
  recipients: string[];
  reviewed: boolean;
};
type ReportDraft = components["schemas"]["SchoolReportDraft"];

/** Account-keyed parent owns this component; unsent reports never enter browser storage. */
export function StudyReportComposer({
  session,
  conversationId,
  ready,
  people,
}: {
  session: Session;
  conversationId?: string;
  ready: boolean;
  people: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<"draft" | "share" | null>(null);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const adults = [
    ...new Map(
      people
        .filter((person) =>
          ["teacher", "parent", "advisor"].includes(person.relationship),
        )
        .map((person) => [person.account_id, person]),
    ).values(),
  ];
  const draft = selectedConversation ? drafts[selectedConversation] : undefined;
  const update = (patch: Partial<Draft>) => {
    if (!selectedConversation || !draft) return;
    setDrafts((items) => ({
      ...items,
      [selectedConversation]: { ...draft, ...patch },
    }));
  };
  async function generate(id: string) {
    if (request.current) return;
    setError("");
    setBusy("draft");
    const controller = new AbortController();
    request.current = controller;
    try {
      const next = await api<ReportDraft>(
        `/study/conversations/${id}/report-draft`,
        "POST",
        undefined,
        session.csrf,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setDrafts((items) => ({
        ...items,
        [id]: {
          title: next.title,
          body: next.body,
          recipients: [],
          reviewed: false,
        },
      }));
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The report could not be drafted. Try again.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  }
  async function share() {
    if (
      !selectedConversation ||
      !draft?.reviewed ||
      !draft.recipients.length ||
      request.current
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setBusy("share");
    setError("");
    try {
      await api(
        "/school/reports",
        "POST",
        {
          title: draft.title.trim(),
          body: draft.body.trim(),
          recipient_ids: draft.recipients,
          conversation_id: selectedConversation,
        },
        session.csrf,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setShared(true);
      setDrafts((items) => {
        const next = { ...items };
        delete next[selectedConversation];
        return next;
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The report could not be shared. Your edits are still here.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  }
  if (!conversationId) return null;
  return (
    <>
      <div
        className="mb-5 flex flex-wrap items-center gap-3"
        data-guide-anchor="study.report"
      >
        <Button
          variant="outline"
          size="sm"
          disabled={!ready || Boolean(busy)}
          onClick={() => {
            setSelectedConversation(conversationId);
            setShared(false);
            setError("");
            setOpen(true);
            if (!drafts[conversationId]) void generate(conversationId);
          }}
        >
          <FileText />
          Create a report
        </Button>
        <span className="text-xs text-muted-foreground">
          Review what you want to share with your people.
        </span>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && busy === "share") return;
          if (!next && busy === "draft") {
            request.current?.abort();
            request.current = null;
            setBusy(null);
          }
          setOpen(next);
        }}
      >
        <DialogContent className="study-modal">
          <DialogHeader>
            <DialogTitle>
              {shared ? "Report shared" : "Review your report"}
            </DialogTitle>
            <DialogDescription>
              Only the report you approve is shared. Your whole conversation
              stays private. This is a discussion summary, not an assessment.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="study-error">
              {error}
            </p>
          )}
          {busy === "draft" && (
            <div className="study-run-status" role="status">
              <span className="study-thinking" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>Drafting a report from this conversation…</p>
              <Button
                variant="outline"
                onClick={() => {
                  request.current?.abort();
                  request.current = null;
                  setBusy(null);
                  setError(
                    "Drafting stopped. You can try again when you’re ready.",
                  );
                }}
              >
                Stop drafting
              </Button>
            </div>
          )}
          {shared ? (
            <div className="space-y-4">
              <p>Your selected people can now read this report in Reports.</p>
              <Button asChild>
                <Link href="/workspace?section=reports">Open reports</Link>
              </Button>
            </div>
          ) : draft ? (
            <form
              className="study-form"
              onSubmit={(event) => {
                event.preventDefault();
                void share();
              }}
            >
              <div>
                <Label htmlFor="report-title">Report title</Label>
                <Input
                  id="report-title"
                  value={draft.title}
                  maxLength={160}
                  required
                  disabled={Boolean(busy)}
                  onChange={(event) =>
                    update({ title: event.target.value, reviewed: false })
                  }
                />
              </div>
              <div>
                <Label htmlFor="report-body">Report content</Label>
                <Textarea
                  id="report-body"
                  value={draft.body}
                  maxLength={8000}
                  required
                  disabled={Boolean(busy)}
                  onChange={(event) =>
                    update({ body: event.target.value, reviewed: false })
                  }
                />
                <p className="study-small">
                  Edit anything that does not reflect what you meant. Separate
                  your own words from AI suggestions.
                </p>
              </div>
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  Choose who can read it
                </legend>
                {adults.map((person) => (
                  <label
                    key={person.account_id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      disabled={Boolean(busy)}
                      checked={draft.recipients.includes(person.account_id)}
                      onChange={(event) =>
                        update({
                          reviewed: false,
                          recipients: event.target.checked
                            ? [...draft.recipients, person.account_id]
                            : draft.recipients.filter(
                                (id) => id !== person.account_id,
                              ),
                        })
                      }
                    />
                    <span>
                      {person.name}
                      <small className="ml-2 text-muted-foreground">
                        {person.relationship}
                      </small>
                    </span>
                  </label>
                ))}
                {!adults.length && (
                  <p className="study-small">
                    No linked teacher, parent or advisor yet. Your draft stays
                    private.
                  </p>
                )}
              </fieldset>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={Boolean(busy)}
                  checked={draft.reviewed}
                  onChange={(event) =>
                    update({ reviewed: event.target.checked })
                  }
                />
                <span>
                  I reviewed this report and want to share it with the people
                  selected above.
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={
                    Boolean(busy) ||
                    !draft.reviewed ||
                    !draft.recipients.length ||
                    !draft.title.trim() ||
                    !draft.body.trim()
                  }
                >
                  <Send />
                  {busy === "share" ? "Sharing…" : "Share report"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => setOpen(false)}
                >
                  Keep editing later
                </Button>
              </div>
              <p className="study-small">
                Unsent edits stay here while this study page is open.
              </p>
            </form>
          ) : (
            busy !== "draft" && (
              <Button
                onClick={() =>
                  selectedConversation && void generate(selectedConversation)
                }
              >
                Try drafting again
              </Button>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
