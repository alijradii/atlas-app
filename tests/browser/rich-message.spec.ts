import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });

test("assistant renders Markdown and copies fenced code", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/preview/daher/chat");
  await page
    .getByRole("textbox", { name: "Message the assistant" })
    .fill("Make flashcards");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const conversation = page.getByRole("log");
  await expect(
    conversation.getByRole("heading", {
      name: "A little practice, at your pace",
    }),
  ).toBeVisible();
  await conversation.getByRole("tab", { name: "Notes", exact: true }).click();
  await conversation
    .getByRole("button", { name: "Copy code", exact: true })
    .click();
  await expect(
    conversation.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "F = m × a\na = F / m",
  );
});

test("study cards flip, advance, expose keyboard tabs and a real slider", async ({
  page,
}) => {
  await page.goto("/preview/daher/chat?prompt=Make%20flashcards");
  const deck = page.getByRole("region", {
    name: "Newton’s second law study cards",
  });
  await deck.getByRole("button", { name: "Reveal flashcard answer" }).click();
  await expect(
    deck.getByRole("button", { name: "Show flashcard question" }),
  ).toHaveAttribute("data-flipped", "true");
  await expect(
    deck.getByText("Mass measures matter", { exact: false }),
  ).toBeVisible();
  await deck.getByRole("button", { name: "Next card", exact: true }).click();
  await expect(deck).toContainText("Card 2 of 3");
  await expect(
    deck.getByRole("button", { name: "Reveal flashcard answer" }),
  ).toHaveAttribute("data-flipped", "false");
  await deck.getByRole("tab", { name: "Recall", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    deck.getByRole("tab", { name: "Notes", exact: true }),
  ).toBeFocused();
  await expect(
    deck.getByRole("heading", { name: "Keep the relationship in mind" }),
  ).toBeVisible();
  const pace = deck.getByRole("slider", { name: "Your study pace" });
  await pace.focus();
  await page.keyboard.press("ArrowRight");
  await expect(pace).toHaveValue("15");
  await expect(deck.locator("output")).toHaveText("15 min");
});

test("flashcard prompts cannot bypass active practice or the tutor switch", async ({
  page,
}) => {
  await page.goto("/preview/lina/chat?prompt=Make%20flashcards");
  await expect(
    page.getByRole("heading", { name: "Study help is paused" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Newton’s second law study cards" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message the assistant" }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "atlas-pearl-preview-v1",
      JSON.stringify({ tutor: false }),
    ),
  );
  await page.goto("/preview/daher/chat?prompt=Make%20flashcards");
  await expect(
    page.getByRole("heading", { name: "Assistant unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Newton’s second law study cards" }),
  ).toHaveCount(0);
});

test("study cards fit mobile and obey reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview/daher/chat?prompt=Make%20flashcards");
  const flashcard = page.getByRole("button", {
    name: "Reveal flashcard answer",
  });
  await flashcard.click();
  expect(
    await page
      .locator(".atlas-flashcard-inner")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a typed navigation request in chat opens and highlights the teacher upload control", async ({
  page,
}) => {
  await page.goto("/preview/daher/chat");
  await page
    .getByRole("textbox", { name: "Message the assistant" })
    .fill("Where do I upload a recording?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/daher\/upload\?guide=/);
  await expect(
    page.getByRole("dialog", { name: "Assistant tip" }),
  ).toContainText("Choose a recording here");
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="lessons.upload"]'),
  ).toBeVisible();
});
