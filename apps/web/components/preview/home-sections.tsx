"use client";

import {
  BookOpen,
  Flag,
  Heart,
  type LucideIcon,
  Route,
  SquarePen,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { duration, fixture, subjectName } from "./data";
import { usePreview } from "./state";

function day(date: Date | null, offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (!date) return `In ${offset} days`;
  const result = new Date(date);
  result.setDate(result.getDate() + offset);
  return result.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function HomePanel({
  title,
  children,
  action,
  id,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="pearl-home-panel">
      <header className="pearl-home-panel-header">
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}
type WorkItem = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  action?: string;
};
function WorkRows({
  rows,
  neutral = false,
}: {
  rows: WorkItem[];
  neutral?: boolean;
}) {
  return (
    <div>
      {rows.map(({ icon: Icon, title, subtitle, href, action }) => (
        <div className="pearl-home-row" key={`${href}-${title}-${subtitle}`}>
          <span className={`pearl-home-row-icon${neutral ? " neutral" : ""}`}>
            <Icon />
          </span>
          <span>
            <span className="pearl-home-row-title">{title}</span>
            <small>{subtitle}</small>
          </span>
          <Link className="pearl-home-row-action" href={href}>
            {action || "Open"}
          </Link>
        </div>
      ))}
    </div>
  );
}
function HomeSteps({
  owner,
  date,
}: {
  owner: "Lina" | "Karim";
  date: Date | null;
}) {
  const { state, setState } = usePreview();
  return (
    <div>
      {fixture.students.lina.steps.map((step) => {
        const done = state.completed.includes(step.id);
        return (
          <label
            className="pearl-home-step"
            data-completed={done}
            key={step.id}
          >
            <input
              type="checkbox"
              checked={done}
              disabled={step.owner !== owner}
              aria-label={`Done: ${step.txt}`}
              onChange={() =>
                setState((s) => ({
                  ...s,
                  completed: s.completed.includes(step.id)
                    ? s.completed.filter((id) => id !== step.id)
                    : [...s.completed, step.id],
                }))
              }
            />
            <span>
              {step.txt}
              <small>
                {step.owner} · {done ? "done" : `due ${day(date, step.due)}`}
              </small>
            </span>
            {step.owner === owner && !done && (
              <span className="pearl-home-chip">Yours</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
function SubjectTable({ fresh }: { fresh: boolean }) {
  const progress = fixture.students.lina.progress;
  return (
    <section
      className="pearl-home-table-wrap"
      aria-label="Subject progress"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the subject table horizontally.
      tabIndex={0}
    >
      <table className="pearl-home-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Progress</th>
            <th>To do</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(fixture.subjects)
            .filter(
              ([id, subject]) =>
                subject.kind === "common" ||
                (!fresh && fixture.students.lina.chosen.includes(id)),
            )
            .map(([id, subject]) => {
              const value = fresh
                ? undefined
                : progress[id as keyof typeof progress];
              return (
                <tr key={id}>
                  <td>
                    {subject.name}
                    {subject.kind === "optional" && (
                      <>
                        {" "}
                        <span className="pearl-home-chip">Optional</span>
                      </>
                    )}
                  </td>
                  <td>
                    {value ? (
                      <span
                        className="pearl-home-meter"
                        role="img"
                        aria-label={`On your own ${value.ind}%, with help ${value.as}%`}
                      >
                        <span className="pearl-home-track">
                          <i
                            className="help-track"
                            style={{ width: `${value.as}%` }}
                          />
                          <i
                            className="own"
                            style={{ width: `${value.ind}%` }}
                          />
                        </span>
                        <span className="pearl-home-meter-value">
                          <b>{value.ind}%</b>
                          <small>{value.as}% with help</small>
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No work yet</span>
                    )}
                  </td>
                  <td>{value?.todo || "—"}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </section>
  );
}
export function StudentWeek({
  accountId,
  date,
}: {
  accountId: "lina" | "sami";
  date: Date | null;
}) {
  const { state } = usePreview();
  const fresh = accountId === "sami";
  const batch = fresh ? state.samiBatch : state.batch;
  const answers = fresh ? state.samiAnswers : state.answers;
  const stuck = fresh ? state.samiStuck : state.stuck;
  const base = `/preview/${accountId}/`;
  const attention: WorkItem[] = [];
  if (!fresh) {
    for (const question of state.questions.filter((q) => q.reply))
      attention.push({
        icon: UserRound,
        title: "Dr. Nassar replied to your question",
        subtitle: question.text,
        href: `${base}adviser`,
      });
    for (const proposal of state.proposals.filter((p) =>
      ["adviser", "parent", "changes"].includes(p.status),
    ))
      attention.push({
        icon: Route,
        title:
          proposal.status === "changes"
            ? "Your advisor suggested changes"
            : `${subjectName(proposal.subject)} proposal · With ${proposal.status === "adviser" ? "advisor" : "parent"}`,
        subtitle:
          proposal.status === "adviser"
            ? "Waiting for Dr. Nassar"
            : proposal.status === "parent"
              ? "Waiting for your parent"
              : proposal.note,
        href: `${base}subjects`,
      });
    for (const step of fixture.students.lina.steps.filter(
      (s) =>
        s.owner === "Lina" && !state.completed.includes(s.id) && s.due <= 1,
    ))
      attention.push({
        icon: Flag,
        title: `Next step due ${step.due ? "tomorrow" : "today"}`,
        subtitle: step.txt,
        href: `${base}adviser`,
      });
  }
  const unfinished: WorkItem[] = [];
  if (batch === "active")
    unfinished.push({
      icon: SquarePen,
      title: "Practice batch · Newton's second law",
      subtitle: `${answers.filter((a, i) => a.trim() || stuck[i]).length} of 5 answered · tutor paused until you submit`,
      href: `${base}practice`,
      action: "Continue",
    });
  if (!fresh) {
    for (const [id, position] of Object.entries(fixture.students.lina.watch)) {
      const lesson = fixture.lessons.find((item) => item.id === id);
      if (lesson && position < lesson.dur - 5)
        unfinished.push({
          icon: Video,
          title: lesson.title,
          subtitle: `Stopped at ${duration(position)} of ${duration(lesson.dur)}`,
          href: `${base}lesson/${id}`,
          action: "Resume",
        });
    }
  }
  const upcoming: [number, string, string, LucideIcon][] = fresh
    ? []
    : [
        [0, "Physics quiz · Unit 3", "Class 10A", BookOpen],
        [1, "Robotics club", "Tuesday 15:30 · Lab 2", Heart],
        [3, "Check-in with Dr. Nassar", "Arrangement to be defined", UserRound],
        [5, "Karim reviews subject load", "Agreed next step", UsersRound],
      ];
  return (
    <>
      <div className="pearl-home-section-title">
        <h2>Your week</h2>
      </div>
      {attention.length > 0 && (
        <HomePanel
          title="Needs your attention"
          action={<small>{attention.length}</small>}
        >
          <WorkRows rows={attention} />
        </HomePanel>
      )}
      <div className="pearl-home-columns">
        <HomePanel title="Unfinished work">
          {unfinished.length ? (
            <WorkRows rows={unfinished} neutral />
          ) : (
            <p className="pearl-home-empty">
              Nothing unfinished. Lessons you pause and practice you leave open
              show up here.
            </p>
          )}
        </HomePanel>
        <HomePanel title="Coming up">
          {upcoming.length ? (
            <div>
              {upcoming.map(([offset, title, subtitle, Icon]) => (
                <div className="pearl-home-row" key={title}>
                  <span className="pearl-home-row-icon neutral">
                    <Icon />
                  </span>
                  <span>
                    <span className="pearl-home-row-title">{title}</span>
                    <small>{subtitle}</small>
                  </span>
                  <span className="pearl-home-chip">{day(date, offset)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pearl-home-empty">
              No activities or check-ins scheduled yet.
            </p>
          )}
        </HomePanel>
      </div>
      <div className="pearl-home-columns">
        <HomePanel
          title="My subjects"
          action={
            !fresh && (
              <span className="pearl-home-legend">
                <span>
                  <i className="own" />
                  On your own
                </span>
                <span>
                  <i className="help-track" />
                  With help
                </span>
              </span>
            )
          }
        >
          <SubjectTable fresh={fresh} />
        </HomePanel>
        <HomePanel
          title="Agreed next steps"
          action={
            <Link href={`${base}adviser`} className="pearl-home-row-action">
              All
            </Link>
          }
        >
          {fresh ? (
            <p className="pearl-home-empty">
              Once your advisor is assigned, the steps you agree on together
              appear here.
            </p>
          ) : (
            <HomeSteps owner="Lina" date={date} />
          )}
        </HomePanel>
      </div>
    </>
  );
}
export function ParentOverview({ date }: { date: Date | null }) {
  const { state } = usePreview();
  const pending = state.proposals.filter((p) => p.status === "parent");
  return (
    <>
      <div className="pearl-home-section-title">
        <h2>Lina at a glance</h2>
      </div>
      {pending.length > 0 && (
        <div className="pearl-home-panel pearl-home-summary">
          <p>
            Your review is needed: Lina’s proposal to take{" "}
            {pending.map((p) => subjectName(p.subject)).join(", ")}.
          </p>
          <Link href="/preview/karim/choices" className="pearl-home-row-action">
            Review
          </Link>
        </div>
      )}
      <div className="pearl-home-three">
        <section id="interests" className="pearl-home-panel pearl-home-summary">
          <h3 className="eyebrow">Interests</h3>
          <div className="pearl-home-tags">
            {state.interests.map((interest) => (
              <span key={interest}>{interest}</span>
            ))}
          </div>
        </section>
        <section className="pearl-home-panel pearl-home-summary">
          <h3 className="eyebrow">Optional subjects</h3>
          <p>{fixture.students.lina.chosen.map(subjectName).join(", ")}</p>
          {state.proposals
            .filter((p) => p.status !== "agreed")
            .map((proposal) => (
              <span className="pearl-home-chip" key={proposal.subject}>
                Proposed: {subjectName(proposal.subject)}
              </span>
            ))}
        </section>
        <section className="pearl-home-panel pearl-home-summary">
          <h3 className="eyebrow">Advisor</h3>
          <p>Dr. Maya Nassar</p>
          <small className="text-muted-foreground">
            {fixture.adviserProfile.field}
          </small>
        </section>
      </div>
      <div className="pearl-home-columns pearl-home-equal">
        <HomePanel title="Guidance shared with you" id="guidance">
          <div>
            {fixture.students.lina.advice
              .filter((advice) => advice.shared)
              .toReversed()
              .map((advice) => (
                <blockquote className="pearl-home-advice" key={advice.id}>
                  <small>Dr. Nassar · human advisor</small>
                  <p>{advice.txt}</p>
                </blockquote>
              ))}
          </div>
        </HomePanel>
        <HomePanel
          title="Agreed next steps"
          action={<small>Tick yours when done</small>}
        >
          <HomeSteps owner="Karim" date={date} />
        </HomePanel>
      </div>
      <HomePanel title="Activities Lina joined">
        <div>
          {fixture.activities
            .filter((activity) => state.joined.includes(activity.id))
            .map((activity) => (
              <div className="pearl-home-row" key={activity.id}>
                <span className="pearl-home-row-icon">
                  <Heart />
                </span>
                <span>
                  <span className="pearl-home-row-title">{activity.title}</span>
                  <small>
                    {activity.when} · {activity.where}
                  </small>
                </span>
              </div>
            ))}
          {state.joined.length === 0 && (
            <p className="pearl-home-empty">None yet.</p>
          )}
        </div>
      </HomePanel>
    </>
  );
}
