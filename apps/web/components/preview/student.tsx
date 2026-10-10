"use client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@school2036/ui";
import { GraduationCap, Heart } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "../pearl";
import { type AccountId, fixture, type SubjectId } from "./data";
import { Empty, Notice, Panel, Pipeline, Status, Steps } from "./shared";
import { usePreview } from "./state";

export function Subjects({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const [selected, setSelected] = useState<SubjectId>("cs");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const subject = fixture.subjects[selected];
  const proposal =
    accountId === "sami"
      ? undefined
      : state.proposals.find((p) => p.subject === selected);
  const fresh = accountId === "sami";
  return (
    <>
      <PageHeading
        title="Subjects & path"
        description="A common foundation, with room for what interests you. Make choices with your adviser and family."
      />
      <Tabs defaultValue="mine">
        <TabsList className="h-auto! flex-wrap">
          <TabsTrigger value="mine" className="min-h-10">
            My subjects
          </TabsTrigger>
          <TabsTrigger value="common" className="min-h-10">
            Common curriculum
          </TabsTrigger>
          <TabsTrigger value="optional" className="min-h-10">
            Explore options
          </TabsTrigger>
        </TabsList>
        {["mine", "common", "optional"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="mt-4 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              <Panel
                title={
                  tab === "optional" ? "Optional subjects" : "Your foundation"
                }
              >
                <div className="grid gap-2">
                  {Object.entries(fixture.subjects)
                    .filter(([key, s]) =>
                      tab === "optional"
                        ? s.kind === "optional"
                        : tab === "common"
                          ? s.kind === "common"
                          : s.kind === "common" || (key === "dt" && !fresh),
                    )
                    .map(([key, s]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected === key}
                        className="flex items-center justify-between gap-4 rounded-xl border p-4 text-left aria-pressed:border-cobalt aria-pressed:bg-accent"
                        onClick={() => setSelected(key as SubjectId)}
                      >
                        <span>
                          {s.name}
                          <small className="block text-muted-foreground">
                            {s.kind === "common"
                              ? "Common curriculum"
                              : "Optional subject"}
                          </small>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.hours} h / week
                        </span>
                      </button>
                    ))}
                </div>
              </Panel>
              <div className="space-y-6">
                <Panel title="Look a little closer">
                  <Status>
                    {subject.kind === "common"
                      ? "Common curriculum"
                      : "Optional subject"}
                  </Status>
                  <h2 className="text-3xl">{subject.name}</h2>
                  <p className="text-muted-foreground">{subject.involves}</p>
                  <p className="text-sm">{subject.hours} hours each week</p>
                  <div className="flex flex-wrap gap-2">
                    {subject.tags.map((tag) => (
                      <Status key={tag}>{tag}</Status>
                    ))}
                  </div>
                  {subject.pre.length > 0 && (
                    <div className="space-y-2">
                      <p className="eyebrow">Prerequisites</p>
                      {subject.pre.map((p) => (
                        <p key={p.k} className="flex gap-2 text-sm">
                          <span className="text-cobalt">
                            {fixture.students[
                              accountId === "sami" ? "sami" : "lina"
                            ].met[p.k as "math9" | "math75" | "adv"]
                              ? "✓"
                              : "○"}
                          </span>
                          {p.t}
                          <span className="text-xs text-muted-foreground">
                            {fixture.students[
                              accountId === "sami" ? "sami" : "lina"
                            ].met[p.k as "math9" | "math75" | "adv"]
                              ? "Met"
                              : "To discuss"}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                  {subject.kind === "optional" && (
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button
                          disabled={
                            fresh ||
                            Boolean(
                              proposal && proposal.status !== "changes",
                            ) ||
                            (selected === "dt" && !fresh)
                          }
                        >
                          {fresh
                            ? "Waiting for adviser match"
                            : proposal?.status === "changes"
                              ? "Revise proposal"
                              : proposal
                                ? "Proposal already started"
                                : selected === "dt" && !fresh
                                  ? "In your subjects"
                                  : "Propose this subject"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Propose {subject.name}</DialogTitle>
                          <DialogDescription>
                            Explain what interests you. This creates a sample
                            proposal for the preview adviser.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          className="grid gap-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const reason = String(
                              new FormData(event.currentTarget).get("reason"),
                            );
                            setState((s) => ({
                              ...s,
                              proposals: [
                                ...s.proposals.filter(
                                  (p) => p.subject !== selected,
                                ),
                                {
                                  subject: selected,
                                  reason,
                                  status: "adviser",
                                  note: "",
                                },
                              ],
                            }));
                            setOpen(false);
                            setMessage(
                              "Sample proposal added for adviser review.",
                            );
                          }}
                        >
                          <Label htmlFor="subject-reason">
                            Why this subject?
                          </Label>
                          <Textarea
                            id="subject-reason"
                            name="reason"
                            required
                            minLength={10}
                          />
                          <Button type="submit">Send proposal</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                  {message && (
                    <p role="status" className="text-sm text-cobalt">
                      {message}
                    </p>
                  )}
                </Panel>
                {proposal && !fresh && (
                  <Panel title="Your proposal">
                    <p className="text-sm">{proposal.reason}</p>
                    <Pipeline status={proposal.status} />
                    {proposal.note && (
                      <blockquote className="border-l-2 border-cobalt pl-4 text-sm">
                        {proposal.note}
                      </blockquote>
                    )}
                  </Panel>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

export function Adviser({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const [message, setMessage] = useState("");
  if (accountId === "sami")
    return (
      <>
        <PageHeading title="My adviser" />
        <Panel title="Your next connection">
          <Empty
            title="Your adviser is being matched"
            text="The school matches each student with a qualified specialist. Adding interests helps the match."
          />
        </Panel>
      </>
    );
  return (
    <>
      <PageHeading
        title="My adviser"
        description="A human specialist who follows your interests, goals and choices over the years."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Your adviser">
          <div className="flex items-start gap-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full border bg-surface text-xl">
              MN
            </span>
            <div>
              <h2 className="text-2xl">Dr. Maya Nassar</h2>
              <p className="mt-2 text-muted-foreground">
                {fixture.adviserProfile.field}
              </p>
              <div className="mt-5 space-y-3">
                {fixture.adviserProfile.quals.map((q) => (
                  <p key={q} className="flex gap-3 text-sm">
                    <GraduationCap className="size-4 shrink-0 text-cobalt" />
                    {q}
                  </p>
                ))}
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Speaks {fixture.adviserProfile.langs}
              </p>
            </div>
          </div>
        </Panel>
        <Panel title="Meetings">
          <Status tone="warning">Arrangement to be defined</Status>
          <p className="text-muted-foreground">
            How you meet is still being decided with the school.
          </p>
          <Button
            variant="outline"
            disabled={
              state.meeting || (!state.school && !state.settings.advisersRemote)
            }
            onClick={() => setState((s) => ({ ...s, meeting: true }))}
          >
            {!state.school && !state.settings.advisersRemote
              ? "Conversations available at school"
              : state.meeting
                ? "Conversation requested in preview"
                : "Request a conversation"}
          </Button>
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="My interests & goals">
          <div className="flex flex-wrap gap-2">
            {state.interests.map((i) => (
              <Status key={i}>{i}</Status>
            ))}
          </div>
          <ul className="space-y-2">
            {state.goals.map((goal) => (
              <li key={goal} className="text-sm">
                {goal}
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const goal = String(new FormData(form).get("goal")).trim();
              if (goal) {
                setState((s) => ({
                  ...s,
                  goals: [...new Set([...s.goals, goal])],
                }));
                form.reset();
              }
            }}
          >
            <Input
              name="goal"
              aria-label="New goal"
              placeholder="Add a goal"
              required
            />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        </Panel>
        <Panel title="Agreed next steps">
          <Steps />
        </Panel>
        <Panel title="Questions">
          {state.questions.map((q) => (
            <div key={q.text} className="space-y-3 border-b pb-4">
              <p className="text-sm">{q.text}</p>
              {q.reply ? (
                <blockquote className="rounded-xl bg-accent p-4 text-sm">
                  <span className="mb-2 block text-xs text-cobalt">
                    Dr. Nassar · human adviser
                  </span>
                  {q.reply}
                </blockquote>
              ) : (
                <Status>Waiting for a reply</Status>
              )}
            </div>
          ))}
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const text = String(new FormData(form).get("question")).trim();
              if (text) {
                setState((s) => ({
                  ...s,
                  questions: s.questions.some((q) => q.text === text)
                    ? s.questions
                    : [...s.questions, { text, reply: "" }],
                }));
                setMessage(
                  "Question added to the preview. No message was sent.",
                );
                form.reset();
              }
            }}
          >
            <Label htmlFor="adviser-question">Ask Dr. Nassar something</Label>
            <Textarea name="question" id="adviser-question" required />
            <Button type="submit">Add question</Button>
          </form>
          <p role="status" className="text-xs text-muted-foreground">
            {message}
          </p>
        </Panel>
        <Panel title="Advice received">
          {fixture.students.lina.advice.map((a) => (
            <blockquote key={a.id} className="space-y-2 border-b pb-4 text-sm">
              <p className="text-xs text-cobalt">
                Dr. Nassar · shared with family
              </p>
              {a.txt}
            </blockquote>
          ))}
        </Panel>
      </div>
    </>
  );
}

export function Activities({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const [message, setMessage] = useState("");
  const joinedKey = accountId === "sami" ? "samiJoined" : "joined";
  const interestKey = accountId === "sami" ? "samiInterests" : "interests";
  return (
    <>
      <PageHeading
        title="Interests & activities"
        description="Activities are open to every student, whatever their grades. Joining is always your choice."
      />
      <Panel title="What I’m interested in">
        <div className="flex flex-wrap gap-2">
          {fixture.interests.map((tag) => (
            <Button
              key={tag}
              variant={state[interestKey].includes(tag) ? "default" : "outline"}
              className="normal-case tracking-normal"
              aria-pressed={state[interestKey].includes(tag)}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  [interestKey]: s[interestKey].includes(tag)
                    ? s[interestKey].filter((x) => x !== tag)
                    : [...s[interestKey], tag],
                }))
              }
            >
              {tag}
            </Button>
          ))}
        </div>
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        {fixture.activities
          .filter(
            (a) => (state.activityReviews[a.id] || a.status) === "approved",
          )
          .map((a) => (
            <Panel
              key={a.id}
              title={a.title}
              action={<Heart className="size-4 text-cobalt" />}
            >
              <p className="text-sm text-muted-foreground">
                {a.when} · {a.where}
              </p>
              <p className="text-sm">Led by {a.lead}</p>
              <div className="flex flex-wrap gap-2">
                {a.tags.map((tag) => (
                  <Status key={tag}>{tag}</Status>
                ))}
              </div>
              {state[joinedKey].includes(a.id) ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      [joinedKey]: s[joinedKey].filter((x) => x !== a.id),
                    }))
                  }
                >
                  Leave activity
                </Button>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      I’d like to join {a.title}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join {a.title}?</DialogTitle>
                      <DialogDescription>
                        In the proposed experience, joining shares your name
                        with the activity lead. This preview only records a
                        sample choice.
                      </DialogDescription>
                    </DialogHeader>
                    <Button
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          [joinedKey]: [...new Set([...s[joinedKey], a.id])],
                        }));
                      }}
                    >
                      Join activity
                    </Button>
                  </DialogContent>
                </Dialog>
              )}
              <p className="text-xs text-muted-foreground">
                {state[joinedKey].includes(a.id)
                  ? "You’re taking part in this preview."
                  : `${a.spots - a.joined} places in the sample group`}
              </p>
            </Panel>
          ))}
      </div>
      {state.settings.studentProposals ? (
        <Panel title="Propose an activity">
          {state.activityDrafts.map((a) => (
            <Notice key={a.title}>
              {a.title} · waiting for preview review
            </Notice>
          ))}
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setState((s) => ({
                ...s,
                activityDrafts: [
                  ...s.activityDrafts,
                  {
                    title: String(data.get("title")),
                    when: String(data.get("when")),
                    description: String(data.get("description")),
                  },
                ],
              }));
              form.reset();
              setMessage("Activity added to the preview review list.");
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="activity-title">Name</Label>
                <Input
                  id="activity-title"
                  name="title"
                  placeholder="e.g. Chess club"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="activity-when">When</Label>
                <Input
                  id="activity-when"
                  name="when"
                  placeholder="e.g. Fridays after school"
                  required
                />
              </div>
            </div>
            <Label htmlFor="activity-description">What would you do?</Label>
            <Textarea id="activity-description" name="description" required />
            <Button type="submit" className="justify-self-start">
              Send for preview review
            </Button>
          </form>
          <p role="status" className="text-sm text-cobalt">
            {message}
          </p>
        </Panel>
      ) : (
        <Notice>
          Student activity proposals are disabled in the school preview
          settings.
        </Notice>
      )}
    </>
  );
}
