"use client";

import { ApiError, api, type components } from "@school2036/api-client";
import { Button, Textarea } from "@school2036/ui";
import { CalendarDays, Clock3, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "../pearl";
import type { Session, Workspace } from "./types";
import "./workspace-events.css";

type SchoolEvent = components["schemas"]["SchoolEventView"];
type EventInput = components["schemas"]["SchoolEventInput"];
type Filter = "upcoming" | "past" | "cancelled";

export function WorkspaceEvents(props: { data: Workspace; session: Session }) {
  return <Events key={props.session.account_id} {...props} />;
}

function Events({ data, session }: { data: Workspace; session: Session }) {
  const [events, setEvents] = useState<SchoolEvent[] | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const reads = useRef<AbortController | null>(null);
  const writes = useRef<AbortController | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const teacher = data.roles.includes("teacher");
  const students = data.people.filter(
    (person) =>
      person.relationship === "student" &&
      person.responsibilities?.includes("teacher"),
  );
  const refresh = useCallback(async () => {
    reads.current?.abort();
    const controller = new AbortController();
    reads.current = controller;
    try {
      const next = await api<SchoolEvent[]>(
        "/school/events",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      const current = await api<Session>(
        "/auth/me",
        "GET",
        undefined,
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (current.account_id !== session.account_id) {
        setEvents(null);
        setExpired(true);
        return;
      }
      setEvents(next);
      setError("");
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        setEvents(null);
        setExpired(true);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Your events could not be loaded.",
      );
    }
  }, [session.account_id]);
  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resume = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") {
        timer = setTimeout(() => {
          if (!writes.current) void refresh();
        }, 100);
      }
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      reads.current?.abort();
      writes.current?.abort();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);

  async function save(body: EventInput | { state: "cancelled" }, id?: string) {
    if (writes.current || expired) return false;
    reads.current?.abort();
    const controller = new AbortController();
    writes.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api<SchoolEvent>(
        `/school/events${id ? `/${id}` : ""}`,
        id ? "PATCH" : "POST",
        body,
        session.csrf,
        controller.signal,
      );
      if (controller.signal.aborted) return false;
      setEvents((current) => [
        ...(current ?? []).filter((event) => event.id !== saved.id),
        saved,
      ]);
      setNotice(
        saved.state === "cancelled"
          ? "Event cancelled. Everyone invited can see the update."
          : id
            ? "Event updated."
            : "Event created and shared with the invited students and their linked adults.",
      );
      setCreating(false);
      setEditing(null);
      setConfirmation(null);
      if (!id)
        setFilter(
          new Date(saved.ends_at).getTime() < Date.now() ? "past" : "upcoming",
        );
      return true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
          setEvents(null);
          setExpired(true);
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "The event could not be saved. Your draft is still here.",
        );
      }
      return false;
    } finally {
      if (writes.current === controller) writes.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const now = Date.now();
  const visible = (events ?? [])
    .filter((event) =>
      filter === "cancelled"
        ? event.state === "cancelled"
        : event.state !== "cancelled" &&
          (filter === "past"
            ? new Date(event.ends_at).getTime() < now
            : new Date(event.ends_at).getTime() >= now),
    )
    .sort(
      (a, b) =>
        (filter === "past" ? -1 : 1) *
        (new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    );
  return (
    <section className="pearl-events" data-guide-anchor="events.list">
      <div className="pearl-events-heading">
        <PageHeading
          title="Time together"
          description={
            teacher
              ? "Bring shared interests into real activities. Plan a time, invite your students, and keep everyone in the loop."
              : "Activities, conversations and things to look forward to, organized by your teachers."
          }
        />
        {teacher && !expired && (
          <Button
            ref={createButton}
            data-guide-anchor="events.manage"
            disabled={busy}
            onClick={() => {
              setCreating((value) => !value);
              setEditing(null);
            }}
            aria-expanded={creating}
          >
            <Plus />
            Create an event
          </Button>
        )}
      </div>
      <p className="pearl-events-context">
        <CalendarDays aria-hidden="true" />
        Times shown in your local time zone ·{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      {error && (
        <div className="school-error" role="alert">
          <span>{error}</span>
          {!expired && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {expired ? (
        <div className="school-panel">
          <p>
            Your account access has changed. Reopen your workspace to continue.
          </p>
          <Button asChild variant="outline">
            <Link href="/workspace">Open workspace</Link>
          </Button>
        </div>
      ) : (
        <>
          {notice && (
            <p role="status" className="pearl-events-notice">
              {notice}
            </p>
          )}
          {creating && (
            <div className="school-panel pearl-event-editor">
              <h2>Create an event</h2>
              <EventForm
                students={students}
                busy={busy}
                onSave={(input) => save(input)}
                onClose={() => {
                  setCreating(false);
                  createButton.current?.focus();
                }}
              />
            </div>
          )}
          <fieldset className="pearl-event-filters" aria-label="Filter events">
            {(["upcoming", "past", "cancelled"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </fieldset>
          {!events && !error && (
            <p role="status" className="school-empty">
              Opening your calendar…
            </p>
          )}
          {events && visible.length === 0 && (
            <div className="school-panel school-empty">
              <CalendarDays />
              <h2>
                {filter === "upcoming"
                  ? "Room for something good"
                  : `No ${filter} events`}
              </h2>
              <p>
                {filter === "upcoming"
                  ? teacher
                    ? "Plan a shared activity, or review your students’ ideas in Connections."
                    : "When a teacher invites you or your linked student to an activity, you’ll find the details here."
                  : "Your calendar keeps the details here when plans change or an activity ends."}
              </p>
              <Link
                className="school-text-link"
                href="/workspace?section=connections"
              >
                Explore connections and interests
              </Link>
            </div>
          )}
          <div className="school-card-list">
            {visible.map((event) => {
              const start = new Date(event.starts_at);
              return (
                <article
                  key={event.id}
                  className="school-panel pearl-event"
                  aria-label={event.title}
                >
                  <div className="pearl-event-date" aria-hidden="true">
                    <span>
                      {start.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <strong>{start.getDate()}</strong>
                    <span>
                      {start.toLocaleDateString(undefined, {
                        weekday: "short",
                      })}
                    </span>
                  </div>
                  <div className="pearl-event-body">
                    <div className="school-card-heading">
                      <div>
                        <p className="eyebrow">
                          Organized by {event.organizer_name}
                        </p>
                        <h2>{event.title}</h2>
                      </div>
                      {event.state === "cancelled" && (
                        <span className="school-status">Cancelled</span>
                      )}
                    </div>
                    <div className="pearl-event-meta">
                      <span>
                        <Clock3 />
                        <time dateTime={event.starts_at}>
                          {start.toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>{" "}
                        —{" "}
                        <time dateTime={event.ends_at}>
                          {new Date(event.ends_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </span>
                      {event.location && (
                        <span>
                          <MapPin />
                          {event.location}
                        </span>
                      )}
                      <span>
                        <Users />
                        {event.can_manage
                          ? `${event.student_ids.length} student${event.student_ids.length === 1 ? "" : "s"} invited`
                          : data.roles.includes("student")
                            ? "You’re invited"
                            : "For your linked students"}
                      </span>
                    </div>
                    {event.description && (
                      <p className="school-prose">{event.description}</p>
                    )}
                    {event.can_manage && event.state !== "cancelled" && (
                      <div className="school-inline-actions pearl-event-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          aria-expanded={editing === event.id}
                          onClick={() => {
                            setEditing(editing === event.id ? null : event.id);
                            setCreating(false);
                          }}
                        >
                          Edit event
                        </Button>
                        {confirmation === event.id ? (
                          <>
                            <span>Cancel this event for everyone invited?</span>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void save({ state: "cancelled" }, event.id)
                              }
                            >
                              {busy ? "Cancelling…" : "Confirm cancellation"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setConfirmation(null)}
                            >
                              Keep event
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setConfirmation(event.id)}
                          >
                            Cancel event
                          </Button>
                        )}
                      </div>
                    )}
                    {editing === event.id && (
                      <EventForm
                        key={event.id}
                        event={event}
                        students={students}
                        busy={busy}
                        onSave={(input) => save(input, event.id)}
                        onClose={() => setEditing(null)}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function localDate(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function EventForm({
  event,
  students,
  busy,
  onSave,
  onClose,
}: {
  event?: SchoolEvent;
  students: Workspace["people"];
  busy: boolean;
  onSave: (input: EventInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [start, setStart] = useState(event ? localDate(event.starts_at) : "");
  const [end, setEnd] = useState(event ? localDate(event.ends_at) : "");
  const [selected, setSelected] = useState(event?.student_ids ?? []);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const id = event?.id ?? "new";
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <form
      className="school-form"
      aria-label={event ? "Edit event" : "Create event"}
      onSubmit={async (e) => {
        e.preventDefault();
        const from = new Date(start);
        const until = new Date(end);
        if (
          !Number.isFinite(from.getTime()) ||
          !Number.isFinite(until.getTime()) ||
          until <= from
        ) {
          setError("Choose an end time after the start time.");
          return;
        }
        if (!selected.length) {
          setError("Invite at least one student.");
          return;
        }
        setError("");
        await onSave({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          starts_at: from.toISOString(),
          ends_at: until.toISOString(),
          student_ids: selected,
        });
      }}
    >
      <fieldset disabled={busy} className="pearl-event-fields">
        <label>
          Event title
          <input
            ref={titleRef}
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="An afternoon of astronomy"
          />
        </label>
        <label htmlFor={`event-description-${id}`}>
          What will you do?
          <Textarea
            id={`event-description-${id}`}
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What to expect, what to bring, and how to join in"
          />
        </label>
        <div className="school-form-grid">
          <label>
            Starts
            <input
              type="datetime-local"
              required
              min="2000-01-01T00:00"
              max="2100-12-31T23:59"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              required
              min={start || "2000-01-01T00:00"}
              max="2100-12-31T23:59"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label>
          Location or meeting details
          <input
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Science lab, library, or meeting link"
          />
        </label>
        <fieldset className="pearl-event-invites">
          <legend>Invite students</legend>
          <p>Their linked parents and advisors can also see this event.</p>
          {students.length ? (
            students.map((student) => (
              <label key={student.account_id} className="school-check">
                <input
                  type="checkbox"
                  checked={selected.includes(student.account_id)}
                  onChange={(e) =>
                    setSelected((current) =>
                      e.target.checked
                        ? [...current, student.account_id]
                        : current.filter((id) => id !== student.account_id),
                    )
                  }
                />
                {student.name}
              </label>
            ))
          ) : (
            <p>No students are linked to you as a teacher yet.</p>
          )}
        </fieldset>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="school-inline-actions">
        <Button
          type="submit"
          disabled={busy || !title.trim() || !selected.length}
        >
          {busy ? "Saving…" : event ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}
