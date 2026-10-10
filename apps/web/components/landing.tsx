"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  cn,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@school2036/ui";
import {
  ArrowDown,
  ArrowRight,
  Check,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand, PearlObject, PearlScene } from "./pearl";
import { Evidence } from "./preview/shared";
import { ThemeToggle } from "./theme-toggle";

const roles = [
  {
    id: "lina",
    name: "Students",
    title: "Your learning, with people in your corner.",
    text: "Revisit a lesson, work through a problem, or talk through a big subject choice. Your advisor and teachers are part of the picture.",
    points: [
      "Lessons you can return to",
      "Practice with and without help",
      "Subject choices made together",
    ],
  },
  {
    id: "karim",
    name: "Parents",
    title: "Be part of the big choices.",
    text: "See your child’s interests, the subjects they’re considering, and the guidance their advisor shares with you.",
    points: [
      "Review subject choices",
      "Read shared human guidance",
      "Ask for a conversation",
    ],
  },
  {
    id: "daher",
    name: "Teachers",
    title: "See what needs another explanation.",
    text: "Look beyond a score. Understand recurring misconceptions, see the work behind them, and choose what to revisit.",
    points: [
      "Independent and assisted evidence",
      "Class patterns with context",
      "Recorded lessons from home",
    ],
  },
  {
    id: "nassar",
    name: "Advisors",
    title: "Know the person behind the pathway.",
    text: "Follow interests, questions and choices over time. Keep your own advice distinct from anything the assistant prepares.",
    points: [
      "A manageable student caseload",
      "Subject proposals and prerequisites",
      "Agreed next steps with families",
    ],
  },
  {
    id: "hajj",
    name: "Schools",
    title: "Make room for every kind of learner.",
    text: "Bring learning and student life together with clear boundaries for access, participation and human decisions.",
    points: [
      "Review student activities",
      "Understand information boundaries",
      "Shape your school’s approach",
    ],
  },
];
const cards = [
  [
    "What is the difference between mass and weight?",
    "Mass is measured in kilograms. Weight is a force, measured in newtons: W = mg.",
  ],
  [
    "Which force belongs in F = ma?",
    "The net force: add forces with their directions, including friction.",
  ],
  [
    "What happens when mass doubles under the same net force?",
    "Acceleration halves, because a = F / m.",
  ],
];
const questions = [
  [
    "Does the assistant do students’ homework?",
    "The design separates studying with help from practice done independently. During a practice batch, the preview pauses the study assistant until the whole set is submitted.",
  ],
  [
    "Who are the advisors?",
    "The kit proposes qualified human specialists matched by interests and field. Their background and qualifications are visible to the student and family.",
  ],
  [
    "What can parents see?",
    "Subject choices, interests and guidance shared with the family. The parent progress screen is an exploration; its final information boundaries are still undecided.",
  ],
  [
    "Can students use it from home?",
    "The design makes lessons, practice, guidance and activities available from home. School analytics are shown separately in the workspace preview.",
  ],
  [
    "What happens if the AI gets something wrong?",
    "The proposed experience labels AI material and keeps review and decisions with people. This preview uses scripted examples; it does not contact an AI service.",
  ],
  [
    "Can our school join now?",
    "Atlas is currently a design preview. Pilot enrollment and pricing are not connected. You can explore every role without creating an account.",
  ],
];

function SectionHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="eyebrow mb-4">{label}</p>
      <h2 className="text-3xl sm:text-[42px]">{title}</h2>
      {children && (
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}

export function Landing() {
  const [question, setQuestion] = useState(0);
  const [flip, setFlip] = useState(false);
  const [card, setCard] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  return (
    <>
      <main id="main-content">
        <section
          id="top"
          className="m-3 grid min-h-[min(850px,95svh)] overflow-hidden rounded-2xl lg:m-6 lg:grid-cols-[.78fr_1.22fr]"
        >
          <div className="pearl-panel flex flex-col items-start px-7 py-9 sm:px-12 lg:px-14 lg:py-12">
            <Brand />
            <div className="my-auto py-16">
              <p className="eyebrow mb-6">Atlas · a preview for high schools</p>
              <h1 className="max-w-[12ch] text-[clamp(44px,4.3vw,68px)] leading-[1.04] tracking-[-.045em]">
                Study at home. Choose with people who know you.
              </h1>
              <p className="mt-7 max-w-md text-base leading-relaxed text-muted-foreground">
                Atlas connects everyday home learning with a real human advisor,
                your teachers and your family. An assistant shows you where
                things are, and practice you do on your own stays your own.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/login?next=study">
                  Explore Atlas <ArrowRight />
                </Link>
              </Button>
              <p className="mt-5 max-w-xs text-xs text-muted-foreground">
                For students in grades 10–12, their families, advisors and
                schools.
              </p>
            </div>
          </div>
          <div className="relative min-h-[520px] lg:min-h-full">
            <PearlScene className="absolute inset-0" />
            <nav
              aria-label="Main"
              className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 py-6 lg:px-9"
            >
              <div className="flex flex-wrap gap-5 text-sm">
                <a href="#top">Home</a>
                <a href="#how">How it works</a>
                <a href="#assistant">Assistant</a>
                <a href="#trust">Safety</a>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Button asChild variant="outline">
                  <Link href="/login?next=study">Sign in</Link>
                </Button>
              </div>
            </nav>
            <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-slate-950/60 to-transparent px-8 pb-10 pt-28 text-white">
              <p className="ml-auto max-w-md text-right text-xl leading-relaxed">
                <b className="font-semibold">Atlas</b> is where home learning,
                human guidance and honest evidence meet, so every student has
                people in their corner.
              </p>
              <a
                href="#how"
                className="mt-8 flex items-center gap-3 text-xs uppercase tracking-widest"
              >
                <ArrowDown className="size-4" />
                Discover the idea
              </a>
            </div>
          </div>
        </section>
        <div className="mx-auto max-w-6xl space-y-24 px-6 py-20 sm:px-10 lg:space-y-32">
          <section id="how">
            <SectionHeading
              label="How it works"
              title="Three things that usually live apart, finally connected."
            >
              Atlas brings together the adults who guide a student, the work
              they do every evening, and the evidence that helps everyone
              support them.
            </SectionHeading>
            <div className="grid gap-10 md:grid-cols-3">
              {[
                {
                  kind: "bubble" as const,
                  title: "Human guidance",
                  text: "A qualified advisor who follows a student’s interests and choices over the years.",
                  items: [
                    "Subject choices with an advisor and parent",
                    "Questions and next steps in one place",
                    "The advisor’s words are their own",
                  ],
                },
                {
                  kind: "blue" as const,
                  title: "Everyday home learning",
                  text: "Rewatch a lesson, study with an assistant, and practise in short batches on your own.",
                  items: [
                    "Recorded lessons with chapters",
                    "Explanations and explain-it-back practice",
                    "Independent batches with feedback",
                  ],
                },
                {
                  kind: "lens" as const,
                  title: "Evidence for adults",
                  text: "Teachers, advisors and families see what helps them support a student.",
                  items: [
                    "Help received and own work, kept apart",
                    "Misconceptions with student reasoning",
                    "Lessons worth revisiting",
                  ],
                },
              ].map((item) => (
                <article key={item.title}>
                  <PearlObject kind={item.kind} className="mb-7 size-16" />
                  <h3 className="text-2xl">{item.title}</h3>
                  <p className="mt-4 text-muted-foreground">{item.text}</p>
                  <ul className="mt-5 space-y-3 text-sm">
                    {item.items.map((text) => (
                      <li key={text} className="flex gap-2">
                        <Check className="mt-1 size-3 shrink-0 text-cobalt" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
          <section
            id="assistant"
            className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]"
          >
            <div>
              <SectionHeading
                label="The assistant"
                title="It shows you. You don’t need a tutorial."
              >
                Ask where something is and Atlas points to it. Pick a question
                to explore the interaction.
              </SectionHeading>
              <div className="grid gap-2">
                {[
                  "Where do I submit my batch?",
                  "What should I revisit in physics?",
                  "Where is my subject proposal?",
                ].map((q, i) => (
                  <Button
                    key={q}
                    variant={question === i ? "secondary" : "ghost"}
                    className="h-auto justify-start whitespace-normal py-3 text-left normal-case tracking-normal"
                    aria-pressed={question === i}
                    onClick={() => setQuestion(i)}
                  >
                    <Sparkles className="shrink-0 text-cobalt" />
                    {q}
                  </Button>
                ))}
              </div>
            </div>
            <Card className="gap-0 overflow-hidden p-0">
              <div
                className="flex gap-1.5 border-b px-5 py-4"
                aria-hidden="true"
              >
                {[1, 2, 3].map((i) => (
                  <i
                    key={i}
                    className="size-2 rounded-full bg-muted-foreground/25"
                  />
                ))}
              </div>
              <div className="pearl-panel p-6 sm:p-9">
                <Brand className="mb-8" />
                <h3 className="max-w-sm text-2xl">
                  Hi Lina, pick up where you left off.
                </h3>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    "Finish your batch",
                    "Resume lesson",
                    "Advisor replied",
                    "CS proposal",
                  ].map((title, i) => (
                    <div
                      key={title}
                      className={cn(
                        "mist-panel rounded-xl p-4",
                        ((question === 0 && i === 0) ||
                          (question === 2 && i === 3)) &&
                          "ring-2 ring-cobalt ring-offset-4 ring-offset-background",
                      )}
                    >
                      <PearlObject
                        kind={i % 2 ? "lens" : "blue"}
                        className="mb-5 size-12"
                      />
                      <p className="rounded-lg bg-surface/90 px-2 py-1 text-xs">
                        {title}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-7 rounded-xl border border-cobalt/30 bg-surface p-4 text-sm"
                  aria-live="polite"
                >
                  <p className="eyebrow mb-2 text-cobalt">
                    Scripted assistant example
                  </p>
                  {
                    [
                      "Open Practice batch, answer each problem, then choose ‘Submit the whole batch’.",
                      "Try the Mass vs weight chapter at 6:10. Keep kilograms and newtons separate.",
                      "Open Subjects & path. Your Computer Science proposal is with your advisor.",
                    ][question]
                  }
                </div>
              </div>
            </Card>
          </section>
          <section>
            <SectionHeading
              label="On your screen"
              title="Help that appears where you need it."
            >
              Highlights, study cards and shortcuts. The assistant suggests; you
              stay in control.
            </SectionHeading>
            <div className="grid gap-5 md:grid-cols-3">
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  “Where do I submit my batch?”
                </p>
                <div
                  className={cn(
                    "flex min-h-44 items-center justify-center rounded-xl bg-secondary p-5",
                    highlight && "bg-foreground/15",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full bg-foreground px-4 py-2 text-xs text-background",
                      highlight &&
                        "ring-2 ring-cobalt ring-offset-8 ring-offset-background",
                    )}
                  >
                    Submit the whole batch
                  </span>
                </div>
                <h3 className="text-xl">Highlights</h3>
                <p className="text-sm text-muted-foreground">
                  A short tip, right where you need it. No hunting through
                  menus.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setHighlight(!highlight)}
                >
                  {highlight ? "Clear highlight" : "Show me"}
                </Button>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  “Make flashcards from my mistakes”
                </p>
                <button
                  type="button"
                  aria-label="Flashcard, tap to flip"
                  aria-pressed={flip}
                  onClick={() => setFlip(!flip)}
                  className={cn(
                    "min-h-44 rounded-xl p-5 text-center shadow-pearl",
                    flip ? "bg-[#2a44d6] text-white" : "pearl-panel",
                  )}
                >
                  <span className="mb-3 block text-[10px] uppercase tracking-widest">
                    {flip ? "Answer" : "Question"}
                  </span>
                  {cards[card][flip ? 1 : 0]}
                </button>
                <h3 className="text-xl">Study cards</h3>
                <p className="text-sm text-muted-foreground">
                  Quick checks from a sample lesson. Tap the card to turn it
                  over.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCard((card + 1) % cards.length);
                    setFlip(false);
                  }}
                >
                  Next card
                </Button>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  “Pin the mass vs weight part”
                </p>
                <div className="flex min-h-44 flex-col items-start justify-center gap-3 rounded-xl bg-secondary p-5">
                  <span className="rounded-full border bg-surface px-3 py-1 text-xs">
                    Practice batch
                  </span>
                  {pinned ? (
                    <button
                      type="button"
                      onClick={() => setPinned(false)}
                      className="rounded-full border border-cobalt bg-accent px-3 py-1 text-xs text-cobalt"
                      aria-label="Remove Mass vs weight shortcut"
                    >
                      Mass vs weight · 6:10 ×
                    </button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPinned(true)}
                    >
                      Pin chapter
                    </Button>
                  )}
                </div>
                <h3 className="text-xl">Your own shortcuts</h3>
                <p className="text-sm text-muted-foreground">
                  Everything the assistant adds can be undone or removed.
                </p>
                <Button variant="outline" onClick={() => setPinned(false)}>
                  Reset
                </Button>
              </Card>
            </div>
          </section>
          <section className="grid gap-6 md:grid-cols-2">
            <Card className="p-7 sm:p-9">
              <p className="eyebrow">Practice that’s really yours</p>
              <h2 className="text-3xl">
                The assistant steps back when it matters.
              </h2>
              <p className="text-muted-foreground">
                Short batches on blank paper, followed by feedback on the whole
                set. Explore the proposed flow.
              </p>
              <div className="flex gap-2">
                {["Study", "Practice", "Feedback"].map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      "flex-1 rounded-full px-2 py-2 text-center text-xs",
                      i === step
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary",
                    )}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-3 text-sm" aria-live="polite">
                <LockKeyhole className="size-4 text-cobalt" />
                {
                  [
                    "Ask, explore, and study with help.",
                    "Independent practice. The assistant is paused.",
                    "Review the whole batch, then study again.",
                  ][step]
                }
              </p>
              <Button variant="outline" onClick={() => setStep((step + 1) % 3)}>
                Next step <ArrowRight />
              </Button>
            </Card>
            <Card className="p-7 sm:p-9">
              <p className="eyebrow">Evidence that’s honest</p>
              <h2 className="text-3xl">Help and own work, never blended.</h2>
              <p className="text-muted-foreground">
                See independent understanding alongside work completed with
                help.
              </p>
              <Evidence compact />
              <p className="text-xs text-muted-foreground">
                Illustrative data from the design kit.
              </p>
            </Card>
          </section>
          <section id="roles">
            <SectionHeading
              label="For everyone around the student"
              title="One app. Each person sees what they need."
            />
            <Tabs defaultValue="lina">
              <TabsList className="mb-6 h-auto! w-full flex-wrap justify-start gap-2 bg-transparent">
                {roles.map((role) => (
                  <TabsTrigger
                    key={role.id}
                    value={role.id}
                    className="min-h-11 flex-none rounded-full border px-5"
                  >
                    {role.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {roles.map((role) => (
                <TabsContent key={role.id} value={role.id}>
                  <div className="pearl-panel grid gap-8 overflow-hidden rounded-2xl p-7 sm:p-10 lg:grid-cols-2">
                    <div>
                      <h3 className="max-w-md text-3xl">{role.title}</h3>
                      <p className="mt-5 max-w-lg text-muted-foreground">
                        {role.text}
                      </p>
                      <Button asChild className="mt-7">
                        <Link href={`/preview/${role.id}/home`}>
                          Explore {role.name.toLowerCase()} <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                    <ul className="grid content-center gap-4">
                      {role.points.map((point, i) => (
                        <li
                          key={point}
                          className="flex items-center gap-4 rounded-xl border border-glass bg-card p-4"
                        >
                          <PearlObject
                            kind={i === 1 ? "bubble" : "blue"}
                            className="size-9 shrink-0"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <section id="trust">
            <SectionHeading
              label="Safety and trust · design principles"
              title="Designed for a school, not for engagement."
            />
            <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "AI is always labelled",
                  "Assistant-prepared material has a clear label. Human advice stays distinct.",
                ],
                [
                  "Same permissions as you",
                  "The proposed assistant works within each person’s information boundaries.",
                ],
                [
                  "Analytics stay at school",
                  "The kit separates school analytics from everyday home learning.",
                ],
                [
                  "You press the button",
                  "Joining, sending, agreeing and sharing remain human decisions.",
                ],
                [
                  "No streak pressure",
                  "No flames, endless feeds or pressure to keep a streak. Sessions have an end.",
                ],
                [
                  "Open to every student",
                  "Clubs and shared activities are not filtered by grades.",
                ],
              ].map(([title, text], i) => (
                <article key={title}>
                  <PearlObject
                    kind={
                      i % 3 === 0 ? "bubble" : i % 3 === 1 ? "blue" : "lens"
                    }
                    className="mb-5 size-11"
                  />
                  <h3 className="text-xl">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section id="pilot">
            <SectionHeading
              label="The proposed pilot"
              title="Start small. Measure honestly."
            >
              One subject, one age group and one unit, with a clear account of
              what changed.
            </SectionHeading>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                [
                  "Talk it through",
                  "A conversation with the academic lead about goals, subjects and family participation.",
                ],
                [
                  "Run one unit",
                  "Teachers record lessons, advisors meet students, and independent practice runs alongside.",
                ],
                [
                  "Compare fairly",
                  "A baseline and a matched follow-up. Report sample size and uncertainty, not just a headline.",
                ],
              ].map(([title, text], i) => (
                <Card key={title} className="p-7">
                  <span className="text-5xl font-light text-cobalt">
                    0{i + 1}
                  </span>
                  <h3 className="text-2xl">{title}</h3>
                  <p className="text-muted-foreground">{text}</p>
                </Card>
              ))}
            </div>
          </section>
          <section className="grid gap-10 lg:grid-cols-[.6fr_1fr]">
            <SectionHeading label="Questions" title="Good to know." />
            <Accordion type="single" collapsible>
              {questions.map(([title, text], i) => (
                <AccordionItem key={title} value={`q${i}`}>
                  <AccordionTrigger className="py-5 text-left text-base">
                    {title}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {text}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
          <section
            id="join"
            className="mist-panel relative isolate overflow-hidden rounded-2xl p-8 sm:p-14"
          >
            <PearlObject className="absolute! right-[8%] top-10 w-48 opacity-40 sm:opacity-100" />
            <div className="relative max-w-xl rounded-2xl bg-surface/90 p-6 backdrop-blur-sm sm:p-8">
              <p className="eyebrow mb-5">Explore the idea</p>
              <h2 className="text-4xl">Bring a new perspective to learning.</h2>
              <p className="mt-5 text-muted-foreground">
                Try the Atlas design preview. Pilot signup is not connected yet;
                this form demonstrates the interaction only.
              </p>
              <form
                className="mt-6 flex flex-wrap gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setMessage(
                    "Thanks for exploring Atlas. This is a preview; nothing was sent or saved.",
                  );
                }}
              >
                <label className="sr-only" htmlFor="pilot-email">
                  School email
                </label>
                <Input
                  id="pilot-email"
                  type="email"
                  placeholder="you@school.edu"
                  autoComplete="email"
                  required
                  className="min-w-0 flex-1 basis-44 rounded-full"
                />
                <Button type="submit">Try signup</Button>
              </form>
              <p role="status" className="mt-3 text-sm">
                {message}
              </p>
              <Link
                href="/login?next=study"
                className="mt-3 inline-flex items-center gap-2 text-sm text-cobalt"
              >
                Open the app <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 border-t px-6 py-10">
        <Brand />
        <p className="text-xs text-muted-foreground">
          Atlas Pearl · design preview · illustrative data
        </p>
        <Link href="/files" className="text-sm text-cobalt">
          Your private files
        </Link>
      </footer>
    </>
  );
}
