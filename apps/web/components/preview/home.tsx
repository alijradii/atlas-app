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
import { type AccountId, fixture, type Role, roleNames } from "./data";
import { homeCards } from "./home-cards";
import { ParentOverview, StudentWeek } from "./home-sections";
import { ActionCard, Hero, Panel } from "./shared";
import { usePreview } from "./state";

const copy: Record<
  AccountId,
  {
    title: string;
    action: string;
    route: string;
  }
> = {
  lina: {
    title:
      "Hi Lina, I’m your study assistant. Pick up where you left off, or ask me anything from your lessons.",
    action: "Continue practice batch",
    route: "practice",
  },
  sami: {
    title:
      "Hi Sami, let’s set up your first week. Start with a lesson, a little practice, and what interests you.",
    action: "Watch your first lesson",
    route: "lessons",
  },
  daher: {
    title:
      "Good morning, Elie. Here’s what your Grade 10 physics classes need this week, and what’s worth revisiting in your teaching.",
    action: "Open class analytics",
    route: "analytics",
  },
  nassar: {
    title:
      "Welcome back, Maya. Review your students’ questions, subject proposals and agreed next steps. Your advice stays your own.",
    action: "Open Lina’s workspace",
    route: "student/lina",
  },
  karim: {
    title:
      "Hello Karim. Here’s what’s happening around Lina’s subject choices, guidance and activities.",
    action: "Review subject choices",
    route: "choices",
  },
  hajj: {
    title:
      "Good morning, Rita. Review student activities, confirm subject choices and manage school access.",
    action: "Review activities",
    route: "activities",
  },
};
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
  const content = copy[accountId];
  const firstName = {
    lina: "Lina",
    sami: "Sami",
    daher: "Elie",
    nassar: "Maya",
    karim: "Karim",
    hajj: "Rita",
  }[accountId];
  const greeting = content.title.split(firstName);
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
  if (accountId === "sami" && !state.onboarded) return <WelcomeWizard />;
  return (
    <div className="pearl-home">
      <Hero
        date={date}
        eyebrow={`${roleNames[role]}${date ? ` · ${date.toLocaleDateString("en", { weekday: "long" })}` : ""}`}
        title={
          accountId === "lina" && state.batch === "active" ? (
            <>
              Hi <span className="text-cobalt">Lina</span>, I’m your study
              assistant. You have a practice batch waiting, and I’m paused until
              you submit it.
            </>
          ) : (
            <>
              {greeting[0]}
              <span className="text-cobalt">{firstName}</span>
              {greeting.slice(1).join(firstName)}
            </>
          )
        }
        action={
          <Button asChild size="lg" className="pearl-home-primary">
            <Link href={base + content.route}>
              {accountId === "lina" && state.batch === "feedback"
                ? "See your batch feedback"
                : accountId === "lina" && state.batch === "none"
                  ? "Start a practice batch"
                  : content.action}
            </Link>
          </Button>
        }
      />
      <div className="pearl-home-cards">
        {homeCards(accountId, state).map((card) => (
          <ActionCard key={card.id} {...card} />
        ))}
      </div>
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
        <StudentWeek accountId={accountId} date={date} />
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
