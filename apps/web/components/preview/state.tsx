"use client";
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";

import { restorePreviewState } from "./persistence";

export type Proposal = {
  subject: string;
  reason: string;
  status: "adviser" | "changes" | "parent" | "school" | "agreed";
  note: string;
};
export type PreviewState = {
  tutor: boolean;
  video: boolean;
  onboarded: boolean;
  interests: string[];
  samiInterests: string[];
  joined: string[];
  samiJoined: string[];
  proposals: Proposal[];
  answers: string[];
  stuck: boolean[];
  batch: "active" | "feedback" | "none";
  samiAnswers: string[];
  samiStuck: boolean[];
  samiBatch: "active" | "feedback" | "none";
  work: string[];
  samiWork: string[];
  questions: { text: string; reply: string }[];
  goals: string[];
  completed: string[];
  helpers: string[];
  activityReviews: Record<string, string>;
  meeting: boolean;
  activityDrafts: { title: string; when: string; description: string }[];
  lessonDrafts: { title: string; filename: string; audience: string }[];
  settings: Record<string, boolean>;
  lessonPins: Record<"lina" | "sami", string[]>;
  followups: string[];
};
export function initialState(): PreviewState {
  return {
    tutor: true,
    video: true,
    onboarded: false,
    interests: ["Engineering", "Robotics", "Drawing"],
    samiInterests: [],
    joined: ["robot"],
    samiJoined: [],
    proposals: [
      {
        subject: "cs",
        reason:
          "I want to program the robotics club robot and I enjoy logic puzzles.",
        status: "adviser",
        note: "",
      },
    ],
    answers: ["0.4", "588", "", "", ""],
    stuck: [false, false, false, false, false],
    batch: "active",
    samiAnswers: ["", "", "", "", ""],
    samiStuck: [false, false, false, false, false],
    samiBatch: "none",
    work: ["I divided 4 by 10", "60 × 9.8", "", "", ""],
    samiWork: ["", "", "", "", ""],
    questions: [
      {
        text: "Do universities look at Design & Technology for engineering?",
        reply:
          "Yes, many value a design portfolio. It shows you can take an idea to a prototype. Keep your sketches and photos from every project.",
      },
      {
        text: "Is Advanced Maths too much if I also take Computer Science?",
        reply: "",
      },
    ],
    goals: [
      "Decide between Computer Science and Advanced Mathematics before term 2",
      "Build a small robot for the spring showcase",
    ],
    completed: ["S2"],
    helpers: [],
    activityReviews: {},
    meeting: false,
    activityDrafts: [],
    lessonDrafts: [],
    settings: { studentProposals: true, parentProgress: false },
    lessonPins: { lina: [], sami: [] },
    followups: [],
  };
}
const Context = createContext<{
  state: PreviewState;
  setState: Dispatch<SetStateAction<PreviewState>>;
  reset: () => void;
} | null>(null);
export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("atlas-pearl-preview-v1");
      if (saved) setState(restorePreviewState(saved, initialState()));
    } catch {
      /* An unavailable preview store starts a fresh session. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem("atlas-pearl-preview-v1", JSON.stringify(state));
      } catch {
        /* In-memory preview remains available. */
      }
  }, [state, ready]);
  if (!ready)
    return (
      <main id="main-content" className="grid min-h-screen place-items-center">
        <p role="status">Opening your sample workspace…</p>
      </main>
    );
  return (
    <Context.Provider
      value={{ state, setState, reset: () => setState(initialState()) }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreview() {
  const value = useContext(Context);
  if (!value) throw new Error("PreviewProvider is required");
  return value;
}
