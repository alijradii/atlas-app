"use client";
import { Button, Input } from "@school2036/ui";
import { ArrowUp, BookOpen, LockKeyhole, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeading, PearlObject } from "../pearl";
import { type AccountId, fixture } from "./data";
import { Notice, Panel } from "./shared";
import { usePreview } from "./state";

const cards = [
  {
    q: "How do mass and weight differ?",
    a: "Mass measures matter in kilograms. Weight is the gravitational force on that mass, measured in newtons: W = mg.",
  },
  {
    q: "Which force goes into F = ma?",
    a: "The net force: add forces in the same direction and subtract opposing forces.",
  },
  {
    q: "What happens when mass doubles for the same force?",
    a: "Acceleration halves. Rearranging F = ma gives a = F / m.",
  },
];
function reply(text: string, student: boolean) {
  if (!student)
    return "This is a scripted workspace preview. Use the sidebar to explore your evidence, reviews and next steps. No AI service or school records are connected.";
  if (/mass|weight|gravity/i.test(text)) return cards[0].a;
  if (/friction|net|force/i.test(text))
    return "Start by identifying all the forces and their directions. Subtract friction from the applied force to get the net force. Then use a = F / m. Try describing a free-body diagram in your own words.";
  if (/subject|adviser|choice/i.test(text))
    return "Subject choices deserve a conversation. Explore the course requirements in Subjects & path, then bring your goals and questions to your human adviser. This sample assistant does not make that decision for you.";
  return "Let’s start with Newton’s second law. What is the unknown: force, mass or acceleration? Identify that first, then write F = ma. This is a scripted example; try asking about mass and weight, net force, or subject choices.";
}
export function Chat({
  accountId,
  study = false,
  prompt = "",
}: {
  accountId: AccountId;
  study?: boolean;
  prompt?: string;
}) {
  const { state } = usePreview();
  const student = fixture.accounts[accountId].role === "student";
  const paused =
    student &&
    (accountId === "lina" ? state.batch : state.samiBatch) === "active";
  const [messages, setMessages] = useState<
    { id: string; who: string; text: string }[]
  >(() =>
    prompt && !paused && state.tutor
      ? [
          { id: "initial-user", who: "You", text: prompt },
          {
            id: crypto.randomUUID(),
            who: "Atlas · scripted example",
            text: reply(prompt, student),
          },
        ]
      : [],
  );
  const [input, setInput] = useState("");
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <PageHeading
        title={study ? "Study with your agent" : "Your workspace assistant"}
        description="A little direction when you need it. Space to think for yourself."
      />
      <Notice>
        Scripted design preview. Messages stay on this page and are not sent to
        an AI service.
      </Notice>
      {paused ? (
        <Panel title="Your own work comes first">
          <LockKeyhole className="size-7 text-cobalt" />
          <h2 className="text-2xl">Study help is paused</h2>
          <p className="text-muted-foreground">
            Finish or mark every problem in your practice batch, then submit all
            five to get feedback. The assistant resumes after that.
          </p>
          <Button asChild>
            <Link href={`/preview/${accountId}/practice`}>
              Return to practice batch
            </Link>
          </Button>
        </Panel>
      ) : !state.tutor ? (
        <Panel title="Assistant unavailable">
          <p>
            You can still watch lessons, work through practice and talk to your
            adviser.
          </p>
          <Button asChild variant="outline">
            <Link href={`/preview/${accountId}/lessons`}>Browse lessons</Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <Panel
            title={study ? "Newton’s second law · study session" : "Ask Atlas"}
          >
            <div
              className="min-h-64 space-y-5"
              role="log"
              aria-label="Sample conversation"
              aria-live="polite"
            >
              {!messages.length && (
                <div className="py-6 text-center">
                  <PearlObject className="w-20" />
                  <h2 className="mt-5 text-2xl">
                    What would you like to work through?
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                    Try a concept from your lesson. We’ll take it one step at a
                    time.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.who === "You"
                      ? "ml-8 rounded-2xl bg-secondary p-4"
                      : "mr-4 rounded-2xl border p-4"
                  }
                >
                  <p className="eyebrow mb-3">{m.who}</p>
                  <p className="text-sm leading-relaxed">{m.text}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {["Mass vs weight", "Net force", "Subject choices"].map((p) => (
                <Button
                  variant="outline"
                  size="sm"
                  key={p}
                  onClick={() =>
                    setMessages((m) => [
                      ...m,
                      { id: crypto.randomUUID(), who: "You", text: p },
                      {
                        id: crypto.randomUUID(),
                        who: "Atlas · scripted example",
                        text: reply(p, student),
                      },
                    ])
                  }
                >
                  {p}
                </Button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                setMessages((m) => [
                  ...m,
                  { id: crypto.randomUUID(), who: "You", text: input.trim() },
                  {
                    id: crypto.randomUUID(),
                    who: "Atlas · scripted example",
                    text: reply(input, student),
                  },
                ]);
                setInput("");
              }}
            >
              <Input
                aria-label="Message the assistant"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a concept…"
                maxLength={1000}
              />
              <Button
                size="icon"
                type="submit"
                aria-label="Send message"
                disabled={!input.trim()}
              >
                <ArrowUp />
              </Button>
            </form>
          </Panel>
          <div className="space-y-6">
            <Panel title="A quick recall">
              <BookOpen className="size-5 text-cobalt" />
              <p className="text-xs text-muted-foreground">
                Card {card + 1} of {cards.length}
              </p>
              <button
                type="button"
                aria-label={
                  flipped
                    ? "Show flashcard question"
                    : "Reveal flashcard answer"
                }
                onClick={() => setFlipped(!flipped)}
                className="min-h-40 w-full rounded-xl border bg-secondary p-5 text-left text-lg leading-relaxed"
              >
                {flipped ? cards[card].a : cards[card].q}
              </button>
              <div className="flex justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlipped(!flipped)}
                >
                  <RotateCcw />
                  Flip
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCard((card + 1) % cards.length);
                    setFlipped(false);
                  }}
                >
                  Next card
                </Button>
              </div>
            </Panel>
            <Panel title="Ready to try on your own?">
              <p className="text-sm text-muted-foreground">
                Your practice evidence stays separate from work with help.
              </p>
              <Button asChild variant="outline">
                <Link
                  href={`/preview/${accountId}/${student ? "practice" : "home"}`}
                >
                  {student ? "Open practice" : "Back to overview"}
                </Link>
              </Button>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
