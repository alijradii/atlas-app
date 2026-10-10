import { expect, type Page, test } from "@playwright/test";

// These tests mock only the model boundary. Session, navigation, visible targets,
// and upload/study controls are the application running against the test API.
const endpoint = "**/api/v1/assistant/messages";
const suggestion = "Upload a document or recording";
const question = "Where can I upload my private lesson?";
const response = {
  answer:
    "Your private files are in Files & recordings. Choose a document or recording there.",
  guidance: {
    route: "/files",
    anchor: "files.upload",
    title: "Choose your material",
    description:
      "Use this upload area to choose a document or recording from your device.",
  },
  suggestions: ["How do I review a transcript?"],
};

async function login(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Login", { exact: true }).fill("browser");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".pearl-home-greeting")).toBeVisible();
}

function input(page: Page) {
  return page.getByRole("textbox", { name: "Ask the assistant", exact: true });
}

async function open(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Open Atlas assistant", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Open Atlas assistant", exact: true })
      .click();
  if (new URL(page.url()).pathname === "/study") {
    await page
      .getByRole("group", { name: "Assistant mode", exact: true })
      .getByRole("button", { name: "Ask Atlas", exact: true })
      .click();
  }
  await expect(input(page)).toBeVisible();
}

async function navigate(page: Page, href: string) {
  await page
    .getByRole("complementary", { name: "Main navigation" })
    .locator(`a[href="${href}"]`)
    .click();
  await expect(page).toHaveURL(href);
}

test("assistant suggestions call the model once, then navigate and spotlight a real control without uploading", async ({
  page,
}) => {
  const requests: { message: string; screen: string; history: unknown[] }[] =
    [];
  const mutations: string[] = [];
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: response });
  });
  await login(page);
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      /\/api\/v1\/(files|school|study)\//.test(request.url())
    )
      mutations.push(request.url());
  });
  await open(page);
  await page.getByRole("button", { name: suggestion, exact: true }).click();
  const tip = page.getByRole("dialog", { name: "Assistant tip" });
  await expect(page).toHaveURL(/\/files$/);
  await expect(tip).toContainText(response.guidance.description);
  const ring = page.locator(
    '.atlas-spotlight-ring[data-target="files.upload"]',
  );
  await expect(ring).toBeVisible();
  const target = page.locator('[data-guide-anchor="files.upload"]');
  await expect(target).toBeVisible();
  await expect(
    page.locator(".atlas-global-assistant .atlas-dock-pane"),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Atlas conversation" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return [0.2, 0.5, 0.8].every((fraction) =>
          element.contains(
            document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height * fraction,
            ),
          ),
        );
      }),
    )
    .toBe(true);
  const geometry = await ring.boundingBox();
  const targetGeometry = await target.boundingBox();
  expect(geometry).not.toBeNull();
  expect(targetGeometry).not.toBeNull();
  expect(Math.abs((geometry?.x ?? 0) - (targetGeometry?.x ?? 0))).toBeLessThan(
    20,
  );
  expect(
    Math.abs((geometry?.width ?? 0) - (targetGeometry?.width ?? 0)),
  ).toBeLessThan(40);
  const effect = await ring.evaluate((element) => ({
    dim: getComputedStyle(element).boxShadow,
    border: getComputedStyle(element, "::after").borderTopWidth,
  }));
  expect(effect.dim).toContain("9999px");
  expect(effect.border).toBe("2px");
  expect(requests).toHaveLength(1);
  expect(requests[0].message).toBe(suggestion);
  expect(requests[0].history).toEqual([]);
  expect(mutations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await open(page);
  await expect(page.getByText(response.answer, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Show me", exact: true }).click();
  await expect(tip).toBeVisible();
  await expect(
    page.locator(".atlas-global-assistant .atlas-dock-pane"),
  ).toBeHidden();
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          ),
        );
      }),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(tip).toHaveCount(0);
  await open(page);
  await expect(page.getByText(response.answer, { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test("assistant draft and minimized state survive route changes, with one composer on every screen", async ({
  page,
}) => {
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await route.fulfill({ json: { ...response, guidance: null } });
  });
  await login(page);
  await open(page);
  await input(page).fill(question);
  await page.getByRole("button", { name: "Minimize assistant" }).click();
  for (const href of ["/files", "/study", "/account", "/workspace"]) {
    await navigate(page, href);
    await expect(
      page.getByRole("button", { name: "Open Atlas assistant" }),
    ).toBeVisible();
    await expect(input(page)).toBeHidden();
    await open(page);
    await expect(input(page)).toHaveCount(1);
    await expect(input(page)).toHaveValue(question);
    if (href === "/study") {
      const rechecked = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/auth/me"),
      );
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await rechecked;
      await expect(input(page)).toHaveValue(question);
    }
    await page.getByRole("button", { name: "Minimize assistant" }).click();
  }
  expect(calls).toBe(0);
});

test("failed assistant calls preserve the question and explicit retry makes one new request", async ({
  page,
}) => {
  const messages: string[] = [];
  await page.route(endpoint, async (route) => {
    messages.push(route.request().postDataJSON().message);
    if (messages.length === 1)
      await route.fulfill({
        status: 503,
        json: { detail: "The assistant is temporarily unavailable." },
      });
    else await route.fulfill({ json: { ...response, guidance: null } });
  });
  await login(page);
  await open(page);
  await input(page).fill(question);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Atlas conversation", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  expect(messages).toEqual([question]);
  await page.getByRole("button", { name: /retry|try again/i }).click();
  await expect(page.getByText(response.answer, { exact: true })).toBeVisible();
  expect(messages).toEqual([question, question]);
});

test("an expired assistant session clears the private conversation and returns to sign in", async ({
  page,
}) => {
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await route.fulfill({ status: 401, json: { detail: "Sign in required." } });
  });
  await login(page);
  await open(page);
  await input(page).fill(question);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(question, { exact: true })).toHaveCount(0);
  await expect(input(page)).toHaveCount(0);
  expect(calls).toBe(1);
});
