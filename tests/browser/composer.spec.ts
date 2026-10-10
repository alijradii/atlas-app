import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });

test("home recommendations support confirmed, persistent pins and safe undo", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  const suggestion = page.getByRole("button", {
    name: "Pin Mass vs weight to my home",
    exact: true,
  });
  const pins = page.getByRole("navigation", { name: "Pinned lessons" });
  await suggestion.click();
  await expect(pins).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel pin" }).click();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await page.getByRole("button", { name: "Pin to home", exact: true }).click();
  await expect(pins.getByRole("link")).toHaveAttribute(
    "href",
    "/preview/lina/lesson/L1",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(pins).toHaveCount(0);
  await suggestion.click();
  await page.getByRole("button", { name: "Pin to home", exact: true }).click();
  await page.reload();
  await expect(pins.getByRole("link")).toHaveCount(1);
  await suggestion.click();
  await page.getByRole("button", { name: "Pin to home", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(pins.getByRole("link")).toHaveCount(1);
});

test("compact composer supports multiline input, keyboard submit and private files", async ({
  page,
}) => {
  await page.goto("/preview/daher/home");
  const input = page.getByRole("textbox", {
    name: "Ask the assistant",
    exact: true,
  });
  await expect(
    page.getByRole("group", { name: "Recommended actions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  const box = await page.locator(".atlas-composer form").boundingBox();
  expect(box?.height).toBeLessThan(130);
  await page.getByRole("button", { name: "More options" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Your private files" }),
  ).toHaveAttribute("href", "/files");
  await page.keyboard.press("Escape");
  await input.fill("Can you help");
  await input.press("Shift+Enter");
  await input.pressSequentially("with my lesson?");
  await expect(input).toHaveValue("Can you help\nwith my lesson?");
  await expect(
    page.getByRole("group", { name: "Recommended actions" }),
  ).toHaveCount(0);
  await input.press("Enter");
  await expect(page).toHaveURL(/\/preview\/daher\/chat\?prompt=/);
  await expect(page.getByRole("log")).toContainText("with my lesson?");
});

test("account navigation clears a pending pin and unsent composer draft", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  await page
    .getByRole("button", { name: "Pin Mass vs weight to my home", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ask the assistant", exact: true })
    .fill("Lina draft");
  await page.getByRole("button", { name: /Lina Haddad Student/ }).click();
  await page
    .getByRole("menuitem", { name: "Mr. Elie Daher", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\/daher\/home$/);
  await expect(page.getByRole("button", { name: "Cancel pin" })).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Ask the assistant", exact: true }),
  ).toHaveValue("");
});
