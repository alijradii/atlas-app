import { expect, type Page, test } from "@playwright/test";

const prompt = "Where do I submit my batch?";
async function guided(
  page: Page,
  account: string,
  section: string,
  text = prompt,
) {
  await page.goto(
    `/preview/${account}/${section}?guide=${encodeURIComponent(text)}`,
  );
  await expect(
    page.getByRole("dialog", { name: "Assistant tip" }),
  ).toBeVisible();
}
async function insideViewport(page: Page) {
  const bounds = await page
    .getByRole("dialog", { name: "Assistant tip" })
    .boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Expected a fixed test viewport");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

test("home guidance navigates to the real disabled submit control without submitting", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  await page.getByRole("button", { name: prompt, exact: true }).click();
  const tip = page.getByRole("dialog", { name: "Assistant tip" });
  await expect(tip).toBeVisible();
  await expect(page).toHaveURL(/\/preview\/lina\/practice\?guide=/);
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="batch.submit"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit the whole batch", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("dialog", { name: "Submit all five?" }),
  ).toHaveCount(0);
  await expect(tip.getByRole("button", { name: "Got it" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(page).toHaveURL(/\/preview\/lina\/practice$/);
  await expect(
    page.getByRole("heading", { name: "Practice batch", exact: true }),
  ).toBeFocused();
});

test("Sami's guidance highlights Start and leaves the batch untouched", async ({
  page,
}) => {
  await guided(page, "sami", "practice");
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="batch.start"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start the batch" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(
    page.getByRole("button", { name: "Start the batch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit the whole batch" }),
  ).toHaveCount(0);
});

test("spotlight stays inside narrow and resized viewports with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await guided(page, "lina", "practice");
  await insideViewport(page);
  expect(
    await page
      .locator(".atlas-spotlight")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.setViewportSize({ width: 360, height: 600 });
  await expect
    .poll(async () => {
      const bounds = await page
        .getByRole("dialog", { name: "Assistant tip" })
        .boundingBox();
      return bounds ? bounds.y + bounds.height : 9999;
    })
    .toBeLessThanOrEqual(600);
  await insideViewport(page);
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("dialog", { name: "Assistant tip" })).toHaveCount(
    0,
  );
});

test("school-only guidance describes the restriction without enabling teacher analytics", async ({
  page,
}) => {
  await guided(page, "daher", "analytics", "Show me analytics");
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="screen.heading"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Assistant tip" }),
  ).toContainText("school network");
  await expect(
    page.getByRole("button", { name: "Examine evidence" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Preview at school" }),
  ).toBeVisible();
});
