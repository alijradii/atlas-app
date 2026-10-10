import type { components } from "@school2036/api-client";

export type Session = components["schemas"]["SessionView"];
export type StudyStatus = components["schemas"]["StudyStatus"];
export type Lesson = components["schemas"]["LessonView"];
export type LessonDetail = components["schemas"]["LessonDetail"];
export type Access = components["schemas"]["AccessView"];
export type Citation = components["schemas"]["CitationView"];
export type Conversation = components["schemas"]["ConversationView"];
export type Run = components["schemas"]["RunView"];
export type Message = components["schemas"]["MessageView"];
export type Thread = components["schemas"]["ConversationDetail"];
export const activeRun = (run?: Run | null) =>
  Boolean(run && ["queued", "retrieving", "answering"].includes(run.state));
