import { expect, test } from "@playwright/test";

test("collapsed navigation survives entering and leaving Study repeatedly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login?next=workspace");
  await page.getByLabel("Login", { exact: true }).fill("school-student");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .click();
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  for (const [name, url] of [
    ["Study with agent", "/study"],
    ["Home", "/workspace"],
    ["Study with agent", "/study"],
    ["Files & recordings", "/files"],
    ["Study with agent", "/study"],
    ["Home", "/workspace"],
  ]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.locator(".atlas-workspace")).toHaveAttribute(
      "data-nav-collapsed",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Expand navigation", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".atlas-desktop-navigation .atlas-brand-name"),
    ).toBeHidden();
  }
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await nav
    .getByRole("link", { name: "Study with agent", exact: true })
    .click();
  await expect(page).toHaveURL("/study");
  await expect(page.locator(".atlas-workspace")).toHaveAttribute(
    "data-nav-collapsed",
    "false",
  );
});
