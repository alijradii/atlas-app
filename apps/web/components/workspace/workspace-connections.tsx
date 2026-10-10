"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Textarea } from "@school2036/ui";
import {
  ArrowUpRight,
  CalendarDays,
  Compass,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "../pearl";
import type { Session, Workspace } from "./types";
import "./workspace-connections.css";

type Interest = components["schemas"]["ActivityInterestView"];
type Activity = components["schemas"]["ActivityRequestView"];
type CalendarEvent = components["schemas"]["SchoolEventView"];
type Board = {
  interests: Interest[];
  requests: Activity[];
  events: CalendarEvent[];
};

export function WorkspaceConnections(props: {
  data: Workspace;
  session: Session;
}) {
  return <Connections key={props.session.account_id} {...props} />;
}

function Connections({ data, session }: { data: Workspace; session: Session }) {
  const student = data.roles.includes("student");
  const teacher = data.roles.includes("teacher");
  const teachers = data.people.filter(
    (person) =>
      person.relationship === "teacher" ||
      person.responsibilities?.includes("teacher"),
  );
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes the authorized board after writes.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      read.current?.abort();
      const controller = new AbortController();
      read.current = controller;
      setLoading(true);
      setError("");
      try {
        const [interests, requests, events] = await Promise.all([
          api<Interest[]>(
            "/school/activity-interests",
            "GET",
            undefined,
            undefined,
            controller.signal,
          ),
          api<Activity[]>(
            "/school/activity-requests",
            "GET",
            undefined,
            undefined,
            controller.signal,
          ),
          api<CalendarEvent[]>(
            "/school/events",
            "GET",
            undefined,
            undefined,
            controller.signal,
          ),
        ]);
        const current = await api<Session>(
          "/auth/me",
          "GET",
          undefined,
          undefined,
          controller.signal,
        );
        if (!alive || controller.signal.aborted) return;
        if (current.account_id !== session.account_id) {
          setBoard(null);
          setError("Your account changed. Reopen your workspace to continue.");
          return;
        }
        setBoard({ interests, requests, events });
      } catch (cause) {
        if (alive && !controller.signal.aborted) {
          if (
            cause instanceof ApiError &&
            (cause.status === 401 || cause.status === 403)
          )
            setBoard(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to open connections.",
          );
        }
      } finally {
        if (alive && !controller.signal.aborted) setLoading(false);
      }
    };
    const resume = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 80);
    };
    void load();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false;
      clearTimeout(timer);
      read.current?.abort();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [session.account_id, revision]);
  // Each account gets fresh private UI state and cannot finish another account's write.
  // biome-ignore lint/correctness/useExhaustiveDependencies: account changes invalidate mutations and local feedback.
  useEffect(() => {
    setBoard(null);
    setNotice("");
    setBusy(false);
    return () => {
      write.current?.abort();
      write.current = null;
    };
  }, [session.account_id]);

  async function mutate(
    path: string,
    body: unknown,
    method = "POST",
    message = "Saved.",
  ) {
    if (write.current) return false;
    const controller = new AbortController();
    write.current = controller;
    setBusy(true);
    setPendingLabel(
      path.endsWith("/suggest")
        ? "Atlas is shaping an activity from your group’s shared interest…"
        : "Saving your changes…",
    );
    setError("");
    setNotice("");
    try {
      await api(path, method, body, session.csrf, controller.signal);
      if (controller.signal.aborted) return false;
      setNotice(message);
      refresh();
      return true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (
          cause instanceof ApiError &&
          (cause.status === 401 || cause.status === 403)
        )
          setBoard(null);
        setError(
          cause instanceof Error ? cause.message : "Could not save. Try again.",
        );
      }
      return false;
    } finally {
      if (write.current === controller) {
        write.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section className="connections-page" data-guide-anchor="connections.list">
      <PageHeading
        title="Find your people"
        description={
          student
            ? "Turn a shared curiosity into something you can do together."
            : teacher
              ? "Make room for the interests your students share."
              : "Follow the interests and activities your student chooses to share."
        }
      />
      <div className="connections-intro school-panel">
        <Compass aria-hidden="true" />
        <div>
          <p className="eyebrow">A little curiosity can go a long way</p>
          <h2>Shared interests. Real connections.</h2>
          <p>
            Students suggest ideas and show interest. Teachers organize the
            activities, and everyone involved can follow along.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/workspace?section=events">
            <CalendarDays />
            See events
          </Link>
        </Button>
      </div>
      {error && (
        <div role="alert" className="connections-feedback">
          <p>{error}</p>
          <Button
            onClick={refresh}
            variant="outline"
            disabled={busy || loading}
          >
            Try again
          </Button>
        </div>
      )}
      {busy && (
        <p role="status" className="connections-pending">
          <Sparkles aria-hidden="true" />
          {pendingLabel}
        </p>
      )}
      {notice && (
        <p role="status" className="connections-notice">
          {notice}
        </p>
      )}
      {!board && loading && <p role="status">Opening your connections…</p>}
      {student && (
        <div className="connections-forms" key={session.account_id}>
          <details className="school-panel school-create">
            <summary>
              <Plus />
              Share an interest
            </summary>
            <form
              className="school-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const fields = new FormData(form);
                if (
                  await mutate(
                    "/school/activity-interests",
                    {
                      teacher_id: fields.get("teacher_id"),
                      topic: fields.get("topic"),
                      interested: true,
                    },
                    "PUT",
                    "Your interest is shared with this teacher’s group.",
                  )
                )
                  form.reset();
              }}
            >
              <label>
                Teacher’s group
                <select
                  name="teacher_id"
                  required
                  disabled={busy || !teachers.length}
                >
                  {teachers.map((person) => (
                    <option key={person.account_id} value={person.account_id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Interest topic
                <input
                  name="topic"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Robotics, creative writing, astronomy…"
                />
              </label>
              <p>
                Only topics you choose to share count toward group suggestions.
                Your private conversations stay private.
              </p>
              {!teachers.length && (
                <p>No teacher is linked to your account yet.</p>
              )}
              <Button disabled={busy || !teachers.length}>
                Share interest
              </Button>
            </form>
          </details>
          <details className="school-panel school-create">
            <summary>
              <Plus />
              Request an activity
            </summary>
            <form
              className="school-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const fields = new FormData(form);
                if (
                  await mutate(
                    "/school/activity-requests",
                    Object.fromEntries(fields),
                    "POST",
                    "Your request is on the board. Your teacher will review it.",
                  )
                )
                  form.reset();
              }}
            >
              <label>
                Organizing teacher
                <select
                  name="teacher_id"
                  required
                  disabled={busy || !teachers.length}
                >
                  {teachers.map((person) => (
                    <option key={person.account_id} value={person.account_id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Activity topic
                <input name="topic" required minLength={2} maxLength={80} />
              </label>
              <label>
                Activity title
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="An afternoon building tiny robots"
                />
              </label>
              <label htmlFor="activity-description">
                Your idea
                <Textarea
                  id="activity-description"
                  name="description"
                  maxLength={2000}
                  placeholder="What would you like to do together?"
                />
              </label>
              <p>
                Requesting an activity also adds your interest to it. Your
                teacher decides how and when it can happen.
              </p>
              <Button disabled={busy || !teachers.length}>
                Send activity request
              </Button>
            </form>
          </details>
        </div>
      )}
      <section
        className="connections-section"
        aria-labelledby="connections-topics"
      >
        <div className="connections-section-heading">
          <h2 id="connections-topics">What brings us together</h2>
          <span>
            {board?.interests.length ?? 0}{" "}
            {board?.interests.length === 1 ? "topic" : "topics"}
          </span>
        </div>
        {board?.interests.length === 0 && (
          <div className="connections-empty">
            <Users />
            <p>
              {student
                ? "Share a hobby or a question you would love to explore with others."
                : "Shared interests will appear when students opt in to a topic."}
            </p>
          </div>
        )}
        {teacher && (
          <p className="connections-explanation">
            With at least 3 students opting into a topic, ask Atlas for an
            activity idea. You review it before making any plans.
          </p>
        )}
        <div className="connections-topics">
          {board?.interests.map((interest) => (
            <article
              className="school-panel connections-topic"
              key={`${interest.teacher_id}:${interest.topic}`}
            >
              <p className="eyebrow">{interest.organizer_name}’s group</p>
              <h3>{interest.topic}</h3>
              <p>
                <Users />
                {interest.interested_count}{" "}
                {interest.interested_count === 1 ? "student" : "students"}{" "}
                interested{interest.joined ? " · Including you" : ""}
              </p>
              {student && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "/school/activity-interests",
                      {
                        teacher_id: interest.teacher_id,
                        topic: interest.topic,
                        interested: !interest.joined,
                      },
                      "PUT",
                      interest.joined
                        ? "You stopped sharing this interest."
                        : "Your interest has been added.",
                    )
                  }
                >
                  {interest.joined ? "Withdraw interest" : "I’m interested too"}
                </Button>
              )}
              {teacher && interest.teacher_id === session.account_id && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy || !interest.can_suggest}
                    onClick={() =>
                      void mutate(
                        "/school/activity-requests/suggest",
                        { topic: interest.topic },
                        "POST",
                        "Atlas’s suggestion is ready for review on the activity board.",
                      )
                    }
                  >
                    <Sparkles />
                    Suggest an activity
                  </Button>
                  {!interest.can_suggest && (
                    <small>
                      Needs 3 students to opt in · {interest.interested_count}{" "}
                      so far
                    </small>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      </section>
      <section
        className="connections-section"
        aria-labelledby="connections-board"
      >
        <div className="connections-section-heading">
          <h2 id="connections-board">The activity board</h2>
          <span>
            {board?.requests.filter((request) => request.state === "pending")
              .length ?? 0}{" "}
            awaiting review
          </span>
        </div>
        {board?.requests.length === 0 && (
          <div className="connections-empty">
            <Compass />
            <p>
              {student
                ? "Have an idea? Start an activity request and let your group join in."
                : "Student requests and Atlas suggestions will appear here for review."}
            </p>
          </div>
        )}
        <div className="school-card-list">
          {board?.requests.map((request) => (
            <article
              key={request.id}
              className="school-panel connections-request"
              aria-label={request.title}
            >
              <div className="school-card-heading">
                <div>
                  <p className="eyebrow">
                    {request.topic} ·{" "}
                    {request.source === "ai"
                      ? "Suggested by Atlas"
                      : "Student request"}
                  </p>
                  <h3>{request.title}</h3>
                </div>
                <span className="school-status">
                  {request.state === "pending"
                    ? "Awaiting teacher"
                    : request.state === "accepted"
                      ? board.events.some(
                          (event) =>
                            event.id === request.event_id &&
                            event.state === "cancelled",
                        )
                        ? "Event cancelled"
                        : "Planned"
                      : "Not going ahead"}
                </span>
              </div>
              <p className="school-prose">{request.description}</p>
              <div className="connections-request-meta">
                <span>
                  <Users />
                  {request.interested_count} interested
                  {request.joined ? " · Including you" : ""}
                </span>
                <span>Organized by {request.organizer_name}</span>
              </div>
              {request.source === "ai" && (
                <p className="connections-explanation">
                  Suggested from {request.evidence_count} students’ shared topic
                  interests. Joining this activity is a separate choice.
                </p>
              )}
              {request.teacher_note && (
                <p className="connections-teacher-note">
                  <strong>Teacher’s note</strong>
                  {request.teacher_note}
                </p>
              )}
              {request.event_id &&
                board.events.some((event) => event.id === request.event_id) && (
                  <Button asChild variant="outline">
                    <Link href="/workspace?section=events">
                      <CalendarDays />
                      View planned event
                      <ArrowUpRight />
                    </Link>
                  </Button>
                )}
              {request.can_join && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    void mutate(
                      `/school/activity-requests/${request.id}/interest`,
                      { interested: !request.joined },
                      "PUT",
                      request.joined
                        ? "You withdrew from this activity request."
                        : "Your interest is added to the activity request.",
                    )
                  }
                >
                  {request.joined
                    ? "Withdraw from request"
                    : "Join this request"}
                </Button>
              )}
              {request.can_manage && request.state === "pending" && (
                <RequestReview
                  request={request}
                  events={board.events}
                  busy={busy}
                  mutate={mutate}
                />
              )}
            </article>
          ))}
        </div>
      </section>
      <section
        className="connections-section"
        aria-labelledby="connections-people"
      >
        <div className="connections-section-heading">
          <h2 id="connections-people">Your support circle</h2>
        </div>
        <p className="connections-explanation">
          The people already linked to your account. Peer interests above show
          shared counts, not private student profiles.
        </p>
        <div className="connections-people">
          {data.people.map((person) => (
            <div key={person.account_id}>
              <Users />
              <div>
                <strong>{person.name}</strong>
                <p>
                  {person.responsibilities?.length
                    ? person.responsibilities.join(" · ")
                    : person.relationship}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!data.people.length && <p>No linked people yet.</p>}
      </section>
    </section>
  );
}

function RequestReview({
  request,
  events,
  busy,
  mutate,
}: {
  request: Activity;
  events: CalendarEvent[];
  busy: boolean;
  mutate: (
    path: string,
    body: unknown,
    method?: string,
    message?: string,
  ) => Promise<boolean>;
}) {
  const eligible = events.filter(
    (event) =>
      event.can_manage &&
      event.state === "scheduled" &&
      request.participant_ids.every((id) => event.student_ids.includes(id)),
  );
  const [eventId, setEventId] = useState("");
  const [note, setNote] = useState("");
  const selected = eligible.some((event) => event.id === eventId);
  return (
    <details className="connections-review">
      <summary>Review request</summary>
      <div className="school-form">
        <label htmlFor={`review-note-${request.id}`}>
          Teacher’s response
          <Textarea
            id={`review-note-${request.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            placeholder="Tell the group what comes next."
          />
        </label>
        <label>
          Scheduled event
          <select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">Choose an event</option>
            {eligible.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {new Date(event.starts_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <p>
          The event must include everyone who joined this request.{" "}
          <Link href="/workspace?section=events">
            Create or update an event
          </Link>{" "}
          first.
        </p>
        <div className="connections-actions">
          <Button
            disabled={busy || !selected}
            onClick={() =>
              void mutate(
                `/school/activity-requests/${request.id}`,
                { state: "accepted", teacher_note: note, event_id: eventId },
                "PATCH",
                "Request accepted and linked to the event.",
              )
            }
          >
            Accept and link event
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void mutate(
                `/school/activity-requests/${request.id}`,
                { state: "declined", teacher_note: note },
                "PATCH",
                "Your response has been saved.",
              )
            }
          >
            Decline request
          </Button>
        </div>
      </div>
    </details>
  );
}
