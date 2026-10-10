import { expect, test } from "@playwright/test";

test("talking in Study starts a saved session without selecting lessons", async ({
  page,
}) => {
  await page.goto("/login?next=study");
  await page.getByLabel("Login", { exact: true }).fill("open-study");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.goto("/study");
  const question = `Help me understand fractions ${Date.now()}`;
  const input = page.getByRole("textbox", {
    name: "Start a study session",
    exact: true,
  });
  await expect(input).toBeEnabled();
  await page.getByRole("link", { name: "New chat", exact: true }).click();
  await expect(input).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Study session", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  let creates = 0;
  let sends = 0;
  let conversationId = "";
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (new URL(request.url()).pathname.endsWith("/study/conversations")) {
      expect(request.postDataJSON().lesson_ids).toEqual([]);
      creates++;
    }
    const match = request
      .url()
      .match(/\/study\/conversations\/([^/]+)\/messages$/);
    if (match) {
      conversationId = match[1];
      sends++;
    }
  });
  await input.fill(question);
  await input.press("Enter");
  await expect(page.locator(".study-message-assistant")).toBeVisible({
    timeout: 60000,
  });
  expect(creates).toBe(1);
  expect(sends).toBe(1);
  await expect(page.getByRole("log", { name: "Study messages" })).toContainText(
    question,
  );
  await expect(
    page.getByRole("region", { name: "Answer sources" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", {
      name: "Message your study agent",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".study-history-row > button:first-child")
    .filter({ hasText: question })
    .click();
  await expect(page.locator(".study-message-assistant")).toBeVisible();
  await expect(page.getByRole("log", { name: "Study messages" })).toContainText(
    question,
  );
  expect(conversationId).toMatch(/^[a-f0-9-]{36}$/);
  await page
    .getByRole("button", {
      name: `Delete conversation ${question}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Delete conversation", exact: true })
    .click();
  await expect(page.locator(".study-conversation")).toHaveCount(0);
});

for (const failFirst of [false, true]) {
  test(`open study works without retrieval configuration${failFirst ? " and preserves a failed first message for retry" : ""}`, async ({
    page,
  }) => {
    const question = "Why does dividing a fraction make it bigger?";
    let created = false;
    let sends = 0;
    const requestIds: string[] = [];
    const conversation = {
      id: "open-session",
      title: "Study session",
      lesson_ids: [],
      created: 1,
      updated: 1,
    };
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
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
      if (path.endsWith("/workspace"))
        return route.fulfill({ json: { roles: ["student"] } });
      if (path.endsWith("/study/status"))
        return route.fulfill({
          json: { rag_configured: false, answer_configured: true },
        });
      if (path.endsWith("/study/lessons")) return route.fulfill({ json: [] });
      if (path.endsWith("/study/conversations")) {
        if (request.method() === "POST") {
          expect(request.postDataJSON().lesson_ids).toEqual([]);
          expect(created).toBe(false);
          created = true;
          return route.fulfill({ status: 201, json: conversation });
        }
        return route.fulfill({ json: created ? [conversation] : [] });
      }
      if (path.endsWith("/messages")) {
        sends++;
        requestIds.push(request.postDataJSON().request_id);
        expect(request.postDataJSON().content).toBe(question);
        if (failFirst && sends === 1)
          return route.fulfill({
            status: 503,
            json: { detail: "Please try your question again" },
          });
        return route.fulfill({
          status: 202,
          json: { id: "run", state: "completed", error: "" },
        });
      }
      if (path.endsWith("/study/conversations/open-session"))
        return route.fulfill({
          json: { ...conversation, messages: [], run: null },
        });
      return route.fulfill({ json: {} });
    });
    await page.goto("/study");
    const input = page.getByRole("textbox", {
      name: "Start a study session",
      exact: true,
    });
    await expect(input).toBeEnabled();
    await input.fill(question);
    await input.press("Enter");
    const savedInput = page.getByRole("textbox", {
      name: "Message your study agent",
      exact: true,
    });
    await expect(savedInput).toBeVisible();
    expect(sends).toBe(1);
    if (failFirst) {
      await expect(savedInput).toHaveValue(question);
      await expect(page.locator(".study-error-banner")).toContainText(
        "Please try your question again",
      );
      await savedInput.press("Enter");
      await expect.poll(() => sends).toBe(2);
      expect(requestIds[1]).toBe(requestIds[0]);
    }
    await expect(savedInput).toHaveValue("");
    await expect(
      page.getByText("Study responses aren’t connected yet."),
    ).toHaveCount(0);
  });
}
