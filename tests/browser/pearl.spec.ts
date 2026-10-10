import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function noOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("Pearl landing works on mobile, keyboard, and dark theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("tab", { name: "Teachers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See what needs another explanation." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Does the assistant do students’ homework?" })
    .click();
  await expect(
    page.getByText(
      "The study assistant explains your selected lesson sources",
      { exact: false },
    ),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".cache/pearl/landing-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({
    path: ".cache/pearl/landing-desktop.png",
    fullPage: true,
  });
});

test("preview navigation renders all roles and rejects invalid routes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const routes: Record<string, string[]> = {
    lina: [
      "home",
      "subjects",
      "lessons",
      "lesson/L1",
      "study",
      "practice",
      "adviser",
      "activities",
    ],
    sami: ["home", "practice"],
    daher: ["home", "analytics", "lessons", "upload"],
    nassar: ["home", "students", "student/lina", "student/x1", "proposals"],
    karim: ["home", "choices", "progress"],
    hajj: ["home", "activities", "access", "settings"],
  };
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [role, views] of Object.entries(routes))
    for (const view of views) {
      await page.goto(`/preview/${role}/${view}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await noOverflow(page);
      expect
        .soft(
          (await new AxeBuilder({ page }).analyze()).violations,
          `${role}/${view}`,
        )
        .toEqual([]);
    }
  await page.goto("/preview/lina/home");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: ".cache/pearl/workspace-mobile.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Files & recordings" }),
  ).toHaveAttribute("href", "/files");
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Use your account" }),
  ).toHaveAttribute("href", "/workspace");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Lessons", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lessons", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/preview/lina/home");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Main navigation" })
      .getByRole("link", { name: "Files & recordings" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".cache/pearl/workspace-desktop.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".cache/pearl/workspace-dark.png",
    fullPage: true,
  });
  for (const route of [
    "/preview/missing/home",
    "/preview/lina/access",
    "/preview/lina/lesson/missing",
  ]) {
    await page.goto(route);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("practice persists across navigation and pauses sample tutoring until submission", async ({
  page,
}) => {
  await page.goto("/preview/sami/practice");
  await page.getByRole("button", { name: "Start the batch" }).click();
  await page.getByLabel("Answer 1", { exact: true }).fill("2.5");
  await page.getByLabel("Working 1", { exact: true }).fill("10 / 4");
  await page.goto("/preview/sami/study");
  await expect(
    page.getByRole("heading", { name: "Study help is paused" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to practice batch" }).click();
  await expect(page.getByLabel("Working 1", { exact: true })).toHaveValue(
    "10 / 4",
  );
  await expect(
    page.getByRole("button", { name: "Submit the whole batch" }),
  ).toBeDisabled();
  for (const [i, answer] of ["588", "3600", "5", "2.5"].entries())
    await page.getByLabel(`Answer ${i + 2}`, { exact: true }).fill(answer);
  await page.getByRole("button", { name: "Submit the whole batch" }).click();
  await page.getByRole("button", { name: "Submit batch", exact: true }).click();
  await expect(page.getByText("5 / 5", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Review mistakes with agent" }).click();
  await page
    .getByRole("button", { name: "Mass vs weight", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText("Mass measures matter");
  await page.getByRole("button", { name: "Reveal flashcard answer" }).click();
  await expect(
    page.getByRole("button", { name: "Show flashcard question" }),
  ).toContainText("W = mg");
});

test("subject proposal moves from adviser to parent to school", async ({
  page,
}) => {
  await page.goto("/preview/nassar/proposals");
  await page
    .getByLabel("Review note", { exact: true })
    .fill("A good fit for the robotics project.");
  await page.getByRole("button", { name: "Recommend to parent" }).click();
  await expect(page.getByText("With parent", { exact: true })).toBeVisible();
  await page.goto("/preview/karim/choices");
  await page
    .getByLabel("Your thoughts for Lina")
    .fill("We discussed the weekly workload together.");
  await page.getByRole("button", { name: "Agree and send to school" }).click();
  await page.goto("/preview/hajj/proposals");
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Confirmed for the sample term.");
  await page.getByRole("button", { name: "Confirm choice" }).click();
  await page.goto("/preview/lina/subjects");
  await expect(page.getByText("Confirmed for the sample term.")).toBeVisible();
});

test("teacher evidence and staff activity review are interactive", async ({
  page,
}) => {
  await page.goto("/preview/daher/analytics");
  await expect(
    page.getByRole("button", { name: "Preview at school" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Misconceptions", exact: true }).click();
  await page.getByRole("button", { name: "Examine evidence" }).first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Weight is 60 because she is 60 kg.",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Plan a follow-up" }).first().click();
  await page.getByRole("tab", { name: "Follow-ups", exact: true }).click();
  await expect(
    page.getByText("Revisit Mass vs weight", { exact: true }),
  ).toBeVisible();
  await page.goto("/preview/hajj/activities");
  await page
    .getByLabel("Staff sponsor and location")
    .first()
    .fill("Ms. Hajj, school garden");
  await page
    .getByRole("button", { name: "Approve sample activity" })
    .first()
    .click();
  await page.getByRole("tab", { name: "All activities", exact: true }).click();
  await expect(
    page.getByText("Campus composting project", { exact: true }),
  ).toBeVisible();
});

test("public landing and sign-in only offer real account access", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("textbox", { name: "Login", exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/preview/"]')).toHaveCount(0);
  await expect(
    page.getByText("Open a sample workspace", { exact: false }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator('a[href^="/preview/"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Teachers", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in to your workspace", exact: true }),
  ).toHaveAttribute("href", "/login");
});
