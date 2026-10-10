"use client";
import { Button, Card } from "@school2036/ui";
import {
  Bell,
  CalendarDays,
  Check,
  FileUp,
  Flag,
  GitBranch,
  LineChart,
  type LucideIcon,
  MessageCircle,
  Pin,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PearlScene } from "../pearl";
import { type AccountId, fixture, type Role, roleNames } from "./data";
import { type HomeGroup, homeCards } from "./home-cards";
import { ParentOverview, StudentWeek } from "./home-sections";
import { ActionCard, Panel } from "./shared";
import { usePreview } from "./state";

const helpers: Record<Role, { label: string; icon: LucideIcon }[]> = {
  student: [
    { label: "New lessons in my subjects", icon: Bell },
    { label: "Remind me of agreed steps", icon: Flag },
    { label: "Weekly recap: own work vs help", icon: LineChart },
  ],
  teacher: [
    { label: "Recurring misconception alerts", icon: Bell },
    { label: "Weekly class summary", icon: LineChart },
    { label: "Tell me when uploads are ready", icon: FileUp },
  ],
  adviser: [
    { label: "New subject proposals", icon: GitBranch },
    { label: "Unanswered student questions", icon: MessageCircle },
    { label: "Overdue follow-ups", icon: Flag },
  ],
  parent: [
    { label: "Choices that need my review", icon: GitBranch },
    { label: "New guidance from the advisor", icon: MessageCircle },
    { label: "Activity updates", icon: CalendarDays },
  ],
  staff: [
    { label: "New activity proposals", icon: CalendarDays },
    { label: "Activities filling up", icon: UsersRound },
    { label: "Access requests", icon: ShieldCheck },
  ],
};

function WelcomeWizard() {
  const { state, setState } = usePreview();
  const [step, setStep] = useState(0);
  return (
    <Card className="mx-auto mt-10 w-full max-w-3xl p-7 sm:p-10">
      <p className="eyebrow">Welcome, Sami · Step {step + 1} of 3</p>
      <h1 className="text-3xl">
        {
          [
            "Your school, from home too",
            "What are you curious about?",
            "Your advisor is being matched",
          ][step]
        }
      </h1>
      <p className="text-muted-foreground">
        {
          [
            "Rewatch lessons, practise on your own and work with a human advisor on what to study next.",
            "Pick a few interests. You can change them whenever you like.",
            "You can start with lessons and practice while the school matches you with a specialist.",
          ][step]
        }
      </p>
      {step === 1 && (
        <div className="flex flex-wrap gap-2">
          {fixture.interests.map((interest) => (
            <Button
              key={interest}
              variant={
                state.samiInterests.includes(interest) ? "default" : "outline"
              }
              className="normal-case tracking-normal"
              aria-pressed={state.samiInterests.includes(interest)}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  samiInterests: s.samiInterests.includes(interest)
                    ? s.samiInterests.filter((x) => x !== interest)
                    : [...s.samiInterests, interest],
                }))
              }
            >
              {interest}
            </Button>
          ))}
        </div>
      )}
      <div className="flex justify-between gap-4">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Back
        </Button>
        <Button
          onClick={() =>
            step === 2
              ? setState((s) => ({ ...s, onboarded: true }))
              : setStep(step + 1)
          }
        >
          {step === 2 ? "Go to my overview" : "Continue"}
        </Button>
      </div>
    </Card>
  );
}

