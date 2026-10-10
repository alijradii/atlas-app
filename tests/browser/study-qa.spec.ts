import { expect, type Page, test } from "@playwright/test";

const session = {
  csrf: "qa-csrf",
  account_id: "qa-owner",
  name: "Study QA",
  login: "study-qa",
  kind: "user",
};
const lesson = (index: number) => ({
  id: `lesson-${index}`,
  title: `Lesson ${index}`,
  subject: "Physics",
  state: "ready",
  owned: true,
  error: "",
  created: index,
});
const conversation = {
  id: "conversation-qa",
  title: "Study QA conversation",
  lesson_ids: ["lesson-1"],
  created: 1,
  updated: 1,
};
async function workspace(
  page: Page,
  options: { lessons?: number; messages?: number } = {},
) {
  let posts = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      posts++;
      return route.fulfill({
        status: 422,
        json: { detail: "Unexpected study mutation in QA" },
      });
    }
    if (path.endsWith("/auth/me")) return route.fulfill({ json: session });
    if (path.endsWith("/study/status"))
      return route.fulfill({
        json: { rag_configured: true, answer_configured: true },
      });
    if (path.endsWith("/study/lessons"))
      return route.fulfill({
        json: Array.from({ length: options.lessons ?? 1 }, (_, index) =>
          lesson(index + 1),
        ),
      });
    if (path.endsWith("/study/conversations"))
      return route.fulfill({ json: [conversation] });
    return route.fulfill({
      json: {
        ...conversation,
        messages: Array.from({ length: options.messages ?? 0 }, (_, index) => ({
          id: `message-${index}`,
          role: index % 2 ? "assistant" : "user",
          content: `Message ${index}. ${"This paragraph discusses force and acceleration. ".repeat(8)}`,
          citations: [],
          created: index,
        })),
        run: null,
      },
    });
  });
  await page.goto("/study");
  await expect(
    page.getByRole("heading", { name: "Your learning space" }),
  ).toBeAttached();
  return { posts: () => posts };
}

test("ready lesson selection enforces eight sources and lets a student revise that selection", async ({
  page,
}) => {
  const requests = await workspace(page, { lessons: 9 });
  for (let index = 1; index <= 8; index++)
    await page
      .getByRole("checkbox", { name: `Use Lesson ${index}`, exact: true })
      .check();
  const ninth = page.getByRole("checkbox", {
    name: "Use Lesson 9",
    exact: true,
  });
  await expect(ninth).toBeDisabled();
  await expect(
    page.getByText("8 of 8 lessons selected. Uncheck one to choose another.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Use Lesson 1", exact: true })
    .uncheck();
  await expect(ninth).toBeEnabled();
  await ninth.check();
  await expect(
    page.getByRole("button", {
      name: "New conversation · 8 lessons",
      exact: true,
    }),
  ).toBeEnabled();
  expect(requests.posts()).toBe(0);
});

