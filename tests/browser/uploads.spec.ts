import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("private document upload becomes a reviewed study source", async ({
  page,
}) => {
  await page.goto("/login?next=files");
  await page.getByLabel("Login", { exact: true }).fill("study-peer");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const filename = `forces-${Date.now()}.md`;
  const transcript =
    "The net force on an object equals its mass times its acceleration. A mass of four kilograms under ten newtons accelerates at 2.5 metres per second squared.";
  await page.getByLabel("Choose a file", { exact: true }).setInputFiles({
    name: filename,
    mimeType: "text/markdown",
    buffer: Buffer.from(transcript),
  });
  const row = page
    .getByRole("list", { name: "Your files", exact: true })
    .getByRole("listitem")
    .filter({ hasText: filename });
  await expect(
    row.getByRole("link", { name: `Download ${filename}` }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Use for study" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lesson title").fill(filename);
  await dialog.getByLabel("Subject (optional)").fill("Physics");
  await dialog.getByRole("button", { name: "Prepare material" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Your material is being prepared" }),
  ).toBeVisible();
  await dialog.getByRole("link", { name: "Open study workspace" }).click();
  const lesson = page
    .locator(".study-lesson-row")
    .filter({ hasText: filename });
  await expect(lesson).toContainText("Review transcript");
  await lesson.getByRole("button").click();
  const review = page.getByRole("dialog");
  await expect(
    review.getByLabel("Review the extracted transcript"),
  ).toHaveValue(transcript);
  await review
    .getByLabel("Review the extracted transcript")
    .fill(`${transcript}\nThis transcript was checked before indexing.`);
  await review
    .getByRole("button", { name: "Approve and prepare lesson" })
    .click();
  await expect(lesson).toContainText("Ready to study");
  await page.goto("/files");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Your files", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Recordings", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Your files", exact: true })
      .getByText(filename),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All files", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Delete ${filename}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(row).toBeHidden();
});

test("file selection validates limits without a request and failed transfers can retry", async ({
  page,
}) => {
  const session = {
    csrf: "synthetic",
    account_id: "test",
    login: "test",
    name: "Test",
    kind: "user",
  };
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/v1/files", (route) => route.fulfill({ json: [] }));
  let requests = 0;
  await page.route("**/api/v1/uploads", (route) => {
    requests++;
    return route.fulfill({
      status: 503,
      json: { detail: "Storage temporarily unavailable" },
    });
  });
  await page.goto("/files");
  await page.getByLabel("Choose a file", { exact: true }).setInputFiles({
    name: "script.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Choose TXT",
  );
  expect(requests).toBe(0);
  await page.getByLabel("Choose a file", { exact: true }).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A readable document about forces and acceleration."),
  });
  const transfers = page.getByRole("region", { name: "Upload progress" });
  await expect(transfers).toContainText("Storage temporarily unavailable");
  expect(requests).toBe(1);
  await transfers.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(transfers).toContainText("Storage temporarily unavailable");
});
