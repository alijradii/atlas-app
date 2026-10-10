import { expect, test } from "bun:test";
import type { AccountId } from "./data";
import { homeCards } from "./home-cards";
import { initialState, type PreviewState, type Proposal } from "./state";

function findCard(account: AccountId, id: string, state = initialState()) {
  const card = homeCards(account, state).find((item) => item.id === id);
  if (!card) throw new Error(`Missing ${id} card for ${account}`);
  return card;
}

test("practice and lessons retain their semantic art even in different student card positions", () => {
  const state = initialState();
  for (const batch of ["none", "active", "feedback"] as const) {
    state.batch = batch;
    state.samiBatch = batch;
    for (const account of ["lina", "sami"] as const) {
      expect(findCard(account, "practice", state)).toMatchObject({
        kind: "practice",
        label: "Practice",
        href: `/preview/${account}/practice`,
      });
    }
    expect(findCard("lina", "lesson-L1", state).kind).toBe("lesson");
    expect(findCard("sami", "first-lesson", state).kind).toBe("lesson");
  }
});

test("functional card art identifies human guidance, people and access independently of card position", () => {
  expect(findCard("lina", "advisor")).toMatchObject({
    kind: "advisor",
    label: "Human advisor",
    initials: "MN",
  });
  expect(findCard("karim", "guidance")).toMatchObject({
    kind: "advisor",
    label: "Human advisor",
    initials: "MN",
  });
  expect(findCard("sami", "advisor")).toMatchObject({
    kind: "advisor",
    action: "View matching status",
  });
  expect(findCard("daher", "upload").kind).toBe("upload");
  expect(findCard("nassar", "students").kind).toBe("people");
  expect(findCard("hajj", "access").kind).toBe("access");
  expect(findCard("hajj", "settings").kind).toBe("settings");
});

test("each student's practice action and progress come from their own batch", () => {
  const state = initialState();
  state.batch = "feedback";
  state.samiBatch = "active";
  state.samiAnswers = ["1", "", "", "", ""];
  state.samiStuck = [false, true, false, false, false];
  expect(findCard("lina", "practice", state)).toMatchObject({
    action: "Review feedback",
    title: "Your feedback is ready",
  });
  expect(findCard("sami", "practice", state)).toMatchObject({
    action: "Continue practice",
    sub: "2 of 5 ready · finish on your own",
  });
  state.batch = "none";
  state.samiBatch = "feedback";
  expect(findCard("lina", "practice", state).action).toBe("Start practice");
  expect(findCard("sami", "practice", state).action).toBe("Review feedback");
});

test("only the current reviewer gets a review action and all roles see the same proposal stage", () => {
  const state = initialState();
  const stages: [Proposal["status"], AccountId | null, string][] = [
    ["adviser", "nassar", "Waiting for Dr. Nassar’s review"],
    ["parent", "karim", "Waiting for Karim’s review"],
    ["school", "hajj", "Waiting for the school to confirm"],
    ["changes", null, "Changes requested · review the note"],
    ["agreed", null, "Confirmed by the school"],
  ];
  for (const [status, reviewer, summary] of stages) {
    state.proposals[0].status = status;
    for (const account of ["lina", "nassar", "karim", "hajj"] as const) {
      expect(findCard(account, "proposal-cs", state)).toMatchObject({
        kind: "proposal",
        label: "Subject proposal",
        sub: summary,
        action: account === reviewer ? "Review proposal" : "View proposal",
      });
    }
  }
});

test("teacher evidence keeps its meaning while explaining restricted access", () => {
  const state = initialState();
  expect(findCard("daher", "class-evidence", state)).toMatchObject({
    kind: "evidence",
    locked: true,
    action: "View availability",
  });
  state.school = true;
  expect(findCard("daher", "class-evidence", state)).toMatchObject({
    kind: "evidence",
    locked: false,
    action: "Inspect evidence",
  });
});

