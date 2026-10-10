import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type { components } from "../../packages/api-client/src/schema";

type SchoolEvent = components["schemas"]["SchoolEventView"];
const password = "synthetic browser password 2036";

test.use({ actionTimeout: 15000 });

async function login(page: Page, role: string) {
  await page.goto("/login?next=workspace");
  await page.getByLabel("Login", { exact: true }).fill(`community-${role}`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Community", exact: true }),
  ).toBeVisible();
}

async function section(page: Page, name: "connections" | "events") {
  await page.goto(`/workspace?section=${name}`);
  await expect(
    page.getByRole("heading", {
      name: name === "events" ? "Time together" : "Find your people",
      exact: true,
    }),
  ).toBeVisible();
  const minimize = page.getByRole("button", {
    name: "Minimize assistant",
    exact: true,
  });
  if (await minimize.isVisible()) await minimize.click();
}

async function api(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const session = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch(`/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}

function topicCard(page: Page, topic: string) {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: topic, exact: true }) });
}

function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

test("shared interests become teacher-managed events with student, parent and advisor visibility", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(
    Array.from({ length: 6 }, () =>
      browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    ),
  );
  const [student, teacher, parent, advisor, peerA, peerB] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  const errors: string[] = [];
  for (const page of [student, teacher, parent, advisor, peerA, peerB])
    page.on("pageerror", (error) => errors.push(error.message));
  const topic = `astronomy ${Date.now()}`;
  const requestTitle = `Our shared telescope workshop ${Date.now()}`;
  const eventTitle = `Telescope afternoon ${Date.now()}`;
  try {
    for (const [page, role] of [
      [student, "student"],
      [teacher, "teacher"],
      [parent, "parent"],
      [advisor, "advisor"],
      [peerA, "peer-a"],
      [peerB, "peer-b"],
    ] as const)
      await login(page, role);
    await section(student, "connections");
    await student.getByText("Share an interest", { exact: true }).click();
    await student.getByLabel("Interest topic", { exact: true }).fill(topic);
    await student
      .getByRole("button", { name: "Share interest", exact: true })
      .click();
    await expect(topicCard(student, topic)).toContainText(
      "1 student interested",
    );
    await student.getByText("Request an activity", { exact: true }).click();
    await student.getByLabel("Activity topic", { exact: true }).fill(topic);
    await student
      .getByLabel("Activity title", { exact: true })
      .fill(requestTitle);
    await student
      .getByLabel("Your idea", { exact: true })
      .fill(
        "Build a simple telescope together and compare what we can see in the night sky.",
      );
    await student
      .getByRole("button", { name: "Send activity request", exact: true })
      .click();
    await expect(
      student.getByRole("article", { name: requestTitle, exact: true }),
    ).toContainText("Awaiting teacher");

    await section(teacher, "connections");
    await expect(
      topicCard(teacher, topic).getByRole("button", {
        name: "Suggest an activity",
        exact: true,
      }),
    ).toBeDisabled();
    // A shared interest is an explicit opt-in, independent of joining a request.
    for (const peer of [peerA, peerB]) {
      await section(peer, "connections");
      await topicCard(peer, topic)
        .getByRole("button", { name: "I’m interested too", exact: true })
        .click();
      await expect(topicCard(peer, topic)).toContainText("Including you");
      const request = peer.getByRole("article", {
        name: requestTitle,
        exact: true,
      });
      await request
        .getByRole("button", { name: "Join this request", exact: true })
        .click();
      await expect(
        request.getByRole("button", {
          name: "Withdraw from request",
          exact: true,
        }),
      ).toBeVisible();
    }
    await section(teacher, "connections");
    await expect(topicCard(teacher, topic)).toContainText(
      "3 students interested",
    );
    await topicCard(teacher, topic)
      .getByRole("button", { name: "Suggest an activity", exact: true })
      .click();
    const aiRequest = teacher.getByRole("article", {
      name: `Explore ${topic} together`,
      exact: true,
    });
    await expect(aiRequest).toContainText(
      "Suggested from 3 students’ shared topic interests",
    );
    await expect(aiRequest).toContainText("0 interested");
    await expect(aiRequest).toContainText("Awaiting teacher");

    await section(teacher, "events");
    await teacher
      .getByRole("button", { name: "Create an event", exact: true })
      .focus();
    await teacher.keyboard.press("Enter");
    const create = teacher.getByRole("form", {
      name: "Create event",
      exact: true,
    });
    await expect(
      create.getByLabel("Event title", { exact: true }),
    ).toBeFocused();
    await create.getByLabel("Event title", { exact: true }).fill(eventTitle);
    await create
      .getByRole("textbox", { name: "What will you do?", exact: true })
      .fill(
        "Bring your curiosity. We will build, test and compare two telescope designs.",
      );
    await expect(
      create.getByRole("textbox", { name: "What will you do?", exact: true }),
    ).toHaveCSS("resize", "none");
    const start = new Date(Date.now() + 2 * 86400000);
    const end = new Date(start.getTime() + 3600000);
    await create.getByLabel("Starts", { exact: true }).fill(localInput(start));
    await create.getByLabel("Ends", { exact: true }).fill(localInput(end));
    await create
      .getByLabel("Location or meeting details", { exact: true })
      .fill("Science laboratory");
    for (const name of [
      "Community Student",
      "Community Peer-A",
      "Community Peer-B",
    ])
      await create.getByRole("checkbox", { name, exact: true }).check();
    await create
      .getByRole("button", { name: "Create event", exact: true })
      .click();
    const teacherEvent = teacher.getByRole("article", {
      name: eventTitle,
      exact: true,
    });
    await expect(teacherEvent).toContainText("3 students invited");
    const saved = await api(teacher, "/school/events");
    expect(saved.status).toBe(200);
    const event: SchoolEvent = saved.body.find(
      (item: SchoolEvent) => item.title === eventTitle,
    );
    expect(event).toBeTruthy();
    // Inputs represent local wall time. The API stores an explicitly offset instant.
    expect(new Date(event.starts_at).getTime()).toBe(
      new Date(localInput(start)).getTime(),
    );

    await section(teacher, "connections");
    const reviewing = teacher.getByRole("article", {
      name: requestTitle,
      exact: true,
    });
    await expect(reviewing).toContainText("3 interested");
    await reviewing.getByText("Review request", { exact: true }).click();
    await reviewing
      .getByRole("textbox", { name: "Teacher’s response", exact: true })
      .fill("Let’s try this together. Bring one idea to the science lab.");
    await reviewing
      .getByRole("combobox", { name: "Scheduled event", exact: true })
      .selectOption(event.id);
    await reviewing
      .getByRole("button", { name: "Accept and link event", exact: true })
      .click();
    await expect(reviewing.locator(".school-status")).toHaveText("Planned");

    for (const viewer of [student, parent, advisor]) {
      await section(viewer, "connections");
      const request = viewer.getByRole("article", {
        name: requestTitle,
        exact: true,
      });
      await expect(request).toContainText("Bring one idea to the science lab.");
      await expect(
        request.getByText("Review request", { exact: true }),
      ).toHaveCount(0);
      await section(viewer, "events");
      await expect(
        viewer.getByRole("article", { name: eventTitle, exact: true }),
      ).toContainText("Science laboratory");
      await expect(
        viewer.getByRole("button", { name: "Create an event", exact: true }),
      ).toHaveCount(0);
      await expect(
        viewer.getByRole("button", { name: "Edit event", exact: true }),
      ).toHaveCount(0);
    }
    const rejected = await api(student, `/school/events/${event.id}`, "PATCH", {
      location: "Unauthorized change",
    });
    expect(rejected.status).toBe(403);

    await section(teacher, "events");
    await teacherEvent
      .getByRole("button", { name: "Edit event", exact: true })
      .click();
    const edit = teacherEvent.getByRole("form", {
      name: "Edit event",
      exact: true,
    });
    await edit
      .getByLabel("Location or meeting details", { exact: true })
      .fill("Library makerspace");
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(teacherEvent).toContainText("Library makerspace");
    await teacherEvent
      .getByRole("button", { name: "Cancel event", exact: true })
      .click();
    await teacherEvent
      .getByRole("button", { name: "Confirm cancellation", exact: true })
      .click();
    await teacher
      .getByRole("button", { name: "Cancelled", exact: true })
      .click();
    await expect(teacherEvent.locator(".school-status")).toHaveText(
      "Cancelled",
    );

    // A transient calendar failure is recoverable without losing the surrounding shell.
    await student.route("**/api/v1/school/events", (route) =>
      route.fulfill({
        status: 503,
        json: { detail: "The calendar is temporarily unavailable." },
      }),
    );
    await student.setViewportSize({ width: 390, height: 844 });
    await section(student, "events");
    await expect(student.getByRole("main").getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await student.unroute("**/api/v1/school/events");
    await student
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await expect(student.getByRole("main").getByRole("alert")).toHaveCount(0);
    await student
      .getByRole("button", { name: "Cancelled", exact: true })
      .click();
    await expect(
      student.getByRole("article", { name: eventTitle, exact: true }),
    ).toContainText("Cancelled");
    expect(
      await student.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page: student }).analyze()).violations,
    ).toEqual([]);
    await student.screenshot({
      path: test.info().outputPath("community-events-mobile.png"),
      fullPage: true,
    });
    await section(teacher, "connections");
    expect(
      (await new AxeBuilder({ page: teacher }).analyze()).violations,
    ).toEqual([]);
    await teacher.screenshot({
      path: test.info().outputPath("community-connections-teacher.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
