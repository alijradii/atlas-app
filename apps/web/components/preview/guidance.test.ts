import { expect, test } from "bun:test";
import { resolveGuide } from "./guidance";
import { initialState } from "./state";

test("active batch guidance targets disabled submit without changing the batch", () => {
  const state = initialState();
  const before = JSON.stringify(state);
  expect(
    resolveGuide("lina", "Where do I submit my batch?", state),
  ).toMatchObject({ id: "batch.submit", route: "/preview/lina/practice" });
  expect(JSON.stringify(state)).toBe(before);
});
test("new students start their own batch rather than receiving Lina's submit action", () => {
  expect(
    resolveGuide("sami", "Where do I submit my batch?", initialState())?.id,
  ).toBe("batch.start");
});
test("submitted batches guide to prepare a new batch without resetting answers", () => {
  const state = initialState();
  state.batch = "feedback";
  expect(resolveGuide("lina", "How do I submit my batch?", state)?.id).toBe(
    "batch.new",
  );
  expect(state.batch).toBe("feedback");
});
test("guidance does not expose another role's controls", () => {
  expect(
    resolveGuide("karim", "Where do I submit my batch?", initialState()),
  ).toBeUndefined();
  expect(
    resolveGuide("lina", "Show me teacher analytics", initialState()),
  ).toBeUndefined();
});
test("role guidance opens evidence and approvals without a location scenario", () => {
  const state = initialState();
  expect(resolveGuide("daher", "Show me analytics", state)).toMatchObject({
    id: "analytics.overview",
    route: "/preview/daher/analytics",
  });
  expect(
    resolveGuide("hajj", "Where do I approve activities?", state),
  ).toMatchObject({
    id: "acts.approve",
    route: "/preview/hajj/activities",
  });
  expect(
    resolveGuide("lina", "Where do I find lesson chapters?", state)?.id,
  ).toBe("lesson.chapters");
  expect(resolveGuide("sami", "How do I ask my advisor?", state)?.id).toBe(
    "screen.heading",
  );
});
test("ordinary chat is not treated as an instruction to navigate", () => {
  expect(
    resolveGuide("lina", "I have a practice batch", initialState()),
  ).toBeUndefined();
});

test("staff subject and generic proposal guidance uses the confirmation workflow without changing access", () => {
  const state = initialState();
  const before = JSON.stringify(state);
  for (const request of [
    "Where do I approve proposals?",
    "Where do I confirm a subject choice?",
    "Show me subject proposals",
  ]) {
    expect(resolveGuide("hajj", request, state)).toMatchObject({
      id: "proposal.confirm",
      route: "/preview/hajj/proposals",
      fallback: { id: "screen.heading" },
    });
  }
  expect(JSON.stringify(state)).toBe(before);
});

test("explicit activity proposals retain their separate review destination", () => {
  expect(
    resolveGuide(
      "hajj",
      "Where do I approve activity proposals?",
      initialState(),
    ),
  ).toMatchObject({
    id: "acts.approve",
    route: "/preview/hajj/activities",
  });
});

test("misconception guidance targets the visible tab without assuming hidden evidence is mounted", () => {
  expect(
    resolveGuide(
      "daher",
      "Show me the evidence for misconceptions",
      initialState(),
    ),
  ).toMatchObject({
    id: "analytics.tab",
    route: "/preview/daher/analytics",
  });
});
