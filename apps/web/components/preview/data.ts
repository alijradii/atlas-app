import fixture from "./fixtures.json";

export { fixture };
export type AccountId = keyof typeof fixture.accounts;
export type Role = "student" | "teacher" | "adviser" | "parent" | "staff";
export type SubjectId = keyof typeof fixture.subjects;
export const accounts = Object.values(fixture.accounts);
export const roleNames: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  adviser: "Advisor",
  parent: "Parent",
  staff: "School staff",
};
export const navigation: Record<Role, [string, string, string][]> = {
  student: [
    ["home", "Home", "home"],
    ["subjects", "Subjects & path", "path"],
    ["lessons", "Lessons", "video"],
    ["study", "Study with agent", "chat"],
    ["practice", "Practice batch", "pen"],
    ["adviser", "My advisor", "user"],
    ["activities", "Interests & activities", "heart"],
  ],
  teacher: [
    ["home", "Home", "home"],
    ["analytics", "Analytics & follow-up", "chart"],
    ["lessons", "My lessons", "video"],
    ["upload", "Upload a session", "upload"],
  ],
  adviser: [
    ["home", "Home", "home"],
    ["students", "My students", "users"],
    ["proposals", "Subject proposals", "path"],
  ],
  parent: [
    ["home", "Home", "home"],
    ["choices", "Subject choices", "path"],
    ["progress", "Progress", "chart"],
  ],
  staff: [
    ["home", "Home", "home"],
    ["proposals", "Subject proposals", "path"],
    ["activities", "Activities review", "heart"],
    ["access", "Access & availability", "shield"],
    ["settings", "School settings", "settings"],
  ],
};
export const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Mr\.|Ms\.)\s*/, "")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
export const subjectName = (id: string) =>
  fixture.subjects[id as SubjectId]?.name ?? id;
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