test("Unicode questions respect the service byte limit without losing the draft or posting on Enter", async ({
  page,
}) => {
  const requests = await workspace(page);
  await page
    .getByRole("button", { name: conversation.title, exact: true })
    .click();
  const input = page.getByRole("textbox", {
    name: "Ask about your lessons",
    exact: true,
  });
  const draft = "ع".repeat(1001);
  await input.fill(draft);
  await expect(
    page.getByRole("button", { name: "Send study message", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("This question is too long. Shorten it before sending.", {
      exact: true,
    }),
  ).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveValue(draft);
  expect(requests.posts()).toBe(0);
  await input.fill("ع".repeat(1000));
  await expect(
    page.getByRole("button", { name: "Send study message", exact: true }),
  ).toBeEnabled();
  await input.fill("😀".repeat(501));
  await expect(
    page.getByRole("button", { name: "Send study message", exact: true }),
  ).toBeDisabled();
  await input.fill("😀".repeat(500));
  await expect(
    page.getByRole("button", { name: "Send study message", exact: true }),
  ).toBeEnabled();
});

test("transcript import explains its minimum content before attempting preparation", async ({
  page,
}) => {
  const requests = await workspace(page);
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("A short transcript");
  await page.getByLabel("Transcript", { exact: true }).fill("Just a heading");
  await expect(
    page.getByRole("button", { name: "Add transcript", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Add at least 30 characters of lesson content.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Transcript", { exact: true }).fill("A".repeat(30));
  await expect(
    page.getByRole("button", { name: "Add transcript", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Transcript", { exact: true }).fill("😀".repeat(29));
  await expect(
    page.getByRole("button", { name: "Add transcript", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Transcript", { exact: true }).fill("😀".repeat(30));
  await expect(
    page.getByRole("button", { name: "Add transcript", exact: true }),
  ).toBeEnabled();
  expect(requests.posts()).toBe(0);
});

test("returning to an open shared source rechecks access and removes revoked transcript text", async ({
  page,
}) => {
  let revoked = false;
  const sourceText =
    "This shared transcript must disappear after access is revoked.";
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: session });
    if (path.endsWith("/study/status"))
      return route.fulfill({
        json: { rag_configured: true, answer_configured: true },
      });
    if (path.endsWith("/study/lessons"))
      return route.fulfill({
        json: revoked ? [] : [{ ...lesson(1), owned: false }],
      });
    if (path.endsWith("/study/conversations"))
      return route.fulfill({ json: [] });
    return revoked
      ? route.fulfill({
          status: 404,
          json: { detail: "Lesson not found or access has changed" },
        })
      : route.fulfill({
          json: { ...lesson(1), owned: false, transcript: sourceText },
        });
  });
  await page.goto("/study?lesson=lesson-1");
  await expect(page).toHaveURL(/\/study$/);
  await expect(
    page.getByRole("region", { name: "Full transcript" }),
  ).toHaveText(sourceText);
  revoked = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(sourceText, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText(
    "Lesson not found or access has changed",
  );
});

test("a long conversation keeps the composer and send control reachable in landscape and short viewports", async ({
  page,
}) => {
  await workspace(page, { messages: 40 });
  await page
    .getByRole("button", { name: conversation.title, exact: true })
    .click();
  for (const height of [390, 260]) {
    await page.setViewportSize({ width: 844, height });
    const launcher = page.getByRole("button", {
      name: "Open Atlas assistant",
      exact: true,
    });
    if (await launcher.isVisible()) {
      await launcher.scrollIntoViewIfNeeded();
      await launcher.click();
    }
    const input = page.getByRole("textbox", {
      name: "Ask about your lessons",
      exact: true,
    });
    await input.fill("Help me compare force and acceleration.");
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    const send = page.getByRole("button", {
      name: "Send study message",
      exact: true,
    });
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("the shared New chat navigation resets an open conversation repeatedly without posting", async ({
  page,
}) => {
  const requests = await workspace(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .getByRole("button", { name: conversation.title, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Ask about your lessons", exact: true })
      .fill("An unsent question");
    await page.getByRole("link", { name: "New chat", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Study with your agent", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: "Ask about your lessons",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/study$/);
  }
  expect(requests.posts()).toBe(0);
});

test("a suggested study question reopens the minimized Pearl dock without sending", async ({
  page,
}) => {
  const requests = await workspace(page);
  await page
    .getByRole("button", { name: conversation.title, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Minimize assistant", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Atlas assistant", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explain the key ideas", exact: true })
    .click();
  const input = page.getByRole("textbox", {
    name: "Ask about your lessons",
    exact: true,
  });
  await expect(input).toHaveValue("Explain the key ideas in these lessons.");
  await expect(input).toBeFocused();
  expect(requests.posts()).toBe(0);
});

test("a direct lesson card URL still rejects unavailable source access", async ({
  page,
}) => {
  await workspace(page);
  await page.route("**/api/v1/study/lessons/unavailable", (route) =>
    route.fulfill({
      status: 404,
      json: { detail: "Lesson not found or access has changed" },
    }),
  );
  await page.goto("/study?lesson=unavailable");
  await expect(page.getByRole("dialog")).toContainText(
    "Lesson not found or access has changed",
  );
  await expect(
    page.getByRole("region", { name: "Full transcript" }),
  ).toHaveCount(0);
});
