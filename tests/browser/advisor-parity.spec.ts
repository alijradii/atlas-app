import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { components } from "../../packages/api-client/src/schema";

test.use({ reducedMotion: "reduce" });

test("real advisor pages use the original profile panels and caseload grid with private messages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/preview/lina/adviser");
  const panel = (title: string) =>
    page
      .getByRole("heading", { name: title, exact: true })
      .locator('xpath=ancestor::*[@data-slot="card"]');
  await expect(panel("Your advisor")).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("advisor-preview.png"),
    fullPage: true,
  });
  const originalProfileClass =
    await panel("Your advisor").getAttribute("class");
  const originalGridClass = await panel("Your advisor")
    .locator("..")
    .getAttribute("class");
  const headings = [
    "Your advisor",
    "Meetings",
    "My interests & goals",
    "Agreed next steps",
    "Questions",
    "Advice received",
  ];
  let account = "student";
  const data: components["schemas"]["SchoolWorkspace"] = {
    account_id: "student",
    name: "Real Student",
    roles: ["student"],
    people: [
      {
        account_id: "advisor",
        login: "advisor",
        name: "Real Advisor",
        relationship: "advisor",
      },
    ],
    assignments: [],
    proposals: [],
    publications: [],
    messages: [],
  };
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        account_id: account,
        name: account === "student" ? "Real Student" : "Real Advisor",
        login: account,
        csrf: "synthetic",
        kind: "user",
      },
    }),
  );
  await page.route("**/api/v1/school/workspace", (route) =>
    route.fulfill({ json: data }),
  );
  await page.route("**/api/v1/study/lessons", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/school/messages", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      student_id: "student",
      advisor_id: "advisor",
      content: "Can we discuss engineering?",
    });
    data.messages.push({
      ...body,
      id: "message",
      sender_id: "student",
      created: 1,
    });
    await route.fulfill({ json: data.messages[0] });
  });
  await page.goto("/workspace?section=messages");
  await expect(
    page.getByRole("heading", { name: "My advisor", exact: true }),
  ).toBeVisible();
  for (const heading of headings) await expect(panel(heading)).toBeVisible();
  await expect(panel("Your advisor")).toHaveAttribute(
    "class",
    originalProfileClass ?? "",
  );
  await expect(panel("Your advisor").locator("..")).toHaveAttribute(
    "class",
    originalGridClass ?? "",
  );
  await expect(
    page.getByRole("heading", { name: "Real Advisor", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dr. Maya Nassar", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: test.info().outputPath("advisor-real.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Request a conversation", exact: true })
    .click();
  await expect(page.getByLabel("Message to Real Advisor")).toBeFocused();
  await page
    .getByLabel("Message to Real Advisor")
    .fill("Can we discuss engineering?");
  await page
    .locator('[data-guide-anchor="advisor.ask"]')
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    page.getByRole("log", { name: "Advisor messages" }),
  ).toContainText("Can we discuss engineering?");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  account = "advisor";
  data.account_id = "advisor";
  data.name = "Real Advisor";
  data.roles = ["advisor"];
  data.people = [
    {
      account_id: "student",
      login: "student",
      name: "Real Student",
      relationship: "student",
      responsibilities: ["advisor"],
    },
  ];
  await page.goto("/workspace?section=students");
  await expect(
    page.getByRole("heading", { name: "My students", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search students").fill("missing");
  await expect(
    page.getByRole("heading", { name: "No matching students", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search students").fill("Real");
  await page.getByRole("link", { name: "Open workspace", exact: true }).click();
  await expect(page).toHaveURL(/section=messages&student=student/);
  await expect(
    page.getByRole("heading", { name: "Real Student", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("log", { name: "Advisor messages" }),
  ).toContainText("Can we discuss engineering?");
  await expect(page.getByLabel("Message to Real Student")).toHaveValue("");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
