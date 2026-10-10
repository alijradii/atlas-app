"use client";

import { Button } from "@school2036/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardList,
  GitBranch,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { Brand } from "../pearl";
import { TaskArt } from "../preview/task-art";
import { ThemeToggle } from "../theme-toggle";
import type {
  Assignment,
  Person,
  Proposal,
  Workspace as WorkspaceData,
} from "./types";
import { useWorkspace } from "./use-workspace";
import "./workspace.css";

type Store = Omit<ReturnType<typeof useWorkspace>, "data"> & {
  data: WorkspaceData;
};
type Tab = "work" | "lessons" | "advisor" | "choices";
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

export default function WorkspaceApp() {
  const store = useWorkspace();
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
    <>
      {store.checking && (
        <p className="school-session-check" role="status">
          Refreshing your workspace…
        </p>
      )}
      <div hidden={store.checking}>
        <Workspace
          key={store.session.account_id}
          store={{ ...store, data: store.data }}
        />
      </div>
    </>
  );
}
function Workspace({ store }: { store: Store }) {
  const [selectedTab, setTab] = useState<Tab>("work");
  const data = store.data;
  const has = (role: WorkspaceData["roles"][number]) =>
    data.roles.includes(role);
  const name = (id: string) =>
    id === data.account_id
      ? "You"
      : (data.people.find((person) => person.account_id === id)?.name ??
        "Connected person");
  const actionable = data.assignments.filter(
    (item) =>
      (item.student_id === data.account_id &&
        ["assigned", "returned"].includes(item.state)) ||
      (item.teacher_id === data.account_id && item.state === "submitted"),
  );
  const pending = data.proposals.filter(
    (item) =>
      (item.advisor_id === data.account_id &&
        item.state === "pending_advisor") ||
      (item.parent_id === data.account_id && item.state === "pending_parent") ||
      (item.student_id === data.account_id &&
        item.state === "revision_requested"),
  );
  const allowed: Record<Tab, boolean> = {
    work: has("student") || has("teacher") || has("parent"),
    lessons: has("student") || has("teacher"),
    advisor: has("student") || has("advisor"),
    choices: has("student") || has("advisor") || has("parent"),
  };
  const tabs = [
    { id: "work" as const, label: "Schoolwork", Icon: ClipboardList },
    { id: "lessons" as const, label: "Shared lessons", Icon: BookOpen },
    {
      id: "advisor" as const,
      label: "Advisor conversations",
      Icon: MessageCircle,
    },
    { id: "choices" as const, label: "Plans & decisions", Icon: GitBranch },
  ].filter((item) => allowed[item.id]);
  const tab = tabs.find((item) => item.id === selectedTab)?.id ?? tabs[0]?.id;
  return (
    <div className="school-app">
      <header className="school-header">
        <Brand />
        <nav aria-label="Your spaces">
          <Link href="/study">Study agent</Link>
          <Link href="/files">Your files</Link>
          <Link href="/account">Account</Link>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Refresh workspace"
            disabled={store.busy}
            onClick={store.refresh}
          >
            <RefreshCw />
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            disabled={store.busy}
            onClick={() => void store.signOut()}
          >
            <LogOut />
            <span>Sign out</span>
          </Button>
        </nav>
      </header>
      <main id="main-content" className="school-main">
        <section className="school-welcome">
          <div>
            <p className="eyebrow">
              {data.roles.length ? data.roles.join(" · ") : "Your account"}
            </p>
            <h1>Good to see you, {data.name.split(" ")[0]}.</h1>
            <p>
              {actionable.length + pending.length
                ? `${actionable.length + pending.length} ${actionable.length + pending.length === 1 ? "thing needs" : "things need"} your attention. Pick up where you left off.`
                : "A little space to learn, keep in touch and plan what comes next."}
            </p>
            <Button asChild>
              <Link href="/study">
                Open your study space <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="school-welcome-art">
            <TaskArt kind="practice" />
          </div>
        </section>
        {store.error && (
          <div className="school-error" role="alert">
            {store.error}
            <Button variant="ghost" size="sm" onClick={store.refresh}>
              <RefreshCw />
              Retry
            </Button>
          </div>
        )}
        {!data.roles.length && (
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
        {tabs.length > 0 && (
          <>
            <div
              className="school-tabs"
              role="tablist"
              aria-label="Workspace sections"
            >
              {tabs.map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const index = tabs.findIndex((item) => item.id === id);
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              tabs.length) %
                            tabs.length;
                    setTab(tabs[next].id);
                    document.getElementById(`tab-${tabs[next].id}`)?.focus();
                  }}
                  onClick={() => setTab(id)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
            <section
              key={tab}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              className="school-content"
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
                <>
                  <SectionHeading
                    title="Lessons, shared with care"
                    description="These lessons connect directly to your study library. Study privately, at home or wherever you are."
                  />
                  {has("teacher") && <PublishLesson store={store} />}
                  {!data.publications.length && (
                    <Empty
                      icon={<BookOpen />}
                      title="No shared lessons yet"
                      text={
                        has("teacher")
                          ? "Prepare a lesson in your study space, then share it with a connected student."
                          : "Your teacher’s shared lessons will appear here and in your study library."
                      }
                    />
                  )}
                  <div className="school-card-list">
                    {data.publications.map((item) => (
                      <article
                        className="school-panel school-publication"
                        key={item.id}
                      >
                        <BookOpen />
                        <div>
                          <p className="eyebrow">{item.subject || "Lesson"}</p>
                          <h3>{item.title}</h3>
                          <p>
                            {name(item.teacher_id)} → {name(item.student_id)} ·{" "}
                            {date(item.created)}
                          </p>
                        </div>
                        {item.student_id === data.account_id ||
                        item.teacher_id === data.account_id ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href="/study">
                              Open study library <ArrowRight />
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
              )}
              {tab === "advisor" && <Advisor store={store} name={name} />}
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
          </>
        )}
        <footer className="school-footer">
          <Users />
          <span>
            {data.people.length} connected{" "}
            {data.people.length === 1 ? "person" : "people"}
          </span>
          <span>Your access follows your account, wherever you learn.</span>
        </footer>
      </main>
    </div>
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
      <h2>{title}</h2>
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
      <h3>{title}</h3>
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
        <label>
          Instructions
          <textarea
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
              {store.lessons.map((item) => (
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
          <h3>{item.title}</h3>
        </div>
        <span className="school-status">{readable(item.state)}</span>
      </div>
      <p className="school-prose">{item.instructions}</p>
      {item.lesson_id && (own || teacher) && (
        <Link className="school-text-link" href="/study">
          <BookOpen />
          Study the related lesson
        </Link>
      )}
      {item.answer && (
        <div className="school-saved-work">
          <h4>Submitted work</h4>
          <p className="school-prose">{item.answer}</p>
        </div>
      )}
      {item.feedback && (
        <div className="school-feedback">
          <Check />
          <div>
            <h4>Teacher feedback</h4>
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
          <label>
            Your answer
            <textarea
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
          <label>
            Feedback
            <textarea
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
              {store.lessons.map((item) => (
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
            <Link className="school-text-link" href="/study">
              Add a lesson in your study space
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
function Advisor({
  store,
  name,
}: {
  store: Store;
  name: (id: string) => string;
}) {
  const data = store.data;
  const isAdvisor = data.roles.includes("advisor");
  const peers = data.people.filter((person) =>
    isAdvisor
      ? person.relationship === "student" &&
        Boolean(person.responsibilities?.includes("advisor"))
      : person.relationship === "advisor",
  );
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const person = peers.find((item) => item.account_id === selected) ?? peers[0];
  const student = isAdvisor ? person?.account_id : data.account_id;
  const advisor = isAdvisor ? data.account_id : person?.account_id;
  const messages = data.messages.filter(
    (item) => item.student_id === student && item.advisor_id === advisor,
  );
  return (
    <>
      <SectionHeading
        title={
          isAdvisor
            ? "Keep the conversation going"
            : "Your advisor is a conversation away"
        }
        description="A direct conversation with a person. Your private study chats are separate."
      />
      {!person ? (
        <Empty
          icon={<MessageCircle />}
          title="No advisor conversation yet"
          text="Your administrator connects students and advisors. Conversations are visible only to the student and their advisor."
        />
      ) : (
        <section className="school-panel school-conversation">
          <div className="school-conversation-heading">
            <SelectPeople
              label={isAdvisor ? "Student" : "Advisor"}
              people={peers}
              value={person.account_id}
              setValue={(value) => {
                setSelected(value);
                setDraft("");
              }}
            />
          </div>
          <div
            role="log"
            aria-label="Advisor messages"
            className="school-messages"
          >
            {messages.length ? (
              messages.map((item) => (
                <article
                  key={item.id}
                  className={`school-message ${item.sender_id === data.account_id ? "school-message-own" : ""}`}
                >
                  <p className="eyebrow">
                    {name(item.sender_id)} · {date(item.created)}
                  </p>
                  <p className="school-prose">{item.content}</p>
                </article>
              ))
            ) : (
              <p className="school-empty-copy">
                Start with a question, an update, or something you are thinking
                about.
              </p>
            )}
          </div>
          <form
            className="school-form school-reply"
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
            <label>
              Message to {person.name}
              <textarea
                required
                rows={3}
                maxLength={4000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What’s on your mind?"
              />
            </label>
            <Button disabled={store.busy || !draft.trim()} type="submit">
              {store.busy ? "Sending…" : "Send message"}
              <Send />
            </Button>
          </form>
        </section>
      )}
    </>
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
        <label>
          Your idea
          <textarea
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
          <h3>{item.title}</h3>
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
          <h4>Advisor note</h4>
          <p className="school-prose">{item.advisor_note}</p>
        </div>
      )}
      {item.parent_note && (
        <div className="school-saved-work">
          <h4>Parent note</h4>
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
            <label>
              Decision note
              <textarea
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
          <label>
            Revised idea
            <textarea
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
