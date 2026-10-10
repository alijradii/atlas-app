"use client";

import { Button, Textarea } from "@school2036/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardList,
  GitBranch,
  Plus,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { ConnectedShell } from "../connected-shell";
import { Brand } from "../pearl";
import type {
  Assignment,
  Person,
  Proposal,
  Session,
  Workspace as WorkspaceData,
} from "./types";
import { useWorkspace } from "./use-workspace";
import { WorkspaceAdvisor } from "./workspace-advisor";
import { WorkspaceAssistant } from "./workspace-assistant";
import { WorkspaceConnections } from "./workspace-connections";
import { WorkspaceEvents } from "./workspace-events";
import { WorkspaceHome } from "./workspace-home";
import { WorkspaceLessons } from "./workspace-lessons";
import { WorkspaceReports } from "./workspace-reports";
import "./workspace.css";

type Store = Omit<ReturnType<typeof useWorkspace>, "data" | "session"> & {
  data: WorkspaceData;
  session: Session;
};
type Tab = "work" | "lessons" | "advisor" | "choices" | "students";
const labels: Record<string, string> = {
  assigned: "Ready to start",
  submitted: "With your teacher",
  returned: "Changes requested",
  reviewed: "Feedback ready",
  pending_advisor: "With advisor",
  pending_parent: "With parent",
  approved: "Approved",
  declined: "Declined",
  revision_requested: "Changes requested",
};
const readable = (state: string) => labels[state] ?? state;
const date = (value: number) =>
  new Date(value * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function WorkspaceApp({
  section = "home",
}: {
  section?: string;
}) {
  const store = useWorkspace(section);
  if (!store.session || !store.data)
    return (
      <main id="main-content" className="school-gate">
        <Brand />
        <h1>
          {store.signedOut
            ? "Sign in to your workspace"
            : store.loading
              ? "Opening your workspace…"
              : "Your Atlas workspace"}
        </h1>
        <p role={store.error ? "alert" : "status"}>
          {store.error ||
            (store.signedOut
              ? "Your lessons, schoolwork and conversations, together."
              : "Checking your account and connected people.")}
        </p>
        {store.signedOut ? (
          <Button asChild>
            <Link href="/login?next=workspace">Sign in</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={store.refresh}>
            Try again
          </Button>
        )}
      </main>
    );
  return (
    <Workspace
      key={store.session.account_id}
      section={section}
      store={{ ...store, data: store.data, session: store.session }}
    />
  );
}
function Workspace({ store, section }: { store: Store; section: string }) {
  const data = store.data;
  const has = (role: WorkspaceData["roles"][number]) =>
    data.roles.includes(role);
  const name = (id: string) =>
    id === data.account_id
      ? "You"
      : (data.people.find((person) => person.account_id === id)?.name ??
        "Connected person");
  const allowed: Record<Tab, boolean> = {
    students: has("advisor"),
    work: has("student") || has("teacher") || has("parent"),
    lessons: has("student") || has("teacher"),
    advisor: has("student") || has("advisor"),
    choices: has("student") || has("advisor") || has("parent"),
  };
  const dedicated = ["assistant", "events", "connections", "reports"].includes(
    section,
  );
  const tab: Tab =
    section === "students"
      ? "students"
      : section === "messages"
        ? "advisor"
        : section === "plans"
          ? "choices"
          : section === "lessons"
            ? "lessons"
            : "work";
  return (
    <ConnectedShell
      session={store.session}
      section={section}
      data={data}
      onSignOut={() => void store.signOut()}
      headerActions={
        <Button
          size="icon"
          variant="ghost"
          aria-label="Refresh workspace"
          disabled={store.busy}
          onClick={store.refresh}
        >
          <RefreshCw />
        </Button>
      }
    >
      <div>
        {section === "home" && (
          <WorkspaceHome
            session={store.session}
            data={data}
            lessons={store.lessons}
          />
        )}
        {store.error && (
          <div className="school-error" role="alert">
            {store.error}
            <Button variant="ghost" size="sm" onClick={store.refresh}>
              <RefreshCw />
              Retry
            </Button>
          </div>
        )}
        {section === "assistant" && <WorkspaceAssistant data={data} />}
        {section === "events" && (
          <WorkspaceEvents session={store.session} data={data} />
        )}
        {section === "connections" && (
          <WorkspaceConnections session={store.session} data={data} />
        )}
        {section === "reports" && (
          <WorkspaceReports session={store.session} data={data} />
        )}
        {section === "home" && !data.roles.length && (
          <section className="school-panel school-onboarding">
            <Users />
            <h2>Your school connections are not set up yet</h2>
            <p>
              You can already use your private study space and files. Ask your
              school administrator to connect your account to your teacher,
              advisor or child. Those connections control which work you can see
              here.
            </p>
          </section>
        )}
        {section !== "home" && !dedicated && !allowed[tab] && (
          <section className="school-panel">
            <h1 className="text-2xl">
              This section isn’t connected to your account
            </h1>
            <p className="my-4 text-muted-foreground">
              Your school connections determine which work you can access. Your
              private files and study library are still available.
            </p>
            <Button asChild variant="outline">
              <Link href="/workspace">Back to home</Link>
            </Button>
          </section>
        )}
        {section !== "home" && !dedicated && allowed[tab] && (
          <section
            key={tab}
            className="school-content"
            aria-label="School workflow"
            data-guide-anchor={
              tab === "work"
                ? "schoolwork.assignments"
                : tab === "choices"
                  ? "proposals.list"
                  : undefined
            }
          >
            {tab === "work" && (
              <>
                <SectionHeading
                  title={
                    has("teacher")
                      ? "Work with your students"
                      : has("parent")
                        ? "Your child’s schoolwork"
                        : "Your schoolwork"
                  }
                  description="Assignments, your own work and feedback stay together."
                />
                {has("teacher") && <CreateAssignment store={store} />}
                {!data.assignments.length && (
                  <Empty
                    icon={<ClipboardList />}
                    title="A fresh page"
                    text="Assignments will appear here when your teacher shares them."
                  />
                )}
                <div className="school-card-list">
                  {data.assignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      store={store}
                      name={name}
                    />
                  ))}
                </div>
              </>
            )}
            {tab === "lessons" && (
              <WorkspaceLessons
                teacher={has("teacher")}
                lessons={store.lessons}
                sharing={
                  has("teacher") ? (
                    <>
                      {has("teacher") && <PublishLesson store={store} />}
                      <div className="school-card-list">
                        {data.publications.map((item) => (
                          <article
                            className="school-panel school-publication"
                            key={item.id}
                          >
                            <BookOpen />
                            <div>
                              <p className="eyebrow">
                                {item.subject || "Lesson"}
                              </p>
                              <h2>{item.title}</h2>
                              <p>
                                {name(item.teacher_id)} →{" "}
                                {name(item.student_id)} · {date(item.created)}
                              </p>
                            </div>
                            {item.student_id === data.account_id ||
                            item.teacher_id === data.account_id ? (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/study?lesson=${item.lesson_id}`}>
                                  Open lesson material <ArrowRight />
                                </Link>
                              </Button>
                            ) : null}
                            {item.teacher_id === data.account_id && (
                              <Unpublish id={item.id} store={store} />
                            )}
                          </article>
                        ))}
                      </div>
                    </>
                  ) : undefined
                }
              />
            )}
            {tab === "students" && (
              <WorkspaceAdvisor store={store} name={name} caseload />
            )}
            {tab === "advisor" && (
              <WorkspaceAdvisor store={store} name={name} />
            )}
            {tab === "choices" && (
              <>
                <SectionHeading
                  title="Make your next move"
                  description="Bring an idea to your advisor. If a parent decision is needed, it follows their review."
                />
                {has("student") && <CreateProposal store={store} />}
                <div className="school-card-list">
                  {data.proposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      store={store}
                      name={name}
                    />
                  ))}
                </div>
                {!data.proposals.length && (
                  <Empty
                    icon={<GitBranch />}
                    title="Room for your next idea"
                    text="A course choice, a project or a direction to explore. Proposals and decisions will stay here."
                  />
                )}
              </>
            )}
          </section>
        )}
        <footer className="school-footer">
          <Users />
          <span>
            {data.people.length} connected{" "}
            {data.people.length === 1 ? "person" : "people"}
          </span>
          <span>Your access follows your account, wherever you learn.</span>
        </footer>
      </div>
    </ConnectedShell>
  );
}
function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="school-section-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="school-empty">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function SelectPeople({
  label,
  people,
  value,
  setValue,
  optional = false,
}: {
  label: string;
  people: Person[];
  value: string;
  setValue: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        required={!optional}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">
          {optional
            ? "No parent decision needed"
            : `Choose ${label.toLowerCase()}`}
        </option>
        {people.map((person) => (
          <option
            key={`${person.account_id}-${person.relationship}`}
            value={person.account_id}
          >
            {person.name} · {person.login}
          </option>
        ))}
      </select>
    </label>
  );
}
function CreateAssignment({ store }: { store: Store }) {
  const [student, setStudent] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [lesson, setLesson] = useState("");
  const [due, setDue] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await store.mutate("/school/assignments", {
        student_id: student,
        title: title.trim(),
        instructions: instructions.trim(),
        lesson_id: lesson || null,
        due_at: due ? new Date(due).getTime() / 1000 : null,
      })
    ) {
      setTitle("");
      setInstructions("");
      setDue("");
    }
  };
  return (
    <details className="school-panel school-create">
      <summary>
        <Plus />
        Create an assignment
      </summary>
      <form className="school-form" onSubmit={submit}>
        <div className="school-form-grid">
          <SelectPeople
            label="Student"
            people={store.data.people.filter(
              (person) =>
                person.relationship === "student" &&
                person.responsibilities?.includes("teacher"),
            )}
            value={student}
            setValue={setStudent}
          />
          <label>
            Assignment title
            <input
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
        </div>
        <label htmlFor="assignment-instructions">
          Instructions
          <Textarea
            id="assignment-instructions"
            required
            rows={3}
            maxLength={8000}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </label>
        <div className="school-form-grid">
          <label>
            Related lesson (optional)
            <select
              value={lesson}
              onChange={(event) => setLesson(event.target.value)}
            >
              <option value="">No lesson</option>
              {store.lessons
                .filter((lesson) => lesson.owned && lesson.state === "ready")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Due date (optional)
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </label>
        </div>
        <Button
          disabled={
            store.busy || !student || !title.trim() || !instructions.trim()
          }
          type="submit"
        >
          {store.busy ? "Saving…" : "Share assignment"}
          <ArrowRight />
        </Button>
      </form>
    </details>
  );
}
function AssignmentCard({
  assignment: item,
  store,
  name,
}: {
  assignment: Assignment;
  store: Store;
  name: (id: string) => string;
}) {
  const [answer, setAnswer] = useState(item.answer || "");
  const [feedback, setFeedback] = useState("");
  const [revision, setRevision] = useState(false);
  const own = item.student_id === store.data.account_id;
  const teacher = item.teacher_id === store.data.account_id;
  return (
    <article className="school-panel school-assignment">
      <div className="school-card-heading">
        <div>
          <p className="eyebrow">
            {own
              ? `From ${name(item.teacher_id)}`
              : `For ${name(item.student_id)}`}
            {item.due_at ? ` · Due ${date(item.due_at)}` : ""}
          </p>
          <h2>{item.title}</h2>
        </div>
        <span className="school-status">{readable(item.state)}</span>
      </div>
      <p className="school-prose">{item.instructions}</p>
      {item.lesson_id && (own || teacher) && (
        <Link
          className="school-text-link"
          href={`/study?lesson=${item.lesson_id}`}
        >
          <BookOpen />
          {teacher ? "Review the related lesson" : "Study the related lesson"}
        </Link>
      )}
      {item.answer && (
        <div className="school-saved-work">
          <h3>Submitted work</h3>
          <p className="school-prose">{item.answer}</p>
        </div>
      )}
      {item.feedback && (
        <div className="school-feedback">
          <Check />
          <div>
            <h3>Teacher feedback</h3>
            <p className="school-prose">{item.feedback}</p>
          </div>
        </div>
      )}
      {own && ["assigned", "returned"].includes(item.state) && (
        <form
          className="school-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await store.mutate(`/school/assignments/${item.id}/submit`, {
              answer: answer.trim(),
            });
          }}
        >
          <label htmlFor={`answer-${item.id}`}>
            Your answer
            <Textarea
              id={`answer-${item.id}`}
              rows={4}
              required
              maxLength={8000}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </label>
          <small>Your work is saved when you submit it.</small>
          <Button type="submit" disabled={store.busy || !answer.trim()}>
            {store.busy
              ? "Submitting…"
              : item.state === "returned"
                ? "Submit revised work"
                : "Submit work"}
            <ArrowRight />
          </Button>
        </form>
      )}
      {teacher && item.state === "submitted" && (
        <form
          className="school-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await store.mutate(`/school/assignments/${item.id}/feedback`, {
                feedback: feedback.trim(),
                return_for_revision: revision,
              })
            )
              setFeedback("");
          }}
        >
          <label htmlFor={`feedback-${item.id}`}>
            Feedback
            <Textarea
              id={`feedback-${item.id}`}
              rows={3}
              required
              maxLength={8000}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
          <label className="school-check">
            <input
              type="checkbox"
              checked={revision}
              onChange={(event) => setRevision(event.target.checked)}
            />
            Ask for another attempt
          </label>
          <Button type="submit" disabled={store.busy || !feedback.trim()}>
            {store.busy ? "Saving…" : "Send feedback"}
            <Send />
          </Button>
        </form>
      )}
    </article>
  );
}
function PublishLesson({ store }: { store: Store }) {
  const [student, setStudent] = useState("");
  const [lesson, setLesson] = useState("");
  return (
    <details className="school-panel school-create">
      <summary>
        <Plus />
        Share a lesson
      </summary>
      <form
        className="school-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await store.mutate("/school/publications", {
              student_id: student,
              lesson_id: lesson,
            })
          )
            setLesson("");
        }}
      >
        <p>
          Sharing makes this lesson available in the student’s study library.
          Their study conversations stay private.
        </p>
        <div className="school-form-grid">
          <SelectPeople
            label="Student"
            people={store.data.people.filter(
              (person) =>
                person.relationship === "student" &&
                person.responsibilities?.includes("teacher"),
            )}
            value={student}
            setValue={setStudent}
          />
          <label>
            Prepared lesson
            <select
              required
              value={lesson}
              onChange={(event) => setLesson(event.target.value)}
            >
              <option value="">Choose a lesson</option>
              {store.lessons
                .filter((lesson) => lesson.owned && lesson.state === "ready")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {!store.lessons.length && (
          <p>
            No prepared lessons yet.{" "}
            <Link className="school-text-link" href="/study?materials=1">
              Prepare a lesson for your students
            </Link>
            .
          </p>
        )}
        <Button disabled={store.busy || !student || !lesson} type="submit">
          {store.busy ? "Sharing…" : "Share lesson"}
          <ArrowRight />
        </Button>
      </form>
    </details>
  );
}
function Unpublish({ id, store }: { id: string; store: Store }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="school-inline-actions">
      <span>Remove this shared lesson?</span>
      <Button
        size="sm"
        variant="outline"
        disabled={store.busy}
        onClick={() =>
          void store.mutate(`/school/publications/${id}`, undefined, "DELETE")
        }
      >
        Remove sharing
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
      Stop sharing
    </Button>
  );
}
function CreateProposal({ store }: { store: Store }) {
  const [advisor, setAdvisor] = useState("");
  const [parent, setParent] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  return (
    <details className="school-panel school-create">
      <summary>
        <Plus />
        Bring an idea to your advisor
      </summary>
      <form
        className="school-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await store.mutate("/school/proposals", {
              student_id: store.data.account_id,
              advisor_id: advisor,
              parent_id: parent || null,
              title: title.trim(),
              description: description.trim(),
            })
          ) {
            setTitle("");
            setDescription("");
          }
        }}
      >
        <div className="school-form-grid">
          <SelectPeople
            label="Advisor"
            people={store.data.people.filter(
              (person) => person.relationship === "advisor",
            )}
            value={advisor}
            setValue={setAdvisor}
          />
          <SelectPeople
            label="Parent decision"
            optional={
              !store.data.people.some(
                (person) => person.relationship === "parent",
              )
            }
            people={store.data.people.filter(
              (person) => person.relationship === "parent",
            )}
            value={parent}
            setValue={setParent}
          />
        </div>
        <label>
          Proposal title
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label htmlFor="proposal-idea">
          Your idea
          <Textarea
            id="proposal-idea"
            required
            rows={4}
            maxLength={8000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <Button
          disabled={
            store.busy ||
            !advisor ||
            !title.trim() ||
            !description.trim() ||
            (store.data.people.some(
              (person) => person.relationship === "parent",
            ) &&
              !parent)
          }
          type="submit"
        >
          {store.busy ? "Sending…" : "Send to advisor"}
          <ArrowRight />
        </Button>
      </form>
    </details>
  );
}
function ProposalCard({
  proposal: item,
  store,
  name,
}: {
  proposal: Proposal;
  store: Store;
  name: (id: string) => string;
}) {
  const own = store.data.account_id;
  const reviewing = item.advisor_id === own && item.state === "pending_advisor";
  const deciding = item.parent_id === own && item.state === "pending_parent";
  const revising =
    item.student_id === own && item.state === "revision_requested";
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("approve");
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  return (
    <article className="school-panel school-proposal">
      <div className="school-card-heading">
        <div>
          <p className="eyebrow">
            {name(item.student_id)} · Advisor: {name(item.advisor_id)}
            {item.parent_id ? ` · Parent: ${name(item.parent_id)}` : ""}
          </p>
          <h2>{item.title}</h2>
        </div>
        <span className="school-status">{readable(item.state)}</span>
      </div>
      <p className="school-prose">{item.description}</p>
      <ol className="school-decision-path" aria-label="Decision steps">
        <li>Student’s proposal</li>
        <li>Advisor review</li>
        {item.parent_id && <li>Parent decision</li>}
      </ol>
      {item.advisor_note && (
        <div className="school-saved-work">
          <h3>Advisor note</h3>
          <p className="school-prose">{item.advisor_note}</p>
        </div>
      )}
      {item.parent_note && (
        <div className="school-saved-work">
          <h3>Parent note</h3>
          <p className="school-prose">{item.parent_note}</p>
        </div>
      )}
      {(reviewing || deciding) && (
        <form
          className="school-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await store.mutate(
                `/school/proposals/${item.id}/${reviewing ? "review" : "decision"}`,
                { decision, note: note.trim() },
              )
            )
              setNote("");
          }}
        >
          <div className="school-form-grid">
            <label>
              {reviewing ? "Advisor decision" : "Parent decision"}
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
              >
                <option value="approve">Approve</option>
                {reviewing && <option value="revise">Ask for changes</option>}
                <option value="decline">Decline</option>
              </select>
            </label>
            <label htmlFor={`decision-${item.id}`}>
              Decision note
              <Textarea
                id={`decision-${item.id}`}
                required
                rows={2}
                maxLength={4000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
          <Button type="submit" disabled={store.busy || !note.trim()}>
            {store.busy ? "Saving…" : "Save decision"}
            <Check />
          </Button>
        </form>
      )}
      {revising && (
        <form
          className="school-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await store.mutate(
              `/school/proposals/${item.id}`,
              { title: title.trim(), description: description.trim() },
              "PUT",
            );
          }}
        >
          <label>
            Revised title
            <input
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label htmlFor={`revision-${item.id}`}>
            Revised idea
            <Textarea
              id={`revision-${item.id}`}
              required
              rows={3}
              maxLength={8000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={store.busy || !title.trim() || !description.trim()}
          >
            Send revision to advisor
            <ArrowRight />
          </Button>
        </form>
      )}
    </article>
  );
}
