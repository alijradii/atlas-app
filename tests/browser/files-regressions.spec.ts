import { expect, type Page, test } from "@playwright/test";

const session = {
  csrf: "test-token",
  account_id: "sample",
  login: "sample",
  name: "Sample",
  kind: "user",
};
const file = {
  id: "file-1",
  filename: "private-notes.txt",
  size: 15,
  state: "accepted",
  expires: 9999999999,
  error: "",
  url: null,
};

async function visibility(page: Page, state: "visible" | "hidden") {
  // Chromium headless does not reliably background tabs; dispatch the browser
  // visibility contract explicitly while keeping the real page and timers.
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function auth(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: session }),
  );
}

test("slow initial authentication keeps the files route stable", async ({
  page,
}) => {
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      navigations.push(new URL(frame.url()).pathname);
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    // Strict Mode cancels the initial effect. Its completion must not end the
    // replacement session check early and send an authenticated user to login.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: session }).catch(() => {});
  });
  await page.route("**/api/v1/files", (route) =>
    route.fulfill({ json: [file] }),
  );
  await page.goto("/files");
  await expect(
    page.getByRole("heading", { name: "Your files", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page).toHaveURL(/\/files$/);
  await expect(
    page.getByRole("heading", { name: "Your files", exact: true }),
  ).toBeVisible();
  expect(navigations).not.toContain("/login");
});

test("private files stop polling while hidden and refresh immediately on return", async ({
  page,
}) => {
  await auth(page);
  let polls = 0;
  await page.route("**/api/v1/files", (route) => {
    polls += 1;
    return route.fulfill({ json: [file] });
  });
  await page.clock.install();
  await page.goto("/files");
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await visibility(page, "hidden");
  const pausedAt = polls;
  await page.clock.runFor(20000);
  expect(polls).toBe(pausedAt);
  await visibility(page, "visible");
  await expect.poll(() => polls).toBe(pausedAt + 1);
  await page.clock.runFor(5100);
  await expect.poll(() => polls).toBe(pausedAt + 2);
});

test("returning to an expired session clears private files even for a non-JSON 401", async ({
  page,
}) => {
  await auth(page);
  let expired = false;
  await page.route("**/api/v1/files", (route) =>
    expired
      ? route.fulfill({
          status: 401,
          contentType: "text/plain",
          body: "Unauthorized",
        })
      : route.fulfill({ json: [file] }),
  );
  await page.goto("/files");
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await visibility(page, "hidden");
  expired = true;
  // A new route load should also see the expired session.
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, body: "Unauthorized" }),
  );
  await visibility(page, "visible");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/login\?next=files$/);
});

test("a proxy outage shows an actionable error and preserves the current file list", async ({
  page,
}) => {
  await auth(page);
  let unavailable = false;
  await page.route("**/api/v1/files", (route) =>
    unavailable
      ? route.fulfill({
          status: 502,
          contentType: "text/html",
          body: "<html>Internal gateway details</html>",
        })
      : route.fulfill({ json: [file] }),
  );
  await page.goto("/files");
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await visibility(page, "hidden");
  unavailable = true;
  await visibility(page, "visible");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "The service is unavailable. Please try again.",
  );
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await expect(page.getByText("Internal gateway details")).toHaveCount(0);
});

test("a session lookup outage stays on files and offers a retry instead of signing out", async ({
  page,
}) => {
  let available = false;
  await page.route("**/api/v1/auth/me", (route) =>
    available
      ? route.fulfill({ json: session })
      : route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "Unavailable",
        }),
  );
  await page.route("**/api/v1/files", (route) =>
    route.fulfill({ json: [file] }),
  );
  await page.goto("/files");
  await expect(
    page.getByRole("heading", { name: "Unable to load your session" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "The service is unavailable. Please try again.",
  );
  await expect(page).toHaveURL(/\/files$/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  available = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/files$/);
});

test("login waits for the files route before exposing an upload form that would be remounted", async ({
  page,
}) => {
  let signedIn = false;
  let releaseNavigation = () => {};
  const navigationGate = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  await page.route("**/api/v1/auth/me", (route) =>
    signedIn
      ? route.fulfill({ json: session })
      : route.fulfill({
          status: 401,
          json: { detail: "Please sign in again" },
        }),
  );
  await page.route("**/api/v1/auth/login", (route) => {
    signedIn = true;
    return route.fulfill({ json: session });
  });
  await page.route("**/api/v1/files", (route) => route.fulfill({ json: [] }));
  let routePending = false;
  await page.route(
    (url) => url.pathname === "/files" && url.searchParams.has("_rsc"),
    async (route) => {
      routePending = true;
      await navigationGate;
      await route.continue();
    },
  );
  try {
    await page.goto("/login?next=files");
    await page.getByLabel("Login", { exact: true }).fill("sample");
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect.poll(() => routePending).toBe(true);
    await expect(page.getByLabel("Choose a file")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Loading…");
    releaseNavigation();
    await expect(page).toHaveURL(/\/files$/);
    await expect(page.getByLabel("Choose a file")).toBeVisible();
  } finally {
    releaseNavigation();
  }
});

test("an account switch discards previous files and late private responses", async ({
  page,
}) => {
  let identity = session;
  let hold = false;
  let blocked = false;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: identity }),
  );
  await page.route("**/api/v1/files", async (route) => {
    const previous = identity.account_id === session.account_id;
    if (hold && previous) {
      blocked = true;
      await gate;
    }
    await route
      .fulfill({
        json: [
          previous
            ? file
            : { ...file, id: "second-file", filename: "second-account.txt" },
        ],
      })
      .catch(() => {});
  });
  await page.goto("/files");
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toBeVisible();
  hold = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => blocked).toBe(true);
  identity = {
    ...session,
    account_id: "second",
    login: "second",
    name: "Second",
    csrf: "second-token",
  };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Signed in as Second. Files are private to your account."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download second-account.txt" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("link", { name: "Download private-notes.txt" }),
  ).toHaveCount(0);
});
