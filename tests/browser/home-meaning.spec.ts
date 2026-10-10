import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });

test("home cards expose a task, current state and one matching destination", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  const cards = page.locator(".pearl-home-action");
  await expect(cards).toHaveCount(4);
  const practice = cards.filter({ hasText: "Continue practice" });
  await expect(practice).toHaveAttribute("data-task-kind", "practice");
  await expect(practice).toContainText("2 of 5 ready");
  await expect(practice.locator("svg.atlas-task-art")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await practice.click();
  await expect(page).toHaveURL(/\/lina\/practice$/);
  await expect(
    page.getByRole("heading", { name: /Practice batch/ }),
  ).toBeVisible();
  await page.goto("/preview/lina/home");
  const advisor = cards.filter({ hasText: "Read reply" });
  await expect(advisor).toContainText("Human advisor");
  await expect(advisor).toContainText("Dr. Maya Nassar");
  await advisor.click();
  await expect(page).toHaveURL(/\/lina\/adviser$/);
  await expect(
    page.getByText("Yes, many value a design portfolio.", { exact: false }),
  ).toBeVisible();
});

test("a submitted batch changes the call to action, keeping its practice identity", async ({
  page,
}) => {
  await page.goto("/preview/lina/practice");
  const stuck = page.getByLabel("I couldn’t solve this one");
  for (let i = 2; i < 5; i++) await stuck.nth(i).check();
  await page.getByRole("button", { name: "Submit the whole batch" }).click();
  await page.getByRole("button", { name: "Submit batch", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your feedback", exact: true }),
  ).toBeVisible();
  await page.goto("/preview/lina/home");
  const practice = page.locator('a[data-task-id="practice"]');
  await expect(practice).toHaveAttribute("data-task-kind", "practice");
  await expect(practice).toContainText("Your feedback is ready");
  await expect(practice).toContainText("Review feedback");
  await expect(practice).not.toContainText("Continue practice");
  await practice.click();
  await expect(
    page.getByRole("heading", { name: "Your feedback", exact: true }),
  ).toBeVisible();
});

test("helper choices save independently, persist and only bulk-enable when explicitly requested", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  const first = page.getByRole("button", {
    name: "New lessons in my subjects",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Remind me of agreed steps",
    exact: true,
  });
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Enable all updates", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "All selected", exact: true }),
  ).toBeDisabled();
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Enable all updates", exact: true }),
  ).toBeEnabled();
});

test("task cards remain legible and usable in dark and narrow layouts", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  await page.getByRole("button", { name: "Minimize assistant" }).click();
  await page
    .locator(".pearl-home-cards")
    .screenshot({ path: ".cache/pearl/meaning-cards.png" });
  await page.screenshot({
    path: ".cache/pearl/meaning-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: ".cache/pearl/meaning-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const cards = page.locator(".pearl-home-action");
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator(".pearl-home-action-footer")).toBeVisible();
    expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".cache/pearl/meaning-mobile.png",
    fullPage: true,
  });
});
