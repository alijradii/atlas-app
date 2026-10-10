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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@school2036/ui";
import { ArrowRight, Check, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "../pearl";
import { type AccountId, fixture, subjectName } from "./data";
import {
  Empty,
  Evidence,
  Notice,
  Panel,
  Pipeline,
  Restricted,
  Status,
  Steps,
} from "./shared";
import { type Proposal, usePreview } from "./state";

export function Proposals({ accountId }: { accountId: AccountId }) {
  const { state, setState } = usePreview();
  const parent = accountId === "karim";
  const staff = accountId === "hajj";
  const update = (subject: string, status: Proposal["status"], note: string) =>
    setState((s) => ({
      ...s,
      proposals: s.proposals.map((p) =>
        p.subject === subject ? { ...p, status, note } : p,
      ),
    }));
  return (
    <>
      <PageHeading
        title={parent ? "Subject choices" : "Subject proposals"}
        description="A choice made together. Student proposes, advisor recommends, family reviews, school confirms."
      />
      <Notice>
        These decisions update the sample workflow in this browser session only.
      </Notice>
      {state.proposals.map((p) => (
        <Panel
          key={p.subject}
          title={`${parent ? "Lina’s choice" : "Lina Haddad"} · ${subjectName(p.subject)}`}
          action={
            <Status tone={p.status === "agreed" ? "success" : "default"}>
              {p.status === "changes"
                ? "Changes requested"
                : p.status === "agreed"
                  ? "Confirmed"
                  : `With ${p.status === "adviser" ? "advisor" : p.status}`}
            </Status>
          }
        >
          <p className="text-lg">“{p.reason}”</p>
          <p className="text-sm text-muted-foreground">
            {
              fixture.subjects[p.subject as keyof typeof fixture.subjects]
                ?.involves
            }
          </p>
          <Pipeline status={p.status} />
          {p.note && (
            <blockquote className="rounded-xl bg-secondary p-4 text-sm">
              Latest review note: {p.note}
            </blockquote>
          )}
          {((!parent && !staff && p.status === "adviser") ||
            (parent && p.status === "parent") ||
            (staff && p.status === "school")) && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const note = String(
                  new FormData(e.currentTarget).get("note") || "",
                );
                update(
                  p.subject,
                  staff ? "agreed" : parent ? "school" : "parent",
                  note,
                );
              }}
            >
              <Label htmlFor={`note-${p.subject}`}>
                {parent ? "Your thoughts for Lina" : "Review note"}
              </Label>
              <Textarea
                id={`note-${p.subject}`}
                name="note"
                placeholder="Add context for the next conversation…"
                maxLength={1000}
                required
              />
              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  {staff
                    ? "Confirm choice"
                    : parent
                      ? "Agree and send to school"
                      : "Recommend to parent"}
                  <ArrowRight />
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    update(
                      p.subject,
                      "changes",
                      "Please discuss the subject load with your advisor before resubmitting.",
                    )
                  }
                >
                  Request changes
                </Button>
              </div>
            </form>
          )}
        </Panel>
      ))}
      {!state.proposals.length && (
        <Empty
          title="No proposals yet"
          text="A student’s subject proposal will appear here for review."
        />
      )}
      {parent && (
        <Panel title="Current optional subject">
          <h2 className="text-xl">Design & Technology</h2>
          <p className="text-muted-foreground">
            Sketching, prototyping and a portfolio. Recommended by Dr. Nassar to
            support Lina’s engineering interests.
          </p>
        </Panel>
      )}
    </>
  );
}
export function Students() {
  const [query, setQuery] = useState("");
  return (
    <>
      <PageHeading
        title="My students"
        description="Different interests, different pathways. Keep the next conversation in sight."
      />
      <div className="relative">
        <Search className="absolute top-3 left-3 size-4" />
        <Input
          aria-label="Search students"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or interest"
          className="pl-10"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {fixture.caseload
          .filter((s) =>
            `${s.name} ${s.interests.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((s) => (
            <Panel
              key={s.id}
              title={`Grade ${s.grade}`}
              action={s.pending ? <Status>Choice to review</Status> : undefined}
            >
              <h2 className="text-2xl">{s.name}</h2>
              <div className="flex flex-wrap gap-2">
                {s.interests.map((i) => (
                  <Status key={i}>{i}</Status>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {s.due || "No follow-up due"}
              </p>
              <Button asChild variant="outline">
                <Link href={`/preview/nassar/student/${s.id}`}>
                  Open workspace
                  <ArrowRight />
                </Link>
              </Button>
            </Panel>
          ))}
      </div>
      {!fixture.caseload.some((s) =>
        `${s.name} ${s.interests.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) && (
        <Empty
          title="No matching students"
          text="Try another name or interest."
        />
      )}
    </>
  );
}
export function StudentDetail({ id }: { id: string }) {
  const { state, setState } = usePreview();
  const student = fixture.caseload.find((s) => s.id === id);
  if (!student) return null;
  return (
    <>
      <PageHeading
        eyebrow={`Grade ${student.grade} · advisor workspace`}
        title={student.name}
        description={student.interests.join(" · ")}
      />
      {id !== "lina" ? (
        <>
          <Panel title="Pathway">
            <div className="flex flex-wrap gap-2">
              {student.chosen.map((s) => (
                <Status key={s}>{s}</Status>
              ))}
            </div>
            <p>{student.due || "No follow-up due"}</p>
          </Panel>
          <Empty
            title="A little more to learn"
            text="This sample student has a pathway summary. Lina’s workspace includes the complete guidance and evidence preview."
          />
          <Button asChild variant="outline">
            <Link href="/preview/nassar/student/lina">
              Explore Lina’s workspace
            </Link>
          </Button>
        </>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Independent & assisted evidence">
              <Evidence />
            </Panel>
            <Panel title="Agreed next steps">
              <Steps />
              <h3 className="eyebrow pt-4">Goals</h3>
              {state.goals.map((g) => (
                <p key={g} className="text-sm">
                  {g}
                </p>
              ))}
              <Button asChild variant="outline">
                <Link href="/preview/nassar/proposals">
                  Review subject proposals
                </Link>
              </Button>
            </Panel>
          </div>
          <Panel title="Student questions">
            {state.questions.map((q, i) => (
              <div
                key={q.text}
                className="space-y-3 border-b pb-5 last:border-0"
              >
                <h3 className="text-lg">{q.text}</h3>
                {q.reply ? (
                  <blockquote className="border-l-2 border-cobalt pl-4 text-sm text-muted-foreground">
                    {q.reply}
                  </blockquote>
                ) : (
                  <form
                    className="grid gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reply = String(
                        new FormData(e.currentTarget).get("reply"),
                      ).trim();
                      if (reply)
                        setState((s) => ({
                          ...s,
                          questions: s.questions.map((v, k) =>
                            i === k ? { ...v, reply } : v,
                          ),
                        }));
                    }}
                  >
                    <Textarea
                      name="reply"
                      aria-label={`Reply to ${q.text}`}
                      required
                      maxLength={2000}
                      placeholder="Your advice, in your words"
                    />
                    <Button type="submit" className="justify-self-start">
                      Save sample reply
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </Panel>
          <Panel title="Guidance shared with the family">
            {fixture.students.lina.advice.map((a) => (
              <p key={a.id} className="border-l-2 border-cobalt pl-4">
                {a.txt}
              </p>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
export function Progress() {
  return (
    <>
      <PageHeading
        title="Lina’s progress"
        description="A view for a conversation, with independent and assisted work shown separately."
      />
      <Notice>
        Illustrative parent view. A real school’s parent-access policy has not
        been configured.
      </Notice>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Subject evidence">
          <Evidence />
        </Panel>
        <Panel title="What the numbers mean">
          <p className="text-lg">
            Support helps. Independent practice shows what stays.
          </p>
          <p className="text-muted-foreground">
            A gap between the two is a reason to ask questions, not a label for
            a student. These fixed percentages are sample evidence.
          </p>
          <Steps />
        </Panel>
      </div>
    </>
  );
}
export function Analytics() {
  const { state, setState } = usePreview();
  const [group, setGroup] = useState("all");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  if (!state.school)
    return (
      <>
        <PageHeading
          title="Analytics & follow-up"
          description="Evidence for better teaching, with context."
        />
        <Restricted />
      </>
    );
  const rows = fixture.analytics.cls.filter(
    (s) =>
      (group === "all" || s.cls === group) &&
      (filter === "all" || (filter === "help" ? s.dep : s.mw)),
  );
  const follow = (title: string) => {
    setState((s) => ({
      ...s,
      followups: [...new Set([...s.followups, title])],
    }));
    setMessage("Added to the sample follow-up list.");
  };
  return (
    <>
      <PageHeading
        title="Analytics & follow-up"
        eyebrow="Physics · Grade 10"
        description="Look at the work, understand the pattern, choose what to do next."
      />
      {message && (
        <p role="status" className="text-sm text-cobalt">
          {message}
        </p>
      )}
      <Tabs defaultValue="class">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="class">Class evidence</TabsTrigger>
          <TabsTrigger value="misconceptions">Misconceptions</TabsTrigger>
          <TabsTrigger value="teaching">Teaching flags</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>
        <TabsContent value="class" className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Class"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="rounded-xl border bg-surface p-3"
            >
              <option value="all">All classes</option>
              <option>10A</option>
              <option>10B</option>
            </select>
            <select
              aria-label="Evidence filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border bg-surface p-3"
            >
              <option value="all">All students</option>
              <option value="help">Large help gap</option>
              <option value="mass">Mass / weight confusion</option>
            </select>
          </div>
          <Panel title={`${rows.length} students · sample evidence`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">
                  Independent and assisted physics evidence
                </caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Student",
                      "Class",
                      "On their own",
                      "With help",
                      "Attempts",
                      "Follow-up",
                    ].map((h) => (
                      <th scope="col" className="px-2 py-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t">
                      <th scope="row" className="px-2 py-4 font-medium">
                        {s.name}
                      </th>
                      <td className="px-2">{s.cls}</td>
                      <td className="px-2 text-cobalt">
                        {s.ind === null ? "No evidence" : `${s.ind}%`}
                      </td>
                      <td className="px-2">
                        {s.as === null ? "—" : `${s.as}%`}
                      </td>
                      <td className="px-2">{s.attempts}</td>
                      <td className="px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => follow(`Check in with ${s.name}`)}
                        >
                          {state.followups.includes(`Check in with ${s.name}`)
                            ? "Planned"
                            : "Plan check-in"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="misconceptions" className="mt-5 grid gap-5">
          {fixture.analytics.misconceptions.map((m) => (
            <Panel
              key={m.id}
              title={m.concept}
              action={
                <Status>
                  {m.n} of {m.of} students
                </Status>
              }
            >
              <h2 className="text-xl">{m.title}</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Examine evidence</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{m.title}</DialogTitle>
                    <DialogDescription>
                      Synthetic answers from the kit. An interpretation is a
                      prompt for review, not a diagnosis.
                    </DialogDescription>
                  </DialogHeader>
                  {m.examples.map((e) => (
                    <div
                      key={e.who}
                      className="space-y-2 rounded-xl border p-4"
                    >
                      <h3>
                        {e.who} · answer: {e.ans}
                      </h3>
                      <blockquote className="text-sm text-muted-foreground">
                        {e.reason}
                      </blockquote>
                      <Status>
                        {e.assist === "none" ? "Independent" : "With a hint"}
                      </Status>
                    </div>
                  ))}
                </DialogContent>
              </Dialog>
              <Button
                onClick={() => follow(`Revisit ${m.concept}`)}
                variant="secondary"
              >
                Plan a follow-up
              </Button>
            </Panel>
          ))}
        </TabsContent>
        <TabsContent value="teaching" className="mt-5 grid gap-5">
          {fixture.analytics.flags.map((f) => (
            <Panel key={f.id} title={f.kind}>
              <h2 className="text-xl">{f.target}</h2>
              <p>{f.evidence}</p>
              <p className="rounded-xl bg-secondary p-4 text-sm">{f.suggest}</p>
              <Button
                variant="outline"
                onClick={() => follow(`Review ${f.target}`)}
              >
                Add to follow-ups
              </Button>
            </Panel>
          ))}
        </TabsContent>
        <TabsContent value="followups" className="mt-5">
          <Panel title="Your teaching follow-ups">
            {state.followups.length ? (
              state.followups.map((f) => (
                <div
                  key={f}
                  className="flex items-center justify-between gap-4 border-b py-3"
                >
                  <p>{f}</p>
                  <Button
                    variant="ghost"
                    aria-label={`Complete ${f}`}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        followups: s.followups.filter((x) => x !== f),
                      }))
                    }
                  >
                    <Check />
                    Done
                  </Button>
                </div>
              ))
            ) : (
              <Empty
                title="Room for a next step"
                text="Add a check-in from class evidence or a teaching flag."
              />
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
export function StaffActivities() {
  const { state, setState } = usePreview();
  const [filter, setFilter] = useState("pending");
  const activities = [
    ...fixture.activities.map((a) => ({
      id: a.id,
      title: a.title,
      when: a.when,
      description: a.lead,
      status: a.status,
    })),
    ...state.activityDrafts.map((a, i) => ({
      ...a,
      id: `draft-${i}`,
      status: "proposed",
    })),
  ];
  return (
    <>
      <PageHeading
        title="Activities review"
        description="Help student ideas become safe, well-supported activities."
      />
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">Needs review</TabsTrigger>
          <TabsTrigger value="all">All activities</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} key={filter} className="mt-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {activities
              .filter(
                (a) =>
                  filter === "all" ||
                  (state.activityReviews[a.id] || a.status) === "proposed",
              )
              .map((a) => (
                <Panel
                  key={a.id}
                  title={a.when}
                  action={
                    <Status>{state.activityReviews[a.id] || a.status}</Status>
                  }
                >
                  <h2 className="text-2xl">{a.title}</h2>
                  <p className="text-muted-foreground">{a.description}</p>
                  {(state.activityReviews[a.id] || a.status) === "proposed" && (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setState((s) => ({
                          ...s,
                          activityReviews: {
                            ...s.activityReviews,
                            [a.id]: "approved",
                          },
                        }));
                      }}
                    >
                      <Label htmlFor={`sponsor-${a.id}`}>
                        Staff sponsor and location
                      </Label>
                      <Input
                        id={`sponsor-${a.id}`}
                        required
                        placeholder="Confirm supervision and a suitable space"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit">Approve sample activity</Button>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              activityReviews: {
                                ...s.activityReviews,
                                [a.id]: "changes requested",
                              },
                            }))
                          }
                        >
                          Request changes
                        </Button>
                      </div>
                    </form>
                  )}
                </Panel>
              ))}
          </div>
          {!activities.some(
            (a) => (state.activityReviews[a.id] || a.status) === "proposed",
          ) &&
            filter === "pending" && (
              <Empty
                title="All caught up"
                text="No sample activities are waiting for review."
              />
            )}
        </TabsContent>
      </Tabs>
    </>
  );
}
export function Access() {
  return (
    <>
      <PageHeading
        title="Access & availability"
        description="Clear boundaries for school and home."
      />
      <Notice>
        This matrix describes the kit’s proposed access model. Preview toggles
        do not grant access to real school data.
      </Notice>
      <Panel title="Proposed availability">
        <section
          className="overflow-x-auto"
          aria-label="Proposed availability table"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the wide table.
          tabIndex={0}
        >
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr>
                {["Service", "At school", "From home"].map((h) => (
                  <th scope="col" className="py-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Recorded lessons", "Available", "School decides"],
                ["Study assistant", "Available", "Available"],
                ["Independent practice", "Available", "Available"],
                ["Human advisor", "Available", "School decides"],
                ["Teacher analytics", "Available", "School network only"],
                ["Parent progress", "School decides", "School decides"],
              ].map((row) => (
                <tr key={row[0]} className="border-t">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th scope="row" key={cell} className="py-4 font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={i === 1 ? "school" : "home"}
                        className="py-4 text-muted-foreground"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Panel>
    </>
  );
}
export function Settings() {
  const { state, setState } = usePreview();
  return (
    <>
      <PageHeading
        title="School settings"
        description="Make the boundaries clear, and leave room for people."
      />
      <Notice>
        These switches only change this preview. Production policy and
        authorization remain in the Python API.
      </Notice>
      <Panel title="Availability preferences">
        {[
          [
            "recHome",
            "Recorded lessons from home",
            "Let students revisit school recordings outside campus.",
          ],
          [
            "advisersRemote",
            "Remote advisor conversations",
            "Make space for guidance beyond the school day.",
          ],
          [
            "studentProposals",
            "Student activity proposals",
            "Let students bring their interests to the school.",
          ],
          [
            "parentProgress",
            "Parent progress preview",
            "Explore how independent and assisted evidence could be shared.",
          ],
        ].map(([key, title, description]) => (
          <label
            htmlFor={`setting-${key}`}
            key={key}
            className="flex items-center justify-between gap-6 border-b py-4 last:border-0"
          >
            <span>
              <span className="text-lg">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description}
              </span>
            </span>
            <Switch
              id={`setting-${key}`}
              aria-label={title}
              checked={!!state.settings[key]}
              onCheckedChange={(checked) =>
                setState((s) => ({
                  ...s,
                  settings: { ...s.settings, [key]: checked },
                }))
              }
            />
          </label>
        ))}
      </Panel>
      <Proposals accountId="hajj" />
    </>
  );
}
