import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login?next=workspace");
  await page.getByLabel("Login", { exact: true }).fill(`community-${role}`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
}

test("interest exploration starts real sessions; reviewed reports reach only selected adults", async ({
  page,
  browser,
}) => {
  await signIn(page, "student");
  await page.goto("/study");
  const sent: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/study\/conversations\/[^/]+\/messages$/.test(
        new URL(request.url()).pathname,
      )
    ) {
      sent.push(request.postDataJSON().content);
    }
  });
  await page
    .getByRole("button", { name: "Explore a hobby", exact: true })
    .click();
  await expect(page.locator(".study-message-assistant")).toBeVisible({
    timeout: 60000,
  });
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain("Help me explore a hobby");
  const draftButton = page.getByRole("button", {
    name: "Create a report",
    exact: true,
  });
  await expect(draftButton).toBeEnabled();
  await draftButton.click();
  const dialog = page.getByRole("dialog", {
    name: "Review your report",
    exact: true,
  });
  await expect(dialog.getByLabel("Report title", { exact: true })).toHaveValue(
    "My exploration report",
  );
  await expect(
    dialog.getByLabel("Report content", { exact: true }),
  ).toHaveValue(/Help me explore a hobby/);
  const title = `My astronomy project ${Date.now()}`;
  const body =
    "## My interest\nI want to try observing the Moon and recording what changes.\n\n## A next step to discuss\nCould we plan a short observation project together?";
  await dialog.getByLabel("Report title", { exact: true }).fill(title);
  await dialog.getByLabel("Report content", { exact: true }).fill(body);
  await dialog
    .getByRole("button", { name: "Keep editing later", exact: true })
    .click();
  await page.getByRole("link", { name: "New chat", exact: true }).click();
  await page
    .getByRole("button", { name: "Shape a research question", exact: true })
    .click();
  await expect(page.locator(".study-message-assistant")).toBeVisible({
    timeout: 60000,
  });
  expect(sent).toHaveLength(2);
  expect(sent[1]).toContain("research question");
  await page
    .locator(".study-history-row > button:first-child")
    .filter({ hasText: sent[0].slice(0, 70) })
    .click();
  await expect(draftButton).toBeEnabled();
  await draftButton.click();
  await expect(dialog.getByLabel("Report title", { exact: true })).toHaveValue(
    title,
  );
  await expect(
    dialog.getByLabel("Report content", { exact: true }),
  ).toHaveValue(body);
  await dialog.getByRole("checkbox", { name: /Community Parent/ }).check();
  const share = dialog.getByRole("button", {
    name: "Share report",
    exact: true,
  });
  await expect(share).toBeDisabled();
  const before = await page.request.get("/api/v1/school/reports");
  expect(
    (await before.json()).some(
      (report: { title: string }) => report.title === title,
    ),
  ).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole("checkbox", {
      name: "I reviewed this report and want to share it with the people selected above.",
      exact: true,
    })
    .check();
  expect(
    await dialog.evaluate(
      (element) => element.getBoundingClientRect().right <= innerWidth,
    ),
  ).toBe(true);
  await share.click();
  await expect(
    page.getByRole("dialog", { name: "Report shared", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();

  for (const [role, visible] of [
    ["parent", true],
    ["advisor", false],
  ] as const) {
    const context = await browser.newContext();
    try {
      const adult = await context.newPage();
      await signIn(adult, role);
      await adult.goto("/workspace?section=reports");
      await expect(
        adult.getByRole("heading", {
          name: "Reports shared with you",
          exact: true,
        }),
      ).toBeVisible();
      const reportsResponse = await adult.request.get("/api/v1/school/reports");
      const reports = await reportsResponse.json();
      const report = reports.find(
        (item: { title: string }) => item.title === title,
      );
      expect(Boolean(report)).toBe(visible);
      if (visible) {
        expect(report.conversation_id).toBeNull();
        await expect(
          adult.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible();
        await expect(
          adult.getByRole("article").filter({ hasText: title }),
        ).toContainText("observing the Moon");
        await expect(
          adult.getByRole("button", { name: "Create a report", exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(
          adult.getByRole("heading", { name: title, exact: true }),
        ).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  }
});

test("reports refresh on focus without flashing empty and remove revoked content", async ({
  page,
}) => {
  await signIn(page, "advisor");
  let mode: "visible" | "removed" | "forbidden" = "visible";
  let gate: Promise<void> | undefined;
  let release = () => {};
  let reads = 0;
  await page.route("**/api/v1/school/reports", async (route) => {
    reads++;
    const selectedMode = mode;
    if (gate) await gate;
    await route.fulfill(
      selectedMode === "forbidden"
        ? {
            status: 403,
            json: { detail: "Report access was revoked." },
          }
        : {
            json:
              selectedMode === "removed"
                ? []
                : [
                    {
                      id: "focus-report",
                      student_id: "linked-student",
                      student_name: "Linked Student",
                      title: "A private interest report",
                      body: "A project for our next conversation.",
                      recipient_ids: [],
                      conversation_id: null,
                      created: 1,
                    },
                  ],
          },
    );
  });
  await page.goto("/workspace?section=reports");
  const heading = page.getByRole("heading", {
    name: "A private interest report",
    exact: true,
  });
  await expect(heading).toBeVisible();
  const initialReads = reads;
  mode = "removed";
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
  await expect(heading).toBeVisible();
  await expect(
    page.getByText("Opening shared reports…", { exact: true }),
  ).toHaveCount(0);
  gate = undefined;
  release();
  await expect(heading).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No shared reports yet", exact: true }),
  ).toBeVisible();
  mode = "visible";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(heading).toBeVisible();
  mode = "forbidden";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(heading).toHaveCount(0);
  await expect(
    page.locator('[data-guide-anchor="reports.list"]').getByRole("alert"),
  ).toContainText("Report access was revoked.");
  await expect(
    page.getByRole("link", { name: "Reopen workspace", exact: true }),
  ).toBeVisible();
});
