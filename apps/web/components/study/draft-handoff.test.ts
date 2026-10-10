import { describe, expect, test } from "bun:test";
import { consumeStudyDraft, saveStudyDraft } from "./draft-handoff";

describe("private study draft handoff", () => {
  test("a same-account draft is consumed once", () => {
    saveStudyDraft("account-a", "Help me understand this recording");
    expect(consumeStudyDraft("account-a")).toBe(
      "Help me understand this recording",
    );
    expect(consumeStudyDraft("account-a")).toBe("");
  });
  test("an account change discards a private draft", () => {
    saveStudyDraft("account-a", "Private study question");
    expect(consumeStudyDraft("account-b")).toBe("");
    expect(consumeStudyDraft("account-a")).toBe("");
  });
  test("a new draft replaces any prior draft and respects the input limit", () => {
    saveStudyDraft("account-a", "Old question");
    saveStudyDraft("account-b", "q".repeat(2001));
    expect(consumeStudyDraft("account-b")).toBe("q".repeat(2000));
  });
});
