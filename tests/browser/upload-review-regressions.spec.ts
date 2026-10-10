import { expect, test } from "@playwright/test";

const identity = {
  csrf: "mock-csrf",
  account_id: "mock-owner",
  login: "owner",
  name: "Owner",
  kind: "user",
};
const file = {
  id: "sample-file",
  filename: "session.txt",
  media_type: "text/plain",
  size: 80,
  state: "accepted",
  expires: 9999999999,
  error: "",
  url: null,
};

test("import and delete failures stay visible inside their active dialog", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route("**/api/v1/files", (route) =>
    route.fulfill({ json: [file] }),
  );
  await page.route("**/api/v1/study/imports", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Transcription is temporarily unavailable" },
    }),
  );
  await page.route(`**/api/v1/files/${file.id}`, (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "File deletion is temporarily unavailable" },
    }),
  );
  await page.goto("/files");
  await page
    .getByRole("button", { name: "Use for study", exact: true })
    .click();
  const importDialog = page.getByRole("dialog", {
    name: "Use this material for study",
  });
  await importDialog.getByLabel("Lesson title").fill("Keep this title");
  await importDialog.getByRole("button", { name: "Prepare material" }).click();
  await expect(importDialog.getByRole("alert")).toHaveText(
    "Transcription is temporarily unavailable",
  );
  await expect(importDialog.getByLabel("Lesson title")).toHaveValue(
    "Keep this title",
  );
  await importDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete session.txt", exact: true })
    .click();
  const deleteDialog = page.getByRole("dialog", {
    name: "Delete session.txt?",
  });
  await deleteDialog
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(deleteDialog.getByRole("alert")).toHaveText(
    "File deletion is temporarily unavailable",
  );
});

test("review corrections survive an authorized focus refresh but disappear after access revocation", async ({
  page,
}) => {
  let revoked = false;
  const lesson = {
    id: "review-source",
    title: "Review my recording",
    subject: "Physics",
    state: "review",
    owned: true,
    error: "",
    created: 1,
    has_file: true,
    transcript:
      "The original transcript explains force, mass and acceleration in detail.",
  };
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: identity });
    if (path.endsWith("/study/status"))
      return route.fulfill({
        json: { rag_configured: true, answer_configured: true },
      });
    if (path.endsWith("/study/lessons"))
      return route.fulfill({ json: [lesson] });
    if (path.endsWith(`/study/lessons/${lesson.id}`))
      return revoked
        ? route.fulfill({ status: 404, json: { detail: "Lesson not found" } })
        : route.fulfill({ json: lesson });
    return route.fulfill({ json: [] });
  });
  await page.goto("/study");
  await page
    .locator(".study-lesson-row")
    .filter({ hasText: lesson.title })
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  const field = dialog.getByLabel("Review the extracted transcript");
  const corrected =
    "These corrected words explain that a four kilogram object under ten newtons accelerates at 2.5 metres per second squared.";
  await field.fill(corrected);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(field).toHaveValue(corrected);
  revoked = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog.getByRole("alert")).toContainText("Lesson not found");
  await expect(field).toHaveCount(0);
  await expect(dialog).not.toContainText(corrected);
});

test("retry waits for incomplete staging cleanup before creating another upload", async ({
  page,
}) => {
  let creates = 0;
  let deletes = 0;
  let cleanupAvailable = false;
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route("**/api/v1/files", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/uploads", (route) => {
    creates++;
    return route.fulfill({
      json: {
        ...file,
        state: "pending",
        url: "/api/v1/uploads/sample-file/bytes",
      },
    });
  });
  await page.route("**/api/v1/uploads/sample-file/bytes", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.route("**/api/v1/files/sample-file", (route) => {
    deletes++;
    return cleanupAvailable
      ? route.fulfill({ json: { status: "ok" } })
      : route.fulfill({
          status: 503,
          json: { detail: "Cleanup temporarily unavailable" },
        });
  });
  await page.goto("/files");
  await page.getByLabel("Choose a file", { exact: true }).setInputFiles({
    name: "session.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A lesson transcript about force and acceleration."),
  });
  const transfers = page.getByRole("region", { name: "Upload progress" });
  await expect(transfers).toContainText("incomplete file could not be removed");
  await transfers.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Cleanup temporarily unavailable",
  );
  expect(creates).toBe(1);
  expect(deletes).toBe(2);
  cleanupAvailable = true;
  await transfers.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => creates).toBe(2);
});
