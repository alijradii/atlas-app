import { expect, type Page, test } from "@playwright/test";

const identity = {
  account_id: "focus-teacher",
  name: "Focus Teacher",
  login: "focus-teacher",
  kind: "user",
  csrf: "qa-token",
};
const workspace = {
  account_id: identity.account_id,
  name: identity.name,
  roles: ["teacher"],
  people: [],
  assignments: [],
  publications: [],
  messages: [],
  proposals: [],
};
async function resume(page: Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
}
async function teacher(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route("**/api/v1/school/workspace", (route) =>
    route.fulfill({ json: workspace }),
  );
  await page.route("**/api/v1/study/lessons", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/workspace?section=work");
  await page.getByText("Create an assignment", { exact: true }).click();
  return page.getByRole("textbox", { name: "Instructions", exact: true });
}

test("workspace switches preserve the visible form and its draft, coalesce checks, and clear revoked access", async ({
  page,
}) => {
  const instructions = await teacher(page);
  await instructions.fill(
    "Unsaved instructions must survive a workspace switch.",
  );
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  let pending = false;
  await page.route("**/api/v1/school/workspace", async (route) => {
    reads++;
    pending = true;
    await gate;
    await route.fulfill({ json: workspace });
  });
  try {
    await resume(page);
    await expect.poll(() => pending).toBe(true);
    await expect(instructions).toBeVisible();
    await expect(instructions).toHaveValue(
      "Unsaved instructions must survive a workspace switch.",
    );
    await expect(page.getByText("Refreshing your workspace…")).toHaveCount(0);
    release();
    await page.waitForResponse((response) =>
      response.url().endsWith("/auth/me"),
    );
    expect(reads).toBe(1);
  } finally {
    release();
  }
  await page.route("**/api/v1/school/workspace", (route) =>
    route.fulfill({ status: 403, json: { detail: "Access revoked" } }),
  );
  await resume(page);
  await expect(instructions).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Access revoked",
  );
});

test("a background outage preserves workspace edits while a changed account discards them", async ({
  page,
}) => {
  const instructions = await teacher(page);
  await instructions.fill("A private teacher draft.");
  await page.route("**/api/v1/school/workspace", (route) =>
    route.fulfill({ status: 503, json: { detail: "Temporarily unavailable" } }),
  );
  await resume(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(instructions).toHaveValue("A private teacher draft.");
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: { ...identity, account_id: "other-user", name: "Other User" },
    }),
  );
  await resume(page);
  await expect(instructions).toHaveCount(0);
});

test("school textareas grow, cap their height and shrink as a controlled draft is deleted", async ({
  page,
}) => {
  const instructions = await teacher(page);
  const initial = await instructions.evaluate((field) => field.clientHeight);
  await instructions.fill(
    Array.from({ length: 7 }, (_, index) => `Line ${index}`).join("\n"),
  );
  await expect
    .poll(() => instructions.evaluate((field) => field.clientHeight))
    .toBeGreaterThan(initial);
  await instructions.fill("Detailed explanation\n".repeat(80));
  const box = await instructions.evaluate((field) => ({
    height: field.clientHeight,
    content: field.scrollHeight,
    resize: getComputedStyle(field).resize,
    overflow: getComputedStyle(field).overflowY,
  }));
  expect(box.height).toBeLessThanOrEqual(320);
  expect(box.content).toBeGreaterThan(box.height);
  expect(box.resize).toBe("none");
  expect(box.overflow).toBe("auto");
  await instructions.fill("");
  await expect
    .poll(() => instructions.evaluate((field) => field.clientHeight))
    .toBe(initial);
});

test("an uncontrolled activity textarea shrinks on native form reset and adapts to narrow layouts", async ({
  page,
}) => {
  await page.goto("/preview/lina/activities");
  const description = page.getByLabel("What would you do?", { exact: true });
  const initial = await description.evaluate((field) => field.clientHeight);
  await description.fill(
    "A description with several meaningful details. ".repeat(40),
  );
  await expect
    .poll(() => description.evaluate((field) => field.clientHeight))
    .toBeGreaterThan(initial);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => description.evaluate((field) => field.clientHeight))
    .toBeLessThanOrEqual(320);
  await description.evaluate((field: HTMLTextAreaElement) =>
    field.form?.reset(),
  );
  await expect(description).toHaveValue("");
  await expect
    .poll(() => description.evaluate((field) => field.clientHeight))
    .toBeLessThanOrEqual(initial + 4);
  expect(
    await description.evaluate((field) => getComputedStyle(field).resize),
  ).toBe("none");
});

test("account settings stay mounted on focus and discard password drafts after a session expires", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route("**/api/v1/school/workspace", (route) =>
    route.fulfill({ json: workspace }),
  );
  await page.route("**/api/v1/account/sessions", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/account");
  const password = page.getByLabel("Current password", { exact: true });
  await password.fill("unsaved synthetic password");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let waiting = false;
  await page.route("**/api/v1/account/sessions", async (route) => {
    waiting = true;
    await gate;
    await route.fulfill({ json: [] });
  });
  try {
    await resume(page);
    await expect.poll(() => waiting).toBe(true);
    await expect(password).toBeVisible();
    await expect(password).toHaveValue("unsaved synthetic password");
    await expect(page.getByText("Opening account settings…")).toHaveCount(0);
  } finally {
    release();
  }
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Session expired" } }),
  );
  await resume(page);
  await expect(password).toHaveCount(0);
  await expect(page).toHaveURL(/\/login\?next=account$/);
});
