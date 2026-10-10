import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const password = "synthetic browser password 2036";
const changedPassword = "renewed synthetic account password 2036";
async function signIn(page: Page, value = password) {
  await page.goto("/login?next=account");
  await page.getByLabel("Login", { exact: true }).fill("account-browser");
  await page.getByLabel("Password", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Change password", exact: true }),
  ).toBeVisible();
}

test("account controls require sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=account$/);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("private account controls revoke other sessions and rotate passwords accessibly", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  let changed = false;
  try {
    await signIn(page);
    await signIn(other);
    await page.reload();
    const revoke = page.getByRole("button", {
      name: "Sign out other sessions",
      exact: true,
    });
    await expect(revoke).toBeEnabled();
    await revoke.click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "You are still signed in here" }),
    ).toBeVisible();
    await expect(revoke).toBeDisabled();
    expect((await other.request.get("/api/v1/auth/me")).status()).toBe(401);
    await signIn(other);
    await page.reload();
    await page
      .getByLabel("Current password", { exact: true })
      .fill("wrong password");
    await page
      .getByLabel("New password", { exact: true })
      .fill(changedPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("does not match");
    const update = page.getByRole("button", {
      name: "Update password",
      exact: true,
    });
    await expect(update).toBeDisabled();
    await expect(
      page.getByText("The new passwords do not match.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(changedPassword);
    await update.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Your current password is incorrect" }),
    ).toBeVisible();
    await page.getByLabel("Current password", { exact: true }).fill(password);
    await update.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Password updated." }),
    ).toBeVisible();
    changed = true;
    await expect(
      page.getByLabel("Current password", { exact: true }),
    ).toHaveValue("");
    await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
      "",
    );
    expect((await other.request.get("/api/v1/auth/me")).status()).toBe(401);
    await expect(revoke).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await signIn(other, changedPassword);
  } finally {
    if (changed) {
      const identity = await (await page.request.get("/api/v1/auth/me")).json();
      const result = await page.request.post("/api/v1/account/password", {
        headers: {
          Origin: "http://localhost:3100",
          "X-CSRF-Token": identity.csrf,
        },
        data: { current_password: changedPassword, new_password: password },
      });
      expect(result.status()).toBe(200);
    }
    await otherContext.close();
  }
});
