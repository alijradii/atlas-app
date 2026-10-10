import type { TaskKind } from "./preview/task-art";

export type HomeGroup = "needs" | "continue" | "waiting" | "done";

export type HomeCard = {
  group: HomeGroup;
  status: string;
  id: string;
  kind: TaskKind;
  label: string;
  title: string;
  sub: string;
  action: string;
  href: string;
  initials?: string;
  progress?: number;
  locked?: boolean;
};
