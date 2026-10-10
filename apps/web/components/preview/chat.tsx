"use client";
import { Button } from "@school2036/ui";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "../pearl";
import {
  PearlChatEmpty,
  PearlChatLayout,
  PearlChatMessage,
} from "../pearl-chat";
import { Composer } from "./composer";
import { type AccountId, fixture } from "./data";
import { resolveGuide } from "./guidance";
import { recallCards, StudyDeck } from "./rich-message";
import { Panel } from "./shared";
import { usePreview } from "./state";

type Message = {
  id: string;
  who: "You" | "Atlas";
  text: string;
  deck?: boolean;
};
function reply(text: string, student: boolean): Pick<Message, "text" | "deck"> {
  if (/flash\s?cards?|study cards|quick recall/i.test(text))
    return {
      text: "### A little practice, at your pace\n\nTry these three cards on **Newton’s second law**. Think of your answer first, then flip each card to check it. You can switch to Notes for the key relationship.",
      deck: true,
    };
  if (!student)
    return {
      text: "### Where would you like to start?\n\nUse your workspace to review **evidence**, explore lessons, and follow up on next steps.\n\nThis is a sample response; a live assistant is not connected yet.",
    };
  if (/mass|weight|gravity/i.test(text))
    return {
      text: `### Mass and weight\n\n${recallCards[0].a}\n\n- **Mass** stays the same when you change location.\n- **Weight** changes with gravitational acceleration.\n\n\`\`\`text\nW = m × g\n\`\`\`\n\nWhat would change if you took the same object to the Moon?`,
    };
  if (/friction|net|force/i.test(text))
    return {
      text: "### Start with the net force\n\n1. Identify all the forces and their directions.\n2. Subtract friction from the applied force.\n3. Use **a = F / m** to find acceleration.\n\nTry describing a free-body diagram in your own words.",
    };
  if (/subject|advis[eo]r|choice/i.test(text))
    return {
      text: "### Bring your questions to your advisor\n\nSubject choices deserve a conversation. Explore the course requirements in **Subjects & path**, then bring your goals and questions to your human advisor.\n\nYour advisor helps you make that decision.",
    };
  return {
    text: "### Let’s work through it\n\nStart with Newton’s second law. What is the unknown: **force**, **mass**, or **acceleration**? Identify that first, then write:\n\n```text\nF = m × a\n```\n\nTry asking about mass and weight, net force, subject choices, or a set of flashcards.",
  };
}
function exchange(text: string, student: boolean): Message[] {
  return [
    { id: crypto.randomUUID(), who: "You", text },
    { id: crypto.randomUUID(), who: "Atlas", ...reply(text, student) },
  ];
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
  const router = useRouter();
  const student = fixture.accounts[accountId].role === "student";
  const paused =
    student &&
    (accountId === "lina" ? state.batch : state.samiBatch) === "active";
  const [messages, setMessages] = useState<Message[]>(() =>
    prompt && !paused && state.tutor ? exchange(prompt, student) : [],
  );
  const [input, setInput] = useState("");
  const send = (text: string) => {
    if (paused || !state.tutor || !text.trim()) return;
    const guide = resolveGuide(accountId, text, state);
    if (guide) {
      setInput("");
      router.push(`${guide.route}?guide=${encodeURIComponent(text.trim())}`);
      return;
    }
    setMessages((items) => [...items, ...exchange(text.trim(), student)]);
    setInput("");
  };
  const hasDeck = messages.some((message) => message.deck);
  const tools = (
    <>
      {!hasDeck && <StudyDeck />}
      <Panel title="Ready to try on your own?">
        <p className="text-sm text-muted-foreground">
          Your practice evidence stays separate from work with help.
        </p>
        <Button asChild variant="outline">
          <Link href={`/preview/${accountId}/${student ? "practice" : "home"}`}>
            {student ? "Open practice" : "Back to overview"}
          </Link>
        </Button>
      </Panel>
      <p className="atlas-chat-boundary">
        Scripted examples · a live AI service is not connected.
      </p>
    </>
  );
  return (
    <>
      <PageHeading
        title={study ? "Study with your agent" : "Your workspace assistant"}
        description="A little direction when you need it. Space to think for yourself."
      />
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
            advisor.
          </p>
          <Button asChild variant="outline">
            <Link href={`/preview/${accountId}/lessons`}>Browse lessons</Link>
          </Button>
        </Panel>
      ) : (
        <PearlChatLayout tools={tools}>
          <div
            className="min-h-64 space-y-6"
            role="log"
            aria-label="Sample conversation"
            aria-live="polite"
          >
            {!messages.length && <PearlChatEmpty />}
            {messages.map((message) => (
              <PearlChatMessage
                key={message.id}
                role={message.who === "You" ? "user" : "assistant"}
                text={message.text}
              >
                {message.deck && <StudyDeck />}
              </PearlChatMessage>
            ))}
          </div>
          <div className="atlas-chat-suggestions">
            {[
              "Mass vs weight",
              "Net force",
              "Subject choices",
              "Make flashcards",
            ].map((suggestion) => (
              <Button
                variant="outline"
                size="sm"
                key={suggestion}
                onClick={() => send(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <Composer
            inline
            value={input}
            onChange={setInput}
            onSubmit={send}
            label="Message the assistant"
            placeholder="Ask about a concept…"
            hint="Sample responses · messages stay on this page"
          />
        </PearlChatLayout>
      )}
    </>
  );
}
