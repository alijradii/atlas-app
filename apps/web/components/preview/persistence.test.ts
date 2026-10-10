/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { restorePreviewState } from "./persistence";
import { initialState } from "./state";

describe("preview storage recovery", () => {
  test("valid answers, proposals, and account pins survive a round trip", () => {
    const state = initialState();
    state.answers[2] = "3600";
    state.work[2] = "1200 × 3";
    state.proposals[0].status = "parent";
    state.lessonPins = { lina: ["L2"], sami: ["L1"] };
    expect(restorePreviewState(JSON.stringify(state), initialState())).toEqual(
      state,
    );
  });
  [
    "{",
    "null",
    "[]",
    '"state"',
    '{"answers":null}',
    '{"answers":[]}',
    '{"stuck":[false,false,false,false,"false"]}',
    '{"settings":null}',
    '{"settings":{"studentProposals":null}}',
    '{"proposals":[{"subject":"missing","reason":"x","note":"","status":"adviser"}]}',
    '{"questions":[{"text":42,"reply":""}]}',
    '{"lessonPins":{"lina":["missing"],"sami":[]}}',
    '{"activityReviews":{"__proto__":"x"}}',
    JSON.stringify({ interests: Array(501).fill("Robotics") }),
    JSON.stringify({ work: ["x".repeat(10001), "", "", "", ""] }),
    " ".repeat(1000001),
  ].forEach((raw, index) => {
    test(`rejects invalid snapshot ${index + 1}`, () => {
      const defaults = initialState();
      expect(restorePreviewState(raw, defaults)).toBe(defaults);
    });
  });
  test("older snapshots receive new defaults and migrate only Lina's old pin", () => {
    const restored = restorePreviewState(
      '{"pinned":true,"onboarded":true}',
      initialState(),
    );
    expect(restored.onboarded).toBe(true);
    expect(restored.lessonPins).toEqual({ lina: ["L1"], sami: [] });
    expect(restored.answers).toHaveLength(5);
  });
  test("unknown root fields and prototype keys cannot enter state", () => {
    const restored = restorePreviewState(
      '{"session":"untrusted","__proto__":{"injected":true}}',
      initialState(),
    );
    expect(restored).toEqual(initialState());
    expect(Object.hasOwn(restored, "session")).toBe(false);
    expect(Object.hasOwn(restored, "__proto__")).toBe(false);
  });
});

test("location-era snapshots lose network gates and preserve ongoing work", () => {
  const old = {
    ...initialState(),
    school: false,
    settings: {
      recHome: false,
      advisersRemote: false,
      studentProposals: false,
    },
  };
  old.answers[2] = "3600";
  old.meeting = true;
  const restored = restorePreviewState(JSON.stringify(old), initialState());
  expect(Object.hasOwn(restored, "school")).toBe(false);
  expect(restored.settings).toEqual({
    studentProposals: false,
    parentProgress: false,
  });
  expect(restored.answers[2]).toBe("3600");
  expect(restored.meeting).toBe(true);
});
