import { expect, test } from "@playwright/test";

for (const [role, title, suggestion] of [
  [
    "teacher",
    "Teaching assistant",
    "How do I share a lesson with my students?",
  ],
  ["parent", "Family assistant", "Where can I see my child’s schoolwork?"],
  ["advisor", "Advisor assistant", "Where can I find my linked students?"],
]) {
  test(`${role} uses their role assistant, preserves its draft and starts a new non-study chat`, async ({
    page,
  }) => {
    const questions: string[] = [];
    await page.route("**/api/v1/assistant/messages", async (route) => {
      questions.push(route.request().postDataJSON().message);
      await route.fulfill({
        json: {
          answer:
            "Use your role tools in the sidebar. You control what is sent or changed.",
          guidance: null,
          suggestions: [],
        },
      });
    });
    await page.goto("/login?next=workspace");
    await page.getByLabel("Login", { exact: true }).fill(`school-${role}`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic browser password 2036");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const navigation = page.getByRole("navigation", {
      name: "Workspace",
      exact: true,
    });
    await expect(
      navigation.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Study with agent", exact: true }),
    ).toHaveCount(0);
    await navigation.getByRole("link", { name: title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Study session", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Your learning space", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: suggestion, exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Atlas conversation" }),
    ).toContainText("You control what is sent");
    expect(questions).toEqual([suggestion]);
    const input = page.getByRole("textbox", {
      name: "Ask the assistant",
      exact: true,
    });
    await input.fill("Keep my workspace question");
    await navigation.getByRole("link", { name: "Home", exact: true }).click();
    await expect(input).toHaveValue("Keep my workspace question");
    await navigation.getByRole("link", { name: title, exact: true }).click();
    await expect(input).toHaveValue("Keep my workspace question");
    await page.getByRole("link", { name: "New chat", exact: true }).click();
    await expect(page).toHaveURL("/workspace?section=assistant");
    await expect(input).toHaveValue("");
    await expect(
      page.getByRole("region", { name: "Atlas conversation" }),
    ).toHaveCount(0);
    await page.goto("/study");
    await expect(page).toHaveURL("/workspace?section=assistant");
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });
}

test("teachers keep transcript preparation without student tutoring", async ({
  page,
}) => {
  await page.goto("/login?next=workspace");
  await page.getByLabel("Login", { exact: true }).fill("school-teacher");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await page.goto("/study?materials=1");
  await expect(
    page.getByRole("heading", { name: "Your lesson materials", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Study session", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Start a study session", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add a transcript", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Lesson title"),
  ).toBeVisible();
});
