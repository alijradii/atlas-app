"use client";

import { Button } from "@school2036/ui";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  RotateCcw,
} from "lucide-react";
import {
  Children,
  isValidElement,
  type ReactNode,
  useId,
  useState,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./rich-message.css";

export function CopyText({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className="atlas-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("copied");
        } catch {
          setStatus("failed");
        }
      }}
      aria-label={status === "copied" ? "Copied" : label}
    >
      {status === "copied" ? (
        <Check aria-hidden="true" />
      ) : (
        <Copy aria-hidden="true" />
      )}
      <span role="status">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Could not copy — try again"
            : label}
      </span>
    </button>
  );
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children).find(isValidElement);
  if (!isValidElement<{ children?: ReactNode; className?: string }>(child))
    return <pre>{children}</pre>;
  const text = String(child.props.children ?? "").replace(/\n$/, "");
  const language = child.props.className?.replace(/^language-/, "") ?? "text";
  return (
    <div className="atlas-code">
      <div className="atlas-code-toolbar">
        <span>{language}</span>
        <CopyText text={text} label="Copy code" />
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** Markdown is prose only. Interactive controls are separately authored React components. */
export function RichMessage({ text }: { text: string }) {
  return (
    <div className="atlas-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre: CodeBlock,
          a: ({ href, children }) =>
            href ? (
              <a
                href={href}
                target={/^https?:\/\//i.test(href) ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => <span>{alt || "Image"}</span>,
          table: ({ children }) => (
            <div className="atlas-table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export type RecallCard = { q: string; a: string };
export const recallCards: RecallCard[] = [
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

export function StudyDeck() {
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tab, setTab] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const id = useId();
  const tabs = ["Recall", "Notes"];
  const step = (direction: number) => {
    setCard((card + direction + recallCards.length) % recallCards.length);
    setFlipped(false);
  };
  return (
    <section
      className="atlas-study-deck"
      aria-label="Newton’s second law study cards"
    >
      <div className="atlas-deck-heading">
        <div>
          <p className="eyebrow">A quick recall</p>
          <h3>Newton’s second law</h3>
        </div>
        <span className="atlas-mini-label">3 cards</span>
      </div>
      <div
        className="atlas-rich-tabs"
        role="tablist"
        aria-label="Study card views"
      >
        {tabs.map((name, i) => (
          <button
            key={name}
            id={`${id}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={tab === i}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - i;
              setTab(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel-0`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-0`}
        hidden={tab !== 0}
      >
        <p className="atlas-card-count" aria-live="polite">
          Card {card + 1} of {recallCards.length}
        </p>
        <button
          type="button"
          className="atlas-flashcard"
          data-flipped={flipped}
          aria-label={
            flipped ? "Show flashcard question" : "Reveal flashcard answer"
          }
          onClick={() => setFlipped(!flipped)}
        >
          <span className="atlas-flashcard-inner">
            <span className="atlas-flashcard-face" aria-hidden={flipped}>
              <span className="eyebrow">Think it through</span>
              <span>{recallCards[card].q}</span>
              <small>Tap to reveal</small>
            </span>
            <span
              className="atlas-flashcard-face atlas-flashcard-back"
              aria-hidden={!flipped}
            >
              <span className="eyebrow">The idea</span>
              <span>{recallCards[card].a}</span>
              <small>Tap to return</small>
            </span>
          </span>
        </button>
        <div className="atlas-deck-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFlipped(!flipped)}
          >
            <RotateCcw />
            Flip
          </Button>
          <div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous card"
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={() => step(1)}>
              Next card
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      <div
        id={`${id}-panel-1`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-1`}
        hidden={tab !== 1}
        className="atlas-deck-notes"
      >
        <RichMessage
          text={
            "### Keep the relationship in mind\n\n- **Force:** the total push or pull, in newtons.\n- **Mass:** how much matter, in kilograms.\n- **Acceleration:** how quickly velocity changes.\n\n```text\nF = m × a\na = F / m\n```\n\nTry recalling the relationship before looking at the answer."
          }
        />
      </div>
      <div className="atlas-focus-control">
        <label htmlFor={`${id}-minutes`}>
          Your study pace{" "}
          <output htmlFor={`${id}-minutes`}>{minutes} min</output>
        </label>
        <input
          id={`${id}-minutes`}
          type="range"
          min={5}
          max={30}
          step={5}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
        <p>A suggested session length. Start when you’re ready.</p>
      </div>
    </section>
  );
}
