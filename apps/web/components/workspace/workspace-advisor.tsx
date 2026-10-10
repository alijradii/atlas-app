"use client";

import { Button, Label, Textarea } from "@school2036/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { PageHeading } from "../pearl";
import {
  PearlAdvisor,
  PearlAdvisorProfile,
  PearlAdvisorStudent,
  PearlStudents,
} from "../pearl-advisor";
import { initials } from "../preview/data";
import { Empty, Panel, Status } from "../preview/shared";
import type { Workspace } from "./types";

type AdvisorStore = {
  data: Workspace;
  busy: boolean;
  mutate: (path: string, body?: unknown, method?: string) => Promise<boolean>;
};

export function WorkspaceAdvisor({
  store,
  name,
  caseload = false,
}: {
  store: AdvisorStore;
  name: (id: string) => string;
  caseload?: boolean;
}) {
  const data = store.data;
  const params = useSearchParams();
  const isAdvisor =
    data.roles.includes("advisor") &&
    (!data.roles.includes("student") ||
      caseload ||
      Boolean(params.get("student")));
  const peers = data.people.filter((person) =>
    isAdvisor
      ? person.relationship === "student" &&
        Boolean(person.responsibilities?.includes("advisor"))
      : person.relationship === "advisor",
  );
  const [selected, setSelected] = useState("");
  const [draftState, setDraftState] = useState({ recipient: "", text: "" });
  const input = useRef<HTMLTextAreaElement>(null);
  const requested = selected || params.get("student");
  const person =
    peers.find((item) => item.account_id === requested) ?? peers[0];
  const draft =
    draftState.recipient === person?.account_id ? draftState.text : "";
  const setDraft = (text: string) =>
    setDraftState({ recipient: person?.account_id ?? "", text });
  const student = isAdvisor ? person?.account_id : data.account_id;
  const advisor = isAdvisor ? data.account_id : person?.account_id;
  const proposals = data.proposals.filter(
    (item) => item.student_id === student && item.advisor_id === advisor,
  );
  const messages = data.messages.filter(
    (item) => item.student_id === student && item.advisor_id === advisor,
  );
  if (caseload && isAdvisor)
    return (
      <PearlStudents
        students={peers.map((peer) => {
          const plans = data.proposals.filter(
            (plan) =>
              plan.student_id === peer.account_id &&
              plan.advisor_id === data.account_id,
          );
          const pending = plans.filter(
            (plan) => plan.state === "pending_advisor",
          ).length;
          const conversation = data.messages.filter(
            (message) =>
              message.student_id === peer.account_id &&
              message.advisor_id === data.account_id,
          );
          return {
            id: peer.account_id,
            name: peer.name,
            context: "Connected student",
            interests: plans.map((plan) => plan.title),
            pending: pending > 0,
            followUp: pending
              ? `${pending} ${pending === 1 ? "proposal" : "proposals"} to review`
              : conversation.length
                ? "An ongoing conversation"
                : "Ready for your first conversation",
            href: `/workspace?section=messages&student=${encodeURIComponent(peer.account_id)}`,
          };
        })}
      />
    );
  if (!person)
    return (
      <>
        <PageHeading title={isAdvisor ? "My students" : "My advisor"} />
        <Panel title="Your next connection">
          <Empty
            title={
              isAdvisor
                ? "No students connected yet"
                : "Your advisor is being matched"
            }
            text="Your school administrator connects students and advisors. Your conversation stays between you and your advisor."
          />
        </Panel>
      </>
    );
  const questions = (
    <>
      <div role="log" aria-label="Advisor messages" className="space-y-4">
        {messages.length ? (
          messages.map((message) => (
            <div key={message.id} className="space-y-3 border-b pb-4">
              {message.sender_id === advisor ? (
                <blockquote className="rounded-xl bg-accent p-4 text-sm">
                  <span className="mb-2 block text-xs text-cobalt">
                    {name(message.sender_id)} · human advisor
                  </span>
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                </blockquote>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {name(message.sender_id)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {message.content}
                  </p>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Start with a question, an update, or something you are thinking
            about.
          </p>
        )}
      </div>
      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await store.mutate("/school/messages", {
              student_id: student,
              advisor_id: advisor,
              content: draft.trim(),
            })
          )
            setDraft("");
        }}
      >
        <Label htmlFor="advisor-message">Message to {person.name}</Label>
        <Textarea
          ref={input}
          id="advisor-message"
          required
          rows={3}
          maxLength={4000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            isAdvisor ? "Your advice, in your words" : "What’s on your mind?"
          }
        />
        <Button disabled={store.busy || !draft.trim()} type="submit">
          {store.busy ? "Sending…" : "Send message"}
        </Button>
      </form>
    </>
  );
  const agreed = proposals.filter((proposal) => proposal.state === "approved");
  const steps = agreed.length ? (
    agreed.map((proposal) => (
      <div key={proposal.id} className="space-y-2 border-b pb-4 last:border-0">
        <p className="text-sm">{proposal.title}</p>
        <Status>
          {
            {
              pending_advisor: "With advisor",
              pending_parent: "With parent",
              approved: "Approved",
              declined: "Declined",
              revision_requested: "Changes requested",
            }[proposal.state]
          }
        </Status>
        {proposal.advisor_note && (
          <p className="text-sm text-muted-foreground">
            {proposal.advisor_note}
          </p>
        )}
        <Link
          href="/workspace?section=plans"
          className="block text-sm text-cobalt underline"
        >
          Review proposal
        </Link>
      </div>
    ))
  ) : (
    <p className="text-sm text-muted-foreground">
      Agreed steps will appear here as you and your advisor review your
      proposals.
    </p>
  );
  const advice = messages.filter((message) => message.sender_id === advisor)
    .length ? (
    messages
      .filter((message) => message.sender_id === advisor)
      .map((message) => (
        <blockquote
          key={message.id}
          className="space-y-2 border-b pb-4 text-sm"
        >
          <p className="text-xs text-cobalt">
            {name(advisor ?? "")} · private conversation
          </p>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </blockquote>
      ))
  ) : (
    <p className="text-sm text-muted-foreground">
      Advice from your conversation will appear here.
    </p>
  );
  const interests = (
    <>
      <div className="flex flex-wrap gap-2">
        {proposals.map((proposal) => (
          <Status key={proposal.id}>{proposal.title}</Status>
        ))}
      </div>
      {proposals.length ? (
        <ul className="space-y-2">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="text-sm">
              {proposal.description}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Bring an interest or goal into your conversation, or start a proposal
          together.
        </p>
      )}
      <Button asChild variant="outline">
        <Link href="/workspace?section=plans">
          {isAdvisor ? "Review subject proposals" : "Explore your next step"}
        </Link>
      </Button>
    </>
  );
  const selector = peers.length > 1 && (
    <div className="mb-5 grid gap-2">
      <Label htmlFor="advisor-person">
        {isAdvisor ? "Student" : "Advisor"}
      </Label>
      <select
        id="advisor-person"
        className="h-11 rounded-xl border bg-surface px-4"
        value={person.account_id}
        onChange={(event) => {
          setSelected(event.target.value);
          setDraft("");
        }}
      >
        {peers.map((peer) => (
          <option key={peer.account_id} value={peer.account_id}>
            {peer.name}
          </option>
        ))}
      </select>
    </div>
  );
  if (isAdvisor)
    return (
      <>
        {selector}
        <PearlAdvisorStudent
          name={person.name}
          context="Advisor workspace"
          description="Your student's questions, plans and next steps."
          pathway={interests}
          steps={steps}
          questions={questions}
          advice={advice}
        />
      </>
    );
  return (
    <>
      {selector}
      <PearlAdvisor
        profile={
          <PearlAdvisorProfile
            initials={initials(person.name)}
            name={person.name}
            description="Your connected human advisor"
          />
        }
        meetings={
          <>
            <Status>Arrange a conversation</Status>
            <p className="text-muted-foreground">
              Send your advisor a message to find a time together.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(
                  "I'd like to arrange a conversation. When would suit you?",
                );
                input.current?.focus();
              }}
            >
              Request a conversation
            </Button>
          </>
        }
        interests={interests}
        steps={steps}
        questions={questions}
        advice={advice}
      />
    </>
  );
}
