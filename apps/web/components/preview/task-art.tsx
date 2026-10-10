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
import { useId } from "react";
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
  | "interests";

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

/** Artwork repeats the visible task meaning; it never supplies a status alone. */
export function TaskArt({
  kind,
  initials,
  progress,
}: {
  kind: TaskKind;
  initials?: string;
  /** Actual playback fraction from 0 to 1. Omit when there is no watch history. */
  progress?: number;
}) {
  const id = useId();
  const glass = `${id}-glass`;
  const ink = `${id}-ink`;
  const face = `${id}-face`;
  const value =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : undefined;
  const Glyph = kind in glyphs ? glyphs[kind as keyof typeof glyphs] : null;

  return (
    <svg
      className={`atlas-task-art atlas-task-art-${kind}`}
      viewBox="0 0 88 82"
      width="88"
      height="82"
      aria-hidden="true"
      focusable="false"
      data-task-kind={kind}
    >
      <defs>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="atlas-task-glass-light" />
          <stop offset="1" className="atlas-task-glass-shade" />
        </linearGradient>
        <linearGradient id={ink} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="atlas-task-ink-light" />
          <stop offset="1" className="atlas-task-ink-shade" />
        </linearGradient>
        <radialGradient id={face} cx=".28" cy=".2" r=".95">
          <stop offset="0" className="atlas-task-glass-light" />
          <stop offset="1" className="atlas-task-face-shade" />
        </radialGradient>
      </defs>

      {kind === "practice" && (
        <g className="atlas-task-relief">
          <path
            d="M20 9h34l12 12v48a5 5 0 0 1-5 5H20a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z"
            fill={`url(#${glass})`}
            className="atlas-task-glass-edge"
          />
          <path d="M54 9v12h12" className="atlas-task-fold" />
          <g
            fill="none"
            stroke={`url(#${ink})`}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m25 31 3 3 5-6m-8 17 3 3 5-6M40 31h14M40 45h10M25 60h23" />
            <path
              d="m53 57 16-22a3 3 0 0 1 5 4L58 61l-7 4 2-8Z"
              fill={`url(#${glass})`}
            />
            <path d="m66 39 5 4M53 57l5 4" />
          </g>
        </g>
      )}

      {kind === "lesson" && (
        <g className="atlas-task-relief">
          <circle
            cx="44"
            cy="41"
            r="30"
            fill={`url(#${glass})`}
            className="atlas-task-glass-edge"
          />
          <path
            d="M24 30a24 24 0 0 1 32-11"
            fill="none"
            className="atlas-task-highlight"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m38 29 18 12-18 12Z"
            fill={`url(#${ink})`}
            stroke={`url(#${ink})`}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {value !== undefined && (
            <>
              <circle
                cx="44"
                cy="41"
                r="36"
                className="atlas-task-progress-track"
              />
              <circle
                cx="44"
                cy="41"
                r="36"
                fill="none"
                stroke={`url(#${ink})`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeOpacity={value === 0 ? 0 : 1}
                pathLength="1"
                strokeDasharray={`${value} 1`}
                transform="rotate(-90 44 41)"
              />
            </>
          )}
        </g>
      )}

      {kind === "advisor" && (
        <g className="atlas-task-relief">
          <circle
            cx="44"
            cy="40"
            r="31"
            fill={`url(#${face})`}
            className="atlas-task-glass-edge"
          />
          {initials ? (
            <text x="44" y="42" className="atlas-task-initials">
              {initials.slice(0, 3)}
            </text>
          ) : (
            <g fill="none" stroke={`url(#${ink})`} strokeWidth="2.5">
              <circle cx="44" cy="31" r="8" />
              <path d="M29 55v-3a15 12 0 0 1 30 0v3" />
            </g>
          )}
        </g>
      )}

      {kind === "proposal" && (
        <g className="atlas-task-relief">
          <path
            d="M44 67V47c0-15-22-9-22-26m22 26c0-15 22-9 22-26"
            stroke={`url(#${ink})`}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <g fill={`url(#${glass})`} stroke={`url(#${ink})`} strokeWidth="2.5">
            <circle cx="22" cy="18" r="8" />
            <circle cx="66" cy="18" r="8" />
            <circle cx="44" cy="66" r="8" />
          </g>
        </g>
      )}

      {Glyph && (
        <Glyph
          x="12"
          y="9"
          width="64"
          height="64"
          stroke={`url(#${ink})`}
          strokeWidth="1.35"
          className="atlas-task-relief"
        />
      )}
    </svg>
  );
}
