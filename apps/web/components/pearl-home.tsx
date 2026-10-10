"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PearlScene } from "./pearl";
import type { HomeCard, HomeGroup } from "./pearl-home-types";
import { TaskArt } from "./preview/task-art";

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

/** One presentation for preview fixtures and authorized, persisted workspace data. */
export function PearlHome({
  firstName,
  roleLabel,
  cards,
  date,
  children,
  actions,
}: {
  firstName: string;
  roleLabel: string;
  cards: HomeCard[];
  date: Date | null;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const done = cards.filter((card) => card.group === "done");
  const needs = cards.filter((card) => card.group === "needs").length;
  const continuing = cards.filter((card) => card.group === "continue").length;
  const waiting = cards.filter((card) => card.group === "waiting").length;
  return (
    <div className="pearl-home">
      <header className="pearl-home-hero pearl-home-greeting">
        <div className="pearl-home-hero-copy">
          <p className="eyebrow">
            {roleLabel} ·{" "}
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
          {actions}
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
      {children}
    </div>
  );
}

export function ActionCard({
  id,
  title,
  sub,
  label,
  href,
  kind,
  initials,
  progress,
  action,
  status,
  group,
  compact = false,
}: HomeCard & { compact?: boolean }) {
  return (
    <Link
      href={href}
      className={`pearl-home-action${compact ? " pearl-home-action-compact" : ""}`}
      data-task-kind={kind}
      data-task-id={id}
      data-task-group={group}
    >
      <div className="pearl-home-action-art">
        <TaskArt kind={kind} initials={initials} progress={progress} />
      </div>
      <span className="pearl-home-action-status">
        <i className="pearl-home-state-dot" aria-hidden="true" />
        {status}
      </span>
      <span className="pearl-home-action-copy">
        <span className="pearl-home-action-kicker">{label}</span>
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      <span className="pearl-home-action-footer">
        {action}
        <ArrowUpRight size={15} aria-hidden="true" />
      </span>
    </Link>
  );
}
