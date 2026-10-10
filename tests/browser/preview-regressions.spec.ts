import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });

test("lesson shortcuts keep the selected lesson and student across reloads", async ({
  page,
}) => {
  await page.goto("/preview/lina/lesson/L2");
  await page.getByRole("button", { name: "Pin to my home" }).click();
  const pinned = page.getByRole("navigation", { name: "Pinned lessons" });
  await expect(
    pinned.getByRole("link", { name: "Free-body diagrams step by step" }),
  ).toHaveAttribute("href", "/preview/lina/lesson/L2");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove shortcut" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/preview/lina/lesson/L1");
  await expect(
    page.getByRole("button", { name: "Pin to my home" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Pin to my home" }).click();
  await expect(pinned.getByRole("link")).toHaveCount(2);
  await page.goto("/preview/sami/lesson/L2");
  await expect(
    page.getByRole("button", { name: "Pin to my home" }),
  ).toBeVisible();
  await expect(pinned).toHaveCount(0);
  await page.getByRole("button", { name: "Pin to my home" }).click();
  await page.goto("/preview/lina/lesson/L2");
  await page.getByRole("button", { name: "Remove shortcut" }).click();
  await expect(pinned.getByRole("link")).toHaveCount(1);
  await page.goto("/preview/sami/home");
  await pinned
    .getByRole("link", { name: "Free-body diagrams step by step" })
    .click();
  await expect(page).toHaveURL(/\/preview\/sami\/lesson\/L2$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Free-body diagrams step by step",
  );
});

test("legacy preview pin remains on Lina's account only", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "atlas-pearl-preview-v1",
      JSON.stringify({ pinned: true }),
    ),
  );
  await page.goto("/preview/lina/home");
  const pinned = page.getByRole("navigation", { name: "Pinned lessons" });
  await expect(pinned.getByRole("link")).toHaveAttribute(
    "href",
    "/preview/lina/lesson/L1",
  );
  await page.goto("/preview/sami/lesson/L1");
  await expect(pinned).toHaveCount(0);
});

test("teacher lesson assistant action opens a supported route", async ({
  page,
}) => {
  await page.goto("/preview/daher/lesson/L1");
  await expect(
    page.getByRole("button", { name: "Pin to my home" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Open workspace assistant" }).click();
  await expect(page).toHaveURL(/\/preview\/daher\/chat$/);
  await expect(
    page.getByRole("heading", { name: "Your workspace assistant" }),
  ).toBeVisible();
});

test("new chat clears messages and composer even on the current chat route", async ({
  page,
}) => {
  await page.goto("/preview/daher/chat");
  await page
    .getByRole("textbox", { name: "Message the assistant" })
    .fill("Help me plan a lesson");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Help me plan a lesson");
  await page
    .getByRole("textbox", { name: "Message the assistant" })
    .fill("Unsent draft");
  await page.getByRole("link", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("log")).not.toContainText(
    "Help me plan a lesson",
  );
  await expect(
    page.getByRole("textbox", { name: "Message the assistant" }),
  ).toHaveValue("");
});

test("advisor spelling is consistent while existing preview routes remain valid", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Advisors", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\badvisers?\b/i, {
    useInnerText: true,
  });
  await page.goto("/preview/lina/home");
  await expect(
    page.getByRole("link", { name: "My advisor", exact: true }),
  ).toHaveAttribute("href", "/preview/lina/adviser");
  await expect(page.locator("body")).not.toContainText(/\badvisers?\b/i, {
    useInnerText: true,
  });
  await page.getByRole("link", { name: "My advisor", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "My advisor" }),
  ).toBeVisible();
  await page.goto("/preview/nassar/proposals");
  await expect(page.locator("body")).not.toContainText(/\badvisers?\b/i, {
    useInnerText: true,
  });
});
