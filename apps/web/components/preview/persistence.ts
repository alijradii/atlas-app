import { fixture } from "./data";
import type { PreviewState } from "./state";

type Validator = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text: Validator = (value) =>
  typeof value === "string" && value.length <= 10000;
const bool: Validator = (value) => typeof value === "boolean";
const list =
  (item: Validator, length?: number): Validator =>
  (value) =>
    Array.isArray(value) &&
    value.length <= 500 &&
    (length === undefined || value.length === length) &&
    value.every(item);
const shape =
  (fields: Record<string, Validator>): Validator =>
  (value) =>
    record(value) &&
    Object.keys(value).length === Object.keys(fields).length &&
    Object.entries(fields).every(
      ([key, valid]) => Object.hasOwn(value, key) && valid(value[key]),
    );
const dictionary =
  (item: Validator): Validator =>
  (value) =>
    record(value) &&
    Object.keys(value).length <= 500 &&
    Object.entries(value).every(
      ([key, entry]) =>
        key.length <= 100 &&
        !["__proto__", "constructor", "prototype"].includes(key) &&
        item(entry),
    );
const batch: Validator = (value) =>
  ["active", "feedback", "none"].includes(value as string);
const strings = list(text);
const lessonIds = new Set(fixture.lessons.map((lesson) => lesson.id));
const pins = list((value) => typeof value === "string" && lessonIds.has(value));
const fields: Record<keyof PreviewState, Validator> = {
  school: bool,
  tutor: bool,
  video: bool,
  onboarded: bool,
  interests: strings,
  samiInterests: strings,
  joined: strings,
  samiJoined: strings,
  proposals: list(
    shape({
      subject: (value) =>
        typeof value === "string" && Object.hasOwn(fixture.subjects, value),
      reason: text,
      note: text,
      status: (value) =>
        ["adviser", "changes", "parent", "school", "agreed"].includes(
          value as string,
        ),
    }),
  ),
  answers: list(text, 5),
  stuck: list(bool, 5),
  work: list(text, 5),
  batch,
  samiAnswers: list(text, 5),
  samiStuck: list(bool, 5),
  samiWork: list(text, 5),
  samiBatch: batch,
  questions: list(shape({ text, reply: text })),
  goals: strings,
  completed: strings,
  helpers: strings,
  activityReviews: dictionary(text),
  meeting: bool,
  activityDrafts: list(shape({ title: text, when: text, description: text })),
  lessonDrafts: list(shape({ title: text, filename: text, audience: text })),
  settings: shape({
    recHome: bool,
    advisersRemote: bool,
    studentProposals: bool,
  }),
  lessonPins: shape({ lina: pins, sami: pins }),
  followups: strings,
};

/** Restore only known, bounded sample state; a malformed snapshot never reaches React. */
export function restorePreviewState(
  raw: string | null,
  defaults: PreviewState,
): PreviewState {
  if (!raw || raw.length > 1000000) return defaults;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!record(saved)) return defaults;
    const result = { ...defaults };
    for (const key of Object.keys(fields) as (keyof PreviewState)[]) {
      if (!Object.hasOwn(saved, key)) continue;
      if (!fields[key](saved[key])) return defaults;
      Object.assign(result, { [key]: saved[key] });
    }
    // The old global pin could only represent the original Lina/L1 shortcut.
    if (!Object.hasOwn(saved, "lessonPins") && saved.pinned === true)
      result.lessonPins = { lina: ["L1"], sami: [] };
    return result;
  } catch {
    return defaults;
  }
}
