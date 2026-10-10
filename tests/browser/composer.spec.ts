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

test("assistant docks at the edge without intercepting content, then restores its draft", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/preview/lina/home");
  const input = page.getByRole("textbox", {
    name: "Ask the assistant",
    exact: true,
  });
  await input.fill("Keep this draft");
  await page.locator(".pearl-home").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const before = await page.locator(".pearl-home-hero").boundingBox();
  await page.getByRole("button", { name: "Minimize assistant" }).click();
  const launcher = page.getByRole("button", { name: "Open Atlas assistant" });
  await expect(launcher).toBeFocused();
  await expect(page.locator(".atlas-dock-pane")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(input).toHaveCount(0);
  const pill = await launcher.boundingBox();
  expect(pill).not.toBeNull();
  if (!pill) throw new Error("Missing launcher bounds");
  expect(pill.width).toBeLessThan(150);
  expect(pill.height).toBeGreaterThanOrEqual(44);
  expect(pill.x + pill.width).toBeGreaterThan(1400);
  expect(pill.y + pill.height).toBeLessThanOrEqual(1000);
  expect(await page.locator(".pearl-home-hero").boundingBox()).toEqual(before);
  const intercepted = await page.evaluate(() =>
    document.elementFromPoint(800, 950)?.closest(".atlas-assistant-dock"),
  );
  expect(intercepted).toBeNull();
  await launcher.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Keep this draft");
  await input.press("Escape");
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(input).toHaveValue("Keep this draft");
});

test("mobile docking honors reduced motion and preserves a pending pin", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview/lina/home");
  await page
    .getByRole("button", { name: "Pin Mass vs weight to my home", exact: true })
    .click();
  await page.getByRole("button", { name: "Minimize assistant" }).click();
  const launcher = page.getByRole("button", { name: "Open Atlas assistant" });
  await expect(page.locator(".atlas-dock-pane")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await expect(
    page.getByRole("button", { name: "Pin to home", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 740 });
  const bounds = await launcher.boundingBox();
  if (!bounds) throw new Error("Missing launcher");
  expect(bounds.x).toBeGreaterThan(180);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(344);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await launcher.click();
  await expect(
    page.getByRole("button", { name: "Pin to home", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel pin" }).click();
});
