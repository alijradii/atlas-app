import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const password = "synthetic browser password 2036";
const transcript =
  "Newton’s second law relates net force, mass and acceleration: F = m × a. For a 2 kg cart with a net force of 6 N, acceleration is 3 m/s². Mass is the amount of matter. Weight is the gravitational force on that mass.";

async function settleTransitions(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}

async function signIn(page: Page, login = "browser") {
  await page.goto("/login?next=study");
  await page.getByLabel("Login", { exact: true }).fill(login);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.goto("/study");
  await expect(
    page.getByRole("heading", { name: "Your learning space" }),
  ).toBeVisible();
}

test("real study API saves a transcript, answers with a source, restores history and deletes private work", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page);
  const title = `Newton browser ${Date.now()}`;
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  await page.getByLabel("Lesson title", { exact: true }).fill(title);
  await page.getByLabel("Subject (optional)", { exact: true }).fill("Physics");
  await page.getByLabel("Transcript", { exact: true }).fill(transcript);
  await page
    .getByRole("button", { name: "Add transcript", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const selection = page.getByRole("checkbox", {
    name: `Use ${title}`,
    exact: true,
  });
  await expect(selection).toBeEnabled({ timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "New conversation", exact: true }),
  ).toBeDisabled();
  await selection.check();
  await page
    .getByRole("button", { name: "New conversation · 1 lesson", exact: true })
    .click();
  const question = "Explain the key ideas in these lessons.";
  let messagePosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/messages")
    )
      messagePosts++;
  });
  await page
    .getByRole("button", { name: "Explain the key ideas", exact: true })
    .click();
  await expect.poll(() => messagePosts).toBe(1);
  await expect(page.locator(".study-message-assistant")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole("log", { name: "Study messages" })).toContainText(
    question,
  );
  await page
    .getByRole("region", { name: "Answer sources" })
    .getByRole("button")
    .first()
    .click();
  const source = page.getByRole("dialog");
  await expect(
    source.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(source.locator("blockquote")).not.toBeEmpty();
  await source
    .getByRole("button", { name: "Read full transcript", exact: true })
    .click();
  await expect(
    source.getByRole("region", { name: "Full transcript" }),
  ).toHaveText(transcript);
  await page.keyboard.press("Escape");
  const conversationTitle = await page
    .locator(".study-conversation-header h2")
    .innerText();
  await page.reload();
  await page
    .locator(".study-history-row > button:first-child")
    .filter({ hasText: conversationTitle })
    .click();
  await expect(page.getByRole("log", { name: "Study messages" })).toContainText(
    question,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("study-desktop-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await settleTransitions(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("study-desktop-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch to light theme", exact: true })
    .click();
  await settleTransitions(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", {
      name: `Delete conversation ${conversationTitle}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Delete conversation",
      exact: true,
    })
    .click();
  await expect(page.locator(".study-conversation")).toHaveCount(0);
  await page
    .getByRole("button", { name: `Open ${title}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await expect(selection).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/login?next=study");
});

test("real lesson sharing grants only the selected transcript and revocation removes it", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await signIn(page);
  const title = `Shared physics ${Date.now()}`;
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  await page.getByLabel("Lesson title", { exact: true }).fill(title);
  await page
    .getByLabel("Import a text file (optional)", { exact: true })
    .setInputFiles({
      name: "physics.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(transcript),
    });
  await expect(page.getByLabel("Transcript", { exact: true })).toHaveValue(
    transcript,
  );
  await page
    .getByRole("button", { name: "Add transcript", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: `Use ${title}`, exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await page
    .getByRole("button", { name: `Open ${title}`, exact: true })
    .click();
  await page.getByLabel("Share with an account login").fill("study-peer");
  await page.getByRole("button", { name: "Share lesson", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Remove access for study-peer",
      exact: true,
    }),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    const peer = await context.newPage();
    await signIn(peer, "study-peer");
    await peer
      .getByRole("button", { name: "Shared with you", exact: true })
      .click();
    await expect(
      peer.getByRole("checkbox", { name: `Use ${title}`, exact: true }),
    ).toBeEnabled();
    await peer
      .getByRole("button", { name: `Open ${title}`, exact: true })
      .click();
    await expect(
      peer.getByRole("region", { name: "Full transcript" }),
    ).toHaveText(transcript);
    await expect(
      peer.getByRole("button", { name: "Delete lesson", exact: true }),
    ).toHaveCount(0);
    await expect(peer.getByLabel("Share with an account login")).toHaveCount(0);
    await peer.keyboard.press("Escape");
    await page
      .getByRole("button", {
        name: "Remove access for study-peer",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Remove access for study-peer",
        exact: true,
      }),
    ).toHaveCount(0);
    await peer.reload();
    await expect(
      peer.getByRole("checkbox", { name: `Use ${title}`, exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
  await page
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
});

const mockLesson = {
  id: "lesson-a",
  title: "Private algebra",
  subject: "Mathematics",
  state: "ready",
  error: "",
  owned: true,
  created: 1,
};
const mockConversation = {
  id: "thread-a",
  title: "Private study question",
  lesson_ids: ["lesson-a"],
  created: 1,
  updated: 1,
};
const mockMessages = [
  {
    id: "question-a",
    role: "user",
    content: "My private question",
    citations: [],
    created: 1,
  },
];

test("account changes and expired sessions remove private conversations and drafts", async ({
  page,
}) => {
  let account = "alice";
  let expired = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (expired)
      return route.fulfill({
        status: 401,
        json: { detail: "Please sign in again" },
      });
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          csrf: "csrf",
          account_id: account,
          name: account,
          login: account,
          kind: "user",
        },
      });
    if (path.endsWith("/study/status"))
      return route.fulfill({
        json: { rag_configured: true, answer_configured: true },
      });
    if (path.endsWith("/study/lessons"))
      return route.fulfill({ json: account === "alice" ? [mockLesson] : [] });
    if (path.endsWith("/study/conversations"))
      return route.fulfill({
        json: account === "alice" ? [mockConversation] : [],
      });
    return route.fulfill({
      json: { ...mockConversation, messages: mockMessages, run: null },
    });
  });
  await page.goto("/study");
  await page
    .getByRole("button", { name: mockConversation.title, exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText("My private question");
  await page
    .getByRole("textbox", { name: "Ask about your lessons" })
    .fill("An unsent private draft");
  account = "bob";
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.locator(".study-sidebar-intro")).toContainText("bob");
  await expect(
    page.getByText("My private question", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Ask about your lessons" }),
  ).toHaveCount(0);
  await expect(page.getByText("Private algebra", { exact: true })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`,
    ),
  ).not.toContain("private");
  expired = true;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".study-layout")).toHaveCount(0);
});

test("active study polling pauses when hidden and cancellation supports a fresh retry", async ({
  page,
}) => {
  let reads = 0;
  let state = "retrieving";
  let requestId = "";
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          csrf: "csrf",
          account_id: "alice",
          name: "Alice",
          login: "alice",
          kind: "user",
        },
      });
    if (path.endsWith("/study/status"))
      return route.fulfill({
        json: { rag_configured: true, answer_configured: true },
      });
    if (path.endsWith("/study/lessons"))
      return route.fulfill({ json: [mockLesson] });
    if (path.endsWith("/study/conversations"))
      return route.fulfill({ json: [mockConversation] });
    if (path.endsWith("/cancel")) {
      state = "cancelled";
      return route.fulfill({ json: { id: "run-a", state, error: "" } });
    }
    if (path.endsWith("/messages")) {
      requestId = route.request().postDataJSON().request_id;
      state = "queued";
      return route.fulfill({
        status: 202,
        json: { id: "run-b", state, error: "" },
      });
    }
    reads++;
    return route.fulfill({
      json: {
        ...mockConversation,
        messages: mockMessages,
        run: { id: "run-a", state, error: "" },
      },
    });
  });
  await page.goto("/study");
  await page
    .getByRole("button", { name: mockConversation.title, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop response", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenReads = reads;
  await page.waitForTimeout(1750);
  expect(reads).toBe(hiddenReads);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBeGreaterThan(hiddenReads);
  await page
    .getByRole("button", { name: "Stop response", exact: true })
    .click();
  await expect(
    page.getByText("Response stopped", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try response again", exact: true })
    .click();
  await expect.poll(() => requestId).toMatch(/^[a-f0-9-]{36}$/);
  await expect(
    page.getByRole("button", { name: "Stop response", exact: true }),
  ).toBeVisible();
});
