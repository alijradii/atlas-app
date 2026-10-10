import { expect, test } from "bun:test";
import { workspaceHomeCards } from "./home-cards";
import type { Assignment, Lesson, Proposal, Workspace } from "./types";

function workspace(account_id = "student"): Workspace {
  return {
    account_id,
    name: "Test account",
    roles: [],
    people: [],
    assignments: [],
    publications: [],
    proposals: [],
    messages: [],
  };
}
const assignment: Assignment = {
  id: "work",
  student_id: "student",
  teacher_id: "teacher",
  title: "Describe gravity",
  instructions: "Use your own words",
  answer: "",
  feedback: "",
  state: "assigned",
  lesson_id: null,
  created: 1,
  submitted_at: null,
  due_at: null,
};
const proposal: Proposal = {
  id: "plan",
  student_id: "student",
  advisor_id: "advisor",
  parent_id: "parent",
  title: "Study physics",
  description: "An idea",
  advisor_note: "",
  parent_note: "",
  state: "pending_advisor",
  created: 1,
  updated: 1,
};
const lesson: Lesson = {
  id: "lesson",
  title: "Session transcript",
  subject: "Physics",
  state: "review",
  owned: true,
  source_kind: "recording",
  has_file: true,
  created: 1,
  error: "",
};

test("an empty authenticated workspace contains no fictional tasks", () => {
  expect(workspaceHomeCards(workspace(), [])).toEqual([]);
});

test("assignment priority follows the responsible person through submit, revision and feedback", () => {
  for (const state of [
    "assigned",
    "submitted",
    "returned",
    "reviewed",
  ] as const) {
    for (const account of ["student", "teacher", "parent"]) {
      const data = workspace(account);
      data.assignments = [{ ...assignment, state }];
      const card = workspaceHomeCards(data, [])[0];
      const needs =
        (account === "student" && ["assigned", "returned"].includes(state)) ||
        (account === "teacher" && state === "submitted");
      expect(card.group).toBe(
        state === "reviewed" ? "done" : needs ? "needs" : "waiting",
      );
      expect(card.href).toBe("/workspace?section=work");
      expect(card.kind).toBe("practice");
    }
  }
});

test("proposal attention follows advisor, parent and student revision without fake school approval", () => {
  const states = {
    pending_advisor: "advisor",
    pending_parent: "parent",
    revision_requested: "student",
    approved: null,
    declined: null,
  } as const;
  for (const [state, responsible] of Object.entries(states)) {
    for (const account of ["student", "advisor", "parent"]) {
      const data = workspace(account);
      data.proposals = [{ ...proposal, state: state as Proposal["state"] }];
      const card = workspaceHomeCards(data, [])[0];
      expect(card.group).toBe(
        responsible === null
          ? "done"
          : responsible === account
            ? "needs"
            : "waiting",
      );
      expect(card.href).toBe("/workspace?section=plans");
    }
  }
});

test("review and failed imports need owner attention while processing and ready materials stay available", () => {
  for (const state of [
    "queued",
    "extracting",
    "review",
    "indexing",
    "ready",
    "failed",
  ] as const) {
    const card = workspaceHomeCards(workspace(), [{ ...lesson, state }])[0];
    expect(card.group).toBe(
      ["review", "failed"].includes(state) ? "needs" : "continue",
    );
    expect(card.href).toBe("/study?lesson=lesson");
    expect(card.progress).toBeUndefined();
  }
  expect(
    workspaceHomeCards(workspace(), [{ ...lesson, owned: false }])[0].group,
  ).toBe("continue");
});

test("published lessons do not duplicate a student's accessible material, but teachers retain sharing controls", () => {
  const data = workspace();
  data.publications = [
    {
      id: "publication",
      lesson_id: lesson.id,
      student_id: "student",
      teacher_id: "teacher",
      title: lesson.title,
      subject: lesson.subject,
      created: 1,
    },
  ];
  expect(workspaceHomeCards(data, [lesson])).toHaveLength(1);
  data.account_id = "teacher";
  expect(
    workspaceHomeCards(data, [lesson]).find(
      (card) => card.id === "publication-publication",
    )?.href,
  ).toBe("/workspace?section=lessons");
});

test("advisor conversations use the latest saved message without inventing unread status", () => {
  const data = workspace();
  data.messages = [
    {
      id: "new",
      student_id: "student",
      advisor_id: "advisor",
      sender_id: "student",
      content: "Thank you",
      created: 2,
    },
    {
      id: "old",
      student_id: "student",
      advisor_id: "advisor",
      sender_id: "advisor",
      content: "Try physics",
      created: 1,
    },
  ];
  const cards = workspaceHomeCards(data, []);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    sub: "Your latest message is saved",
    group: "continue",
    status: "Conversation",
    href: "/workspace?section=messages&student=student",
  });
});
