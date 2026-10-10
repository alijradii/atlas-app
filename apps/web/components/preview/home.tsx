"use client";
import { Button, Card, Switch } from "@school2036/ui";
import { Bell, Flag, LineChart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type AccountId, fixture, type Role, roleNames } from "./data";
import { ActionCard, Evidence, Hero, Panel, Steps } from "./shared";
import { usePreview } from "./state";

const copy: Record<
  string,
  {
    title: string;
    action: string;
    route: string;
    cards: [string, string, string, string][];
  }
> = {
  lina: {
    title:
      "Hi Lina, I’m your study assistant. Pick up where you left off, or ask me anything from your lessons.",
    action: "Continue practice batch",
    route: "practice",
    cards: [
      ["Finish your practice batch", "2 of 5 answered", "Next", "practice"],
      [
        "Resume Newton’s second law",
        "Stopped at 10:12",
        "Continue",
        "lesson/L1",
      ],
      [
        "Dr. Nassar replied",
        "Do universities look at Design & Technology?",
        "People",
        "adviser",
      ],
      ["Computer Science proposal", "With adviser", "Choices", "subjects"],
    ],
  },
  sami: {
    title:
      "Hi Sami, let’s set up your first week. Start with a lesson, a little practice, and what interests you.",
    action: "Watch your first lesson",
    route: "lessons",
    cards: [
      [
        "Watch your first lesson",
        "Recorded by your teachers",
        "Next",
        "lessons",
      ],
      [
        "Try a practice batch",
        "Five problems, on your own",
        "Continue",
        "practice",
      ],
      [
        "Tell us what you’re curious about",
        "Make room for your interests",
        "People",
        "activities",
      ],
      ["Meet your adviser", "Matching in progress", "Choices", "adviser"],
    ],
  },
  daher: {
    title:
      "Good morning, Elie. Here’s what your Grade 10 physics classes need this week, and what’s worth revisiting in your teaching.",
    action: "Open class analytics",
    route: "analytics",
    cards: [
      [
        "9 students confuse mass and weight",
        "Recurring misconception",
        "Next",
        "analytics",
      ],
      [
        "A lesson segment to revisit",
        "Mass vs weight · 6:10",
        "Continue",
        "analytics",
      ],
      ["Upload a session", "Pick who it’s for", "People", "upload"],
      [
        "Students relying on help",
        "A gap between help and own work",
        "Evidence",
        "analytics",
      ],
    ],
  },
  nassar: {
    title:
      "Welcome back, Maya. Lina’s Computer Science proposal is waiting for your recommendation. Your advice stays your own.",
    action: "Open Lina’s workspace",
    route: "student/lina",
    cards: [
      ["Review Lina’s proposal", "Computer Science", "Next", "proposals"],
      [
        "Lina asked a question",
        "Advanced Maths and Computer Science?",
        "Continue",
        "student/lina",
      ],
      [
        "Your students",
        "Five people, different pathways",
        "People",
        "students",
      ],
      ["Follow-ups", "Make time for what matters", "Choices", "students"],
    ],
  },
  karim: {
    title:
      "Hello Karim. Here’s what’s happening around Lina’s subject choices, guidance and activities.",
    action: "Review subject choices",
    route: "choices",
    cards: [
      [
        "Computer Science proposal",
        "Follow the review together",
        "Next",
        "choices",
      ],
      [
        "Guidance from Dr. Nassar",
        "Keep Design & Technology",
        "Continue",
        "home#guidance",
      ],
      ["Lina’s interests", "Engineering, Robotics, Drawing", "People", "home"],
      [
        "An honest picture of progress",
        "A view for discussion",
        "Evidence",
        "progress",
      ],
    ],
  },
  hajj: {
    title:
      "Good morning, Rita. Two student activities are waiting for review. Here’s what needs your attention.",
    action: "Review activities",
    route: "activities",
    cards: [
      [
        "Campus composting project",
        "Needs a staff sponsor",
        "Next",
        "activities",
      ],
      ["Game design jam", "Weekend access requested", "Continue", "activities"],
      ["Access & availability", "What works from home", "People", "access"],
      ["School settings", "Draft the right boundaries", "Settings", "settings"],
    ],
  },
};
const helpers: Record<Role, string[]> = {
  student: [
    "New lessons in my subjects",
    "Remind me of agreed steps",
    "Weekly recap: own work vs help",
  ],
  teacher: [
    "Recurring misconception alerts",
    "Weekly class summary",
    "Tell me when uploads are ready",
  ],
  adviser: [
    "New subject proposals",
    "Unanswered student questions",
    "Overdue follow-ups",
  ],
  parent: [
    "Choices that need my review",
    "New guidance from the adviser",
    "Activity updates",
  ],
  staff: ["New activity proposals", "Activities filling up", "Access requests"],
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
            "Your adviser is being matched",
          ][step]
        }
      </h1>
      <p className="text-muted-foreground">
        {
          [
            "Rewatch lessons, practise on your own and work with a human adviser on what to study next.",
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
  const base = `/preview/${accountId}/`;
  if (accountId === "sami" && !state.onboarded) return <WelcomeWizard />;
  return (
    <>
      <Hero
        eyebrow={`${roleNames[role]} · your workspace`}
        title={
          accountId === "lina" && state.batch === "active" ? (
            <>
              Hi <span className="text-cobalt">Lina</span>, I’m your study
              assistant. You have a practice batch waiting, and I’m paused until
              you submit it.
            </>
          ) : (
            content.title
          )
        }
        action={
          <Button asChild size="lg">
            <Link href={base + content.route}>
              {accountId === "lina" && state.batch === "feedback"
                ? "See your batch feedback"
                : content.action}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {content.cards.map(([title, sub, label, href], i) => (
          <ActionCard
            key={title}
            title={
              accountId === "lina" && href === "practice"
                ? state.batch === "feedback"
                  ? "Your batch feedback is ready"
                  : state.batch === "none"
                    ? "Try a new practice batch"
                    : title
                : title
            }
            sub={
              accountId === "lina" && href === "practice"
                ? state.batch === "active"
                  ? `${state.answers.filter((a, i) => a.trim() || state.stuck[i]).length} of 5 ready`
                  : state.batch === "feedback"
                    ? "Independent work, with next steps"
                    : "Five problems, on your own"
                : href === "subjects" && accountId === "lina"
                  ? `Status: ${state.proposals.find((p) => p.subject === "cs")?.status ?? "Not proposed"}`
                  : sub
            }
            label={label}
            href={base + href}
            kind={i === 1 ? "lens" : i > 1 ? "bubble" : "blue"}
            locked={role === "teacher" && href === "analytics" && !state.school}
          />
        ))}
      </div>
      <Card className="mx-auto grid w-full max-w-3xl gap-7 p-7 sm:grid-cols-[.9fr_1.1fr] sm:p-9">
        <div>
          <h2 className="text-[28px]">More things I can do for you</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Try the helper preferences. Notifications in this preview are not
            sent.
          </p>
        </div>
        <div className="space-y-4">
          {helpers[role].map((label, i) => {
            const Icon = [Bell, Flag, LineChart][i];
            const key = accountId + i;
            return (
              <label
                htmlFor={`helper-${key}`}
                key={label}
                className="flex items-center gap-3 text-sm"
              >
                <Icon className="size-4 shrink-0 text-cobalt" />
                <span className="flex-1">{label}</span>
                <Switch
                  id={`helper-${key}`}
                  size="sm"
                  aria-label={label}
                  checked={state.helpers.includes(key)}
                  onCheckedChange={(checked) =>
                    setState((s) => ({
                      ...s,
                      helpers: checked
                        ? [...s.helpers, key]
                        : s.helpers.filter((x) => x !== key),
                    }))
                  }
                />
              </label>
            );
          })}
          <Button
            className="w-full"
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
            Put me to work
          </Button>
        </div>
      </Card>
      {accountId === "lina" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Your week">
            <Steps />
          </Panel>
          <Panel title="Your subjects">
            <Evidence compact />
          </Panel>
        </div>
      )}
      {role === "parent" && (
        <div id="guidance" className="grid gap-6 lg:grid-cols-2">
          <Panel title="Guidance shared with your family">
            {fixture.students.lina.advice.map((advice) => (
              <blockquote
                key={advice.id}
                className="border-l-2 border-cobalt pl-4 text-sm"
              >
                <p>{advice.txt}</p>
                <footer className="mt-2 text-xs text-muted-foreground">
                  Dr. Maya Nassar · human adviser
                </footer>
              </blockquote>
            ))}
          </Panel>
          <Panel title="Agreed next steps">
            <Steps />
          </Panel>
        </div>
      )}
      {role === "parent" && (
        <div id="interests">
          <Panel title="Lina’s interests">
            <p className="text-lg">
              {state.interests.join(" · ") || "Still exploring"}
            </p>
            <p className="text-sm text-muted-foreground">
              Room for activities alongside subject choices. Interests are not a
              measure of grades.
            </p>
          </Panel>
        </div>
      )}
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
    </>
  );
}
