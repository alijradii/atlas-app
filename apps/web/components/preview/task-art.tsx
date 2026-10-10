"use client";

import {
  BarChart3,
  CalendarDays,
  FileUp,
  Flag,
  Heart,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import "./task-art.css";

export type TaskKind =
  | "practice"
  | "lesson"
  | "advisor"
  | "proposal"
  | "evidence"
  | "upload"
  | "people"
  | "activity"
  | "access"
  | "settings"
  | "followup"
  | "interests"
  | "cards";
const glyphs = {
  evidence: BarChart3,
  upload: FileUp,
  people: UsersRound,
  activity: CalendarDays,
  access: ShieldCheck,
  settings: Settings2,
  followup: Flag,
  interests: Heart,
};

/** Recognizable objects adapted from the supplied Atlas App glass artwork.
 * Progress is an actual 0..1 fraction, never an invented decorative fill. */
export function TaskArt({
  kind,
  initials,
  progress,
}: {
  kind: TaskKind;
  initials?: string;
  progress?: number;
}) {
  const value =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : undefined;
  const Glyph = kind in glyphs ? glyphs[kind as keyof typeof glyphs] : null;
  const liquid = value !== undefined && <span className="task-liquid" />;
  return (
    <span
      className={`atlas-task-art atlas-task-art-${kind}`}
      aria-hidden="true"
      data-task-kind={kind}
      style={{ "--task-progress": `${(value ?? 0) * 100}%` } as CSSProperties}
    >
      {kind === "practice" && (
        <>
          <span className="task-glass task-sheet-back" />
          <span className="task-glass task-sheet-front">
            <span className="task-sheet-lines" />
            {liquid}
          </span>
        </>
      )}
      {kind === "lesson" && (
        <>
          <span className="task-glass task-screen">{liquid}</span>
          <span className="task-play" />
        </>
      )}
      {kind === "advisor" && (
        <>
          <span className="task-glass task-medallion" />
          <span className="task-person-initials">
            {initials ? initials.slice(0, 3) : <UsersRound strokeWidth={1.4} />}
          </span>
        </>
      )}
      {kind === "proposal" && (
        <>
          <svg
            viewBox="0 0 100 100"
            className="task-branches"
            aria-hidden="true"
          >
            <path d="M19 81 79 21M19 81 80 75" />
          </svg>
          <span className="task-glass task-node task-node-origin" />
          <span className="task-glass task-node task-node-upper" />
          <span className="task-glass task-node task-node-lower" />
        </>
      )}
      {kind === "cards" && (
        <>
          <span className="task-glass task-study-card task-study-back" />
          <span className="task-glass task-study-card task-study-middle" />
          <span className="task-glass task-study-card task-study-front">
            <span className="task-sheet-lines" />
            {liquid}
          </span>
        </>
      )}
      {Glyph && <Glyph className="task-functional-glyph" strokeWidth={1.35} />}
    </span>
  );
}
