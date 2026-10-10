"use client";

import { Button, Card } from "@school2036/ui";
import { ArrowLeft, ArrowRight, Check, Pin, RotateCcw, X } from "lucide-react";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";
import "./landing-demos.css";

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

export function CursorCard({ children }: { children: ReactNode }) {
  const tilt = useRef<HTMLDivElement>(null);

  function resetTilt() {
    tilt.current?.style.removeProperty("--tilt-x");
    tilt.current?.style.removeProperty("--tilt-y");
    tilt.current?.style.removeProperty("--shine-x");
    tilt.current?.style.removeProperty("--shine-y");
  }

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Measure the stationary wrapper so the tilt never feeds back into itself.
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    const y = Math.max(
      0,
      Math.min(1, (event.clientY - bounds.top) / bounds.height),
    );
    tilt.current?.style.setProperty("--tilt-x", `${(0.5 - y) * 14}deg`);
    tilt.current?.style.setProperty("--tilt-y", `${(x - 0.5) * 18}deg`);
    tilt.current?.style.setProperty("--shine-x", `${x * 100}%`);
    tilt.current?.style.setProperty("--shine-y", `${y * 100}%`);
  }

  return (
    <div
      className="landing-cursor-area"
      onPointerMove={followPointer}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
    >
      <div ref={tilt} className="landing-cursor-card">
        {children}
      </div>
    </div>
  );
}

export function FlashcardDemo() {
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground">
        “Make flashcards from my mistakes”
      </p>
      <CursorCard>
        <button
          type="button"
          className="landing-flashcard"
          aria-label="Flashcard, tap to flip"
          aria-pressed={flipped}
          aria-describedby="landing-flashcard-content"
          onClick={() => setFlipped((value) => !value)}
        >
          <span
            key={card}
            className="landing-flashcard-turn"
            data-flipped={flipped}
          >
            {cards[card].map((text, side) => (
              <span
                key={text}
                className="landing-flashcard-face"
                data-answer={side === 1}
                aria-hidden={flipped !== (side === 1)}
              >
                <span className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{side === 1 ? "Answer" : "Question"}</span>
                  <span>
                    0{card + 1} / 0{cards.length}
                  </span>
                </span>
                <span className="my-auto py-4 text-base leading-relaxed">
                  {text}
                </span>
                <span className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <RotateCcw className="size-3" aria-hidden="true" />
                  {side === 1 ? "Tap to revisit" : "Tap to reveal"}
                </span>
              </span>
            ))}
          </span>
        </button>
      </CursorCard>
      <span
        id="landing-flashcard-content"
        className="sr-only"
        aria-live="polite"
      >
        {flipped ? "Answer" : "Question"} {card + 1}:{" "}
        {cards[card][flipped ? 1 : 0]}
      </span>
      <h3 className="text-xl">Study cards</h3>
      <p className="text-sm text-muted-foreground">
        Quick checks from a sample lesson. Tap the card to turn it over.
      </p>
      <Button
        variant="outline"
        className="mt-auto"
        onClick={() => {
          setCard((value) => (value + 1) % cards.length);
          setFlipped(false);
        }}
      >
        Next card <ArrowRight aria-hidden="true" />
      </Button>
    </Card>
  );
}

export function ShortcutsDemo() {
  const [pinned, setPinned] = useState(false);
  const [opened, setOpened] = useState(false);
  const pinButton = useRef<HTMLButtonElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);

  function removePin() {
    setPinned(false);
    setOpened(false);
    pinButton.current?.focus();
  }

  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground">
        “Pin the mass vs weight part”
      </p>
      <CursorCard>
        <div className="landing-shortcuts min-h-60 rounded-xl bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>{opened ? "Sample chapter" : "Your shortcuts"}</span>
            <span>{opened ? "06:10" : `${pinned ? 1 : 0} pinned`}</span>
          </div>
          <div
            className="landing-shortcut-content"
            key={opened ? "chapter" : "pins"}
            aria-live="polite"
          >
            {opened ? (
              <>
                <p className="mb-2 text-sm font-medium">Mass vs weight</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your mass stays the same on the Moon. Your weight changes with
                  gravity: W = mg.
                </p>
              </>
            ) : pinned ? (
              <div className="landing-shortcut-chip flex items-center gap-1 rounded-xl border bg-surface p-1">
                <button
                  type="button"
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-xs"
                  aria-label="Open Mass vs weight shortcut"
                  onClick={() => {
                    previewButton.current?.focus();
                    setOpened(true);
                  }}
                >
                  <Pin className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">
                    Mass vs weight{" "}
                    <span className="block text-muted-foreground">
                      Jump to 6:10
                    </span>
                  </span>
                  <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Remove Mass vs weight shortcut"
                  onClick={removePin}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-input p-4 text-center">
                <Pin
                  className="mx-auto mb-2 size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs text-muted-foreground">
                  Keep a useful moment close.
                </p>
              </div>
            )}
          </div>
          <button
            ref={previewButton}
            type="button"
            className="mt-auto flex min-h-10 items-center gap-2 rounded-lg text-xs text-muted-foreground hover:text-foreground disabled:cursor-default"
            disabled={!opened && !pinned}
            onClick={() => setOpened((value) => !value)}
          >
            {opened ? (
              <ArrowLeft className="size-3" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-3" aria-hidden="true" />
            )}
            {opened
              ? "Back to shortcuts"
              : pinned
                ? "Try your shortcut"
                : "Pin the chapter to try it"}
          </button>
        </div>
      </CursorCard>
      <h3 className="text-xl">Your own shortcuts</h3>
      <p className="text-sm text-muted-foreground">
        Pin a moment, jump back into the lesson, or remove it. It’s your space.
      </p>
      <Button
        ref={pinButton}
        variant="outline"
        className="mt-auto"
        aria-pressed={pinned}
        onClick={() => {
          if (pinned) removePin();
          else setPinned(true);
        }}
      >
        {pinned ? <Check aria-hidden="true" /> : <Pin aria-hidden="true" />}
        {pinned ? "Unpin chapter" : "Pin chapter"}
      </Button>
      <span className="sr-only" role="status">
        {pinned
          ? "Mass vs weight pinned. Open the shortcut to preview the chapter."
          : "No chapters pinned."}
      </span>
    </Card>
  );
}