test("staff pending count includes student drafts and follows each activity's effective review status", () => {
  const state = initialState();
  const count = () => findCard("hajj", "activities", state).sub;
  expect(count()).toBe("2 proposals waiting for your review");
  state.activityDrafts = ["Chess club", "Garden club", "Drama club"].map(
    (title) => ({ title, when: "Fridays", description: "A student proposal." }),
  );
  expect(count()).toBe("5 proposals waiting for your review");
  state.activityReviews = {
    eco: "approved",
    game: "changes",
    "draft-0": "approved",
  };
  expect(count()).toBe("2 proposals waiting for your review");
  state.activityReviews["draft-0"] = "proposed";
  expect(count()).toBe("3 proposals waiting for your review");
  state.activityReviews.robot = "proposed";
  expect(count()).toBe("4 proposals waiting for your review");
});

test("staff sees all reviewed only after fixture proposals and drafts have left proposed status", () => {
  const state = initialState();
  state.activityDrafts = [
    {
      title: "Chess club",
      when: "Fridays",
      description: "A student proposal.",
    },
  ];
  state.activityReviews = {
    eco: "approved",
    game: "changes",
    "draft-0": "changes",
  };
  expect(findCard("hajj", "activities", state).sub).toBe(
    "All activity proposals reviewed",
  );
});

test("building role cards does not change workflow or access state", () => {
  const state: PreviewState = initialState();
  const before = JSON.stringify(state);
  for (const account of [
    "lina",
    "sami",
    "daher",
    "nassar",
    "karim",
    "hajj",
  ] as const)
    homeCards(account, state);
  expect(JSON.stringify(state)).toBe(before);
});

test("missing subject proposal offers exploration instead of a nonexistent review", () => {
  const state = initialState();
  state.proposals = [];
  expect(findCard("lina", "proposal-cs", state)).toMatchObject({
    action: "Explore subject",
    sub: "No Computer Science proposal yet",
  });
  for (const account of ["nassar", "karim", "hajj"] as const) {
    expect(findCard(account, "proposal-cs", state)).toMatchObject({
      title: "Subject proposals",
      action: "Browse proposals",
    });
  }
});

test("priority follows the current reviewer instead of making every proposal urgent", () => {
  const state = initialState();
  for (const [status, reviewer] of [
    ["adviser", "nassar"],
    ["parent", "karim"],
    ["school", "hajj"],
    ["changes", "lina"],
  ] as const) {
    state.proposals[0].status = status;
    for (const account of ["lina", "nassar", "karim", "hajj"] as const) {
      expect(findCard(account, "proposal-cs", state).group).toBe(
        account === reviewer ? "needs" : "waiting",
      );
    }
  }
  state.proposals[0].status = "agreed";
  expect(findCard("lina", "proposal-cs", state).group).toBe("done");
  state.proposals = [];
  expect(findCard("lina", "proposal-cs", state).group).toBe("continue");
});

test("practice fills use the student's real ready count and move submitted work out of attention", () => {
  const state = initialState();
  state.answers = ["4", "", "", "", ""];
  state.stuck = [false, true, false, false, false];
  expect(findCard("lina", "practice", state)).toMatchObject({
    group: "needs",
    progress: 0.4,
  });
  state.batch = "feedback";
  expect(findCard("lina", "practice", state)).toMatchObject({
    group: "done",
    progress: 1,
    status: "Submitted",
  });
  expect(findCard("sami", "practice", state)).toMatchObject({
    group: "needs",
    progress: 0,
  });
});

test("human matching and unanswered questions go to the actor who can act", () => {
  const state = initialState();
  expect(findCard("sami", "advisor", state)).toMatchObject({
    group: "waiting",
    status: "Being matched",
  });
  state.questions = [{ text: "How do I choose?", reply: "" }];
  expect(findCard("nassar", "student-question", state).group).toBe("needs");
  expect(findCard("lina", "advisor", state).group).toBe("continue");
  state.questions[0].reply = "Let's discuss it.";
  expect(findCard("nassar", "student-question", state).group).toBe("continue");
  expect(findCard("lina", "advisor", state)).toMatchObject({
    group: "needs",
    status: "Reply available",
  });
});
