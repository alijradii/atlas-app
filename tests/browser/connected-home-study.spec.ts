import { expect, test } from "@playwright/test";

test("Pearl home carries a private question into source-backed study without sending it early", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Login", { exact: true }).fill("browser");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".pearl-home-greeting")).toBeVisible();
  const title = `Home sources ${Date.now()}`;
  const id = await page.evaluate(async (title) => {
    const identity = await (await fetch("/api/v1/auth/me")).json();
    const response = await fetch("/api/v1/study/lessons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": identity.csrf,
      },
      body: JSON.stringify({
        title,
        subject: "Physics",
        transcript:
          "Newton's second law states that net force is mass times acceleration. A four kilogram cart under a net force of ten newtons accelerates at 2.5 metres per second squared.",
      }),
    });
    if (!response.ok) throw new Error(`Create lesson: ${response.status}`);
    return (await response.json()).id as string;
  }, title);
  await expect
    .poll(
      async () =>
        page.evaluate(
          async (id) =>
            (await (await fetch(`/api/v1/study/lessons/${id}`)).json()).state,
          id,
        ),
      { timeout: 60000 },
    )
    .toBe("ready");
  let sends = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/conversations\/[^/]+\/messages$/.test(request.url())
    )
      sends++;
  });
  const question = "What does this lesson say about force and acceleration?";
  await page
    .getByRole("textbox", { name: "Ask the assistant", exact: true })
    .fill(question);
  await page.getByRole("button", { name: "Minimize assistant" }).click();
  await page.getByRole("button", { name: "Open Atlas assistant" }).click();
  await expect(
    page.getByRole("textbox", { name: "Ask the assistant", exact: true }),
  ).toHaveValue(question);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page).toHaveURL(/\/study$/);
  await expect(
    page.locator(".atlas-workspace[data-section=study]"),
  ).toBeVisible();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  expect(sends).toBe(0);
  expect(page.url()).not.toContain("force");
  await page
    .getByRole("checkbox", { name: `Use ${title}`, exact: true })
    .check();
  await page
    .getByRole("button", { name: "New conversation · 1 lesson", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Ask about your lessons", exact: true }),
  ).toHaveValue(question);
  expect(sends).toBe(0);
  await page
    .getByRole("button", { name: "Send study message", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Answer sources" }),
  ).toBeVisible({ timeout: 60000 });
  expect(sends).toBe(1);
  await expect(page.locator(".study-message-assistant")).toBeVisible();
  await page.getByRole("link", { name: "New chat", exact: true }).click();
  await expect(page.locator(".study-conversation")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "What would you like to work through?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(question, { exact: true })).toHaveCount(0);
});