export function WorkspaceHome({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const account = fixture.accounts[accountId];
  const role = account.role as Role;
  const firstName = {
    lina: "Lina",
    sami: "Sami",
    daher: "Elie",
    nassar: "Maya",
    karim: "Karim",
    hajj: "Rita",
  }[accountId];
  const base = `/preview/${accountId}/`;
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => setDate(new Date()), []);
  const allHelpersOn = helpers[role].every((_, i) =>
    state.helpers.includes(accountId + i),
  );
  const pins =
    accountId === "lina" || accountId === "sami"
      ? fixture.lessons.filter((lesson) =>
          state.lessonPins[accountId].includes(lesson.id),
        )
      : [];
  const cards = homeCards(accountId, state);
  const groups: { id: HomeGroup; title: string; empty: string }[] = [
    {
      id: "needs",
      title: "Needs you",
      empty: "Nothing needs your attention right now.",
    },
    {
      id: "continue",
      title: "Continue",
      empty:
        "Nothing to pick up yet. Your lessons and other tools are in the sidebar.",
    },
    {
      id: "waiting",
      title: "Waiting on others",
      empty: "Nothing is waiting on someone else.",
    },
  ];
  const done = cards.filter((card) => card.group === "done");
  const needs = cards.filter((card) => card.group === "needs").length;
  const continuing = cards.filter((card) => card.group === "continue").length;
  const waiting = cards.filter((card) => card.group === "waiting").length;
  if (accountId === "sami" && !state.onboarded) return <WelcomeWizard />;
  return (
    <div className="pearl-home">
      <header className="pearl-home-hero pearl-home-greeting">
        <div className="pearl-home-hero-copy">
          <p className="eyebrow">
            {roleNames[role]} ·{" "}
            {date
              ? date.toLocaleDateString("en", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Your workspace"}
          </p>
          <h1>
            Welcome back, <span className="text-cobalt">{firstName}</span>
          </h1>
          <p className="pearl-home-summary-line">
            {needs
              ? `${needs} ${needs === 1 ? "thing needs" : "things need"} you`
              : "You’re all caught up"}{" "}
            · {continuing} to continue · {waiting} waiting
          </p>
        </div>
        <PearlScene
          className="pearl-home-hero-stage pearl-home-greeting-scene"
          compact
        />
      </header>
      {groups.map(({ id, title, empty }) => {
        const items = cards.filter((card) => card.group === id);
        return (
          <section
            className={`pearl-home-group pearl-home-group-${id}`}
            aria-labelledby={`home-${id}-title`}
            key={id}
          >
            <div className="pearl-home-group-heading">
              <h2 id={`home-${id}-title`}>{title}</h2>
              <span>{items.length}</span>
            </div>
            {items.length ? (
              <div
                className={
                  id === "needs" ? "pearl-home-cards" : "pearl-home-task-list"
                }
              >
                {items.map((card) => (
                  <ActionCard
                    key={card.id}
                    {...card}
                    compact={id !== "needs"}
                  />
                ))}
              </div>
            ) : (
              <p className="pearl-home-group-empty">{empty}</p>
            )}
          </section>
        );
      })}
      <details className="pearl-home-completed">
        <summary>
          <span>Done</span>
          <span>{done.length} completed</span>
        </summary>
        {done.length ? (
          <div className="pearl-home-task-list">
            {done.map((card) => (
              <ActionCard key={card.id} {...card} compact />
            ))}
          </div>
        ) : (
          <p className="pearl-home-group-empty">
            Completed practice and confirmed choices will stay here.
          </p>
        )}
      </details>
      {pins.length > 0 && (accountId === "lina" || accountId === "sami") && (
        <section className="pearl-home-pins" aria-label="My shortcuts">
          <span className="eyebrow">My shortcuts</span>
          {pins.map((lesson) => (
            <span className="pearl-home-pin" key={lesson.id}>
              <Link href={`${base}lesson/${lesson.id}`}>
                <Pin />
                {lesson.title}
              </Link>
              <button
                type="button"
                aria-label={`Remove ${lesson.title}`}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    lessonPins: {
                      ...s.lessonPins,
                      [accountId]: s.lessonPins[accountId].filter(
                        (id) => id !== lesson.id,
                      ),
                    },
                  }))
                }
              >
                <X />
              </button>
            </span>
          ))}
        </section>
      )}
      <Card className="pearl-home-more">
        <div>
          <h2>More things I can do for you</h2>
          <p>
            Choose the updates you’d like. Preferences save as you select them;
            this preview does not send notifications.
          </p>
        </div>
        <div className="pearl-home-helpers">
          {helpers[role].map(({ label, icon: Icon }, i) => {
            const key = accountId + i;
            const enabled = state.helpers.includes(key);
            return (
              <button
                type="button"
                key={label}
                className="pearl-home-helper"
                aria-pressed={enabled}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    helpers: s.helpers.includes(key)
                      ? s.helpers.filter((x) => x !== key)
                      : [...s.helpers, key],
                  }))
                }
              >
                <span className="pearl-home-helper-icon">
                  <Icon />
                </span>
                <span>{label}</span>
                <span className="pearl-home-helper-tick">
                  {enabled && <Check />}
                </span>
              </button>
            );
          })}
          <Button
            className={
              allHelpersOn
                ? "pearl-home-helpers-all"
                : "pearl-home-helpers-all pearl-home-primary"
            }
            variant={allHelpersOn ? "outline" : "default"}
            disabled={allHelpersOn}
            onClick={() =>
              setState((s) => ({
                ...s,
                helpers: [
                  ...new Set([
                    ...s.helpers,
                    ...helpers[role].map((_, i) => accountId + i),
                  ]),
                ],
              }))
            }
          >
            {allHelpersOn ? "All selected" : "Enable all updates"}
          </Button>
        </div>
      </Card>
      {(accountId === "lina" || accountId === "sami") && (
        <details className="pearl-home-overview">
          <summary>Your week &amp; subjects</summary>
          <div className="pearl-home-overview-content">
            <StudentWeek accountId={accountId} date={date} />
          </div>
        </details>
      )}
      {role === "parent" && <ParentOverview date={date} />}
      {role === "adviser" && (
        <Panel title="Up next">
          <p className="text-muted-foreground">
            Review Lina’s independent Mathematics result after Unit 2.
          </p>
          <Button asChild variant="outline">
            <Link href={`${base}student/lina`}>Open student workspace</Link>
          </Button>
        </Panel>
      )}
      {role === "teacher" && (
        <Panel title="Follow-ups">
          {state.followups.length ? (
            state.followups.map((item) => <p key={item}>{item}</p>)
          ) : (
            <p className="text-muted-foreground">
              No follow-ups yet. Plan one from a misconception or teaching flag.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
