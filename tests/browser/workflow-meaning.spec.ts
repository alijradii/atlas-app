import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });

test("staff subject guidance highlights confirmation without approving or changing network access", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "atlas-pearl-preview-v1",
      JSON.stringify({
        school: false,
        proposals: [
          {
            subject: "cs",
            reason: "I want to program our robotics project.",
            status: "school",
            note: "The family agrees.",
          },
        ],
      }),
    ),
  );
  await page.goto(
    `/preview/hajj/proposals?guide=${encodeURIComponent("Where do I approve proposals?")}`,
  );
  await expect(
    page.getByRole("dialog", { name: "Assistant tip" }),
  ).toBeVisible();
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="proposal.confirm"]'),
  ).toBeVisible();
  await expect(page.getByText("With school", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "From home", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm choice", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toHaveCount(0);
});

test("staff subject guidance explains when confirmation is awaiting earlier reviewers", async ({
  page,
}) => {
  await page.goto(
    `/preview/hajj/proposals?guide=${encodeURIComponent("Where do I approve proposals?")}`,
  );
  const tip = page.getByRole("dialog", { name: "Assistant tip" });
  await expect(tip).toContainText(
    "No subject proposals are waiting for school confirmation",
  );
  await expect(
    page.locator('.atlas-spotlight-ring[data-target="screen.heading"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm choice", exact: true }),
  ).toHaveCount(0);
});

test("school confirmation is discoverable in subject proposals, separate from settings", async ({
  page,
}) => {
  await page.goto("/preview/nassar/proposals");
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Recommended after discussing the workload.");
  await page.getByRole("button", { name: "Recommend to parent" }).click();
  await expect(page.getByText("With parent", { exact: true })).toBeVisible();
  await page.goto("/preview/karim/choices");
  await page
    .getByLabel("Your thoughts for Lina")
    .fill("We agree with this choice.");
  await page.getByRole("button", { name: "Agree and send to school" }).click();
  await expect(page.getByText("With school", { exact: true })).toBeVisible();

  await page.goto("/preview/hajj/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "School settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm choice" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Subject proposals", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\/hajj\/proposals$/);
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Confirmed after timetable review.");
  await page.getByRole("button", { name: "Confirm choice" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.goto("/preview/lina/subjects");
  await expect(
    page.getByText("Confirmed after timetable review.", { exact: true }),
  ).toBeVisible();
});

for (const reviewer of [
  {
    account: "nassar",
    route: "proposals",
    status: "adviser",
    label: "Review note",
  },
  {
    account: "karim",
    route: "choices",
    status: "parent",
    label: "Your thoughts for Lina",
  },
  {
    account: "hajj",
    route: "proposals",
    status: "school",
    label: "Review note",
  },
]) {
  test(`${reviewer.account} must explain requested changes and the student receives that exact note`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      (status) =>
        sessionStorage.setItem(
          "atlas-pearl-preview-v1",
          JSON.stringify({
            proposals: [
              {
                subject: "cs",
                reason: "I want to program our robotics project.",
                status,
                note: "",
              },
            ],
          }),
        ),
      reviewer.status,
    );
    await page.goto(`/preview/${reviewer.account}/${reviewer.route}`);
    const note = page.getByLabel(reviewer.label, { exact: true });
    const request = page.getByRole("button", {
      name: "Request changes",
      exact: true,
    });
    await request.click();
    await expect(note).toBeFocused();
    await expect(request).toBeVisible();
    await note.fill("   ");
    await request.click();
    await expect(note).toBeFocused();
    await expect(
      page.getByText("Changes requested", { exact: true }),
    ).toHaveCount(0);
    const explanation = `Please discuss the robotics timetable with ${reviewer.account} before resubmitting.`;
    await note.fill(explanation);
    await request.click();
    await expect(
      page.getByText("Changes requested", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Latest review note: ${explanation}`, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(`Latest review note: ${explanation}`, { exact: true }),
    ).toBeVisible();
    await page.goto("/preview/lina/subjects");
    await expect(page.getByText(explanation, { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Explore options" }).click();
    await expect(
      page.getByRole("button", { name: "Revise proposal" }),
    ).toBeVisible();
  });
}
