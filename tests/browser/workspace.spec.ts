import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test.use({ actionTimeout: 15000 });

const password = "synthetic browser password 2036";
async function login(page: Page, role: string) {
  await page.goto("/login?next=workspace");
  await page.getByLabel("Login", { exact: true }).fill(`school-${role}`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, School", exact: true }),
  ).toBeVisible();
}
async function openSection(page: Page, section: string) {
  const href = `/workspace?section=${section}`;
  let navigation = page
    .getByRole("complementary", { name: "Main navigation" })
    .getByRole("navigation", { name: "Workspace", exact: true });
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    navigation = page
      .getByRole("dialog")
      .getByRole("navigation", { name: "Workspace", exact: true });
  }
  await expect(navigation).toBeVisible();
  await navigation.locator(`a[href="${href}"]`).click();
  await expect(page).toHaveURL(href);
  await expect(page.getByRole("dialog")).toBeHidden();
}
async function expectRoleSections(page: Page, sections: string[]) {
  const navigation = page
    .getByRole("complementary", { name: "Main navigation" })
    .getByRole("navigation", { name: "Workspace", exact: true });
  const links = navigation.locator('a[href^="/workspace?section="]');
  await expect(links).toHaveCount(sections.length);
  expect(
    await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute("href")),
    ),
  ).toEqual(sections.map((section) => `/workspace?section=${section}`));
  await expect(
    navigation.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

async function json(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const session = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch(`/api/v1${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    },
    { path, body },
  );
}

test("school roles share a lesson, submit work, exchange feedback and messages, and complete advisor-parent approval", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  const advisorContext = await browser.newContext();
  const parentContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  const student = await studentContext.newPage();
  const advisor = await advisorContext.newPage();
  const parent = await parentContext.newPage();
  try {
    await login(teacher, "teacher");
    await login(student, "student");
    await login(advisor, "advisor");
    await login(parent, "parent");
    await expectRoleSections(teacher, ["lessons", "work"]);
    await expectRoleSections(student, ["plans", "lessons", "work", "messages"]);
    await expectRoleSections(advisor, ["students", "plans", "messages"]);
    await expectRoleSections(parent, ["plans", "work"]);
    const teacherNavigation = teacher
      .getByRole("complementary", { name: "Main navigation" })
      .getByRole("navigation", { name: "Workspace", exact: true });
    await teacherNavigation
      .getByRole("link", { name: "My lessons", exact: true })
      .focus();
    await teacher.keyboard.press("Enter");
    await expect(teacher).toHaveURL("/workspace?section=lessons");
    await expect(
      teacherNavigation.getByRole("link", { name: "My lessons", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await openSection(teacher, "work");
    const title = `Newton work ${Date.now()}`;
    const lesson = await json(teacher, "/study/lessons", {
      title,
      subject: "Physics",
      transcript:
        "Newton's second law says force equals mass times acceleration. A two kilogram cart with a six newton net force accelerates at three metres per second squared.",
    });
    await expect
      .poll(
        async () => (await json(teacher, `/study/lessons/${lesson.id}`)).state,
        { timeout: 60000 },
      )
      .toBe("ready");
    await teacher.reload();
    await teacher.getByText("Create an assignment", { exact: true }).click();
    await teacher
      .getByRole("combobox", { name: "Student", exact: true })
      .selectOption({ label: "School Student · school-student" });
    await teacher.getByLabel("Assignment title").fill(title);
    await teacher
      .getByLabel("Instructions", { exact: true })
      .fill(
        "Explain the acceleration of a two kilogram cart under six newtons.",
      );
    await teacher
      .getByRole("combobox", { name: "Related lesson (optional)", exact: true })
      .selectOption(lesson.id);
    await teacher
      .getByRole("button", { name: "Share assignment", exact: true })
      .click();
    await expect(
      teacher.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await openSection(student, "work");
    const studentWork = student.getByRole("article").filter({
      has: student.getByRole("heading", { name: title, exact: true }),
    });
    await studentWork
      .getByLabel("Your answer")
      .fill("The acceleration is 3 m/s² because 6 divided by 2 is 3.");
    await studentWork
      .getByRole("button", { name: "Submit work", exact: true })
      .click();
    await expect(studentWork).toContainText("With your teacher");
    await openSection(student, "lessons");
    await expect(
      student.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await teacher.reload();
    const teacherWork = teacher.getByRole("article").filter({
      has: teacher.getByRole("heading", { name: title, exact: true }),
    });
    await teacherWork
      .getByLabel("Feedback", { exact: true })
      .fill("Correct. Your units and reasoning are clear.");
    await teacherWork
      .getByRole("button", { name: "Send feedback", exact: true })
      .click();
    await expect(teacherWork).toContainText("Feedback ready");
    await openSection(student, "work");
    await expect(studentWork).toContainText(
      "Your units and reasoning are clear.",
    );
    await openSection(student, "messages");
    await student
      .getByLabel("Message to School Advisor")
      .fill("Can we discuss my engineering project?");
    await student
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      student.getByRole("log", { name: "Advisor messages" }),
    ).toContainText("engineering project");
    await advisor.reload();
    await openSection(advisor, "messages");
    await expect(advisor.getByRole("log")).toContainText("engineering project");
    await advisor
      .getByLabel("Message to School Student")
      .fill("Yes. Send me a proposal and we can review the plan.");
    await advisor
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(advisor.getByRole("log")).toContainText("review the plan");
    await openSection(student, "plans");
    await student
      .getByText("Bring an idea to your advisor", { exact: true })
      .click();
    await student
      .getByRole("combobox", { name: "Advisor", exact: true })
      .selectOption({ label: "School Advisor · school-advisor" });
    await student
      .getByRole("combobox", { name: "Parent decision", exact: true })
      .selectOption({ label: "School Parent · school-parent" });
    const proposal = `Engineering project ${Date.now()}`;
    await student.getByLabel("Proposal title").fill(proposal);
    await student
      .getByLabel("Your idea")
      .fill("Build and test a small cart to study Newton's laws.");
    await student
      .getByRole("button", { name: "Send to advisor", exact: true })
      .click();
    await expect(
      student.getByRole("heading", { name: proposal, exact: true }),
    ).toBeVisible();
    await advisor.reload();
    await openSection(advisor, "plans");
    const advisorProposal = advisor.getByRole("article").filter({
      has: advisor.getByRole("heading", { name: proposal, exact: true }),
    });
    await advisorProposal
      .getByLabel("Decision note")
      .fill("The project is scoped well. Please review with your parent.");
    await advisorProposal
      .getByRole("button", { name: "Save decision" })
      .click();
    await expect(advisorProposal).toContainText("With parent");
    await parent.reload();
    await openSection(parent, "plans");
    const parentProposal = parent.getByRole("article").filter({
      has: parent.getByRole("heading", { name: proposal, exact: true }),
    });
    await parentProposal
      .getByLabel("Decision note")
      .fill("Approved. We can prepare the materials this weekend.");
    await parentProposal.getByRole("button", { name: "Save decision" }).click();
    await expect(parentProposal.locator(".school-status")).toHaveText(
      "Approved",
    );
    await student.reload();
    await openSection(student, "plans");
    await expect(
      student.getByRole("article").filter({ hasText: proposal }),
    ).toContainText("prepare the materials");
    await student.setViewportSize({ width: 390, height: 844 });
    await openSection(student, "work");
    await openSection(student, "plans");
    expect(
      await student.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page: student }).analyze()).violations,
    ).toEqual([]);
    await student.screenshot({
      path: test.info().outputPath("workspace-student-mobile.png"),
      fullPage: true,
    });
    await teacher.setViewportSize({ width: 1440, height: 1000 });
    expect(
      (await new AxeBuilder({ page: teacher }).analyze()).violations,
    ).toEqual([]);
    await teacher.screenshot({
      path: test.info().outputPath("workspace-teacher.png"),
      fullPage: true,
    });
    await teacher.emulateMedia({ reducedMotion: "reduce" });
    await teacher
      .getByRole("button", { name: "Switch to dark theme", exact: true })
      .click();
    await expect(teacher.locator("body")).toHaveCSS(
      "color",
      "rgb(238, 240, 244)",
    );
    expect(
      (await new AxeBuilder({ page: teacher }).analyze()).violations,
    ).toEqual([]);
  } finally {
    await Promise.all([
      teacherContext.close(),
      studentContext.close(),
      advisorContext.close(),
      parentContext.close(),
    ]);
  }
});

test("workspace stays private and gives unprovisioned accounts an honest empty state", async ({
  page,
}) => {
  await page.goto("/workspace");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/login?next=workspace");
  await page.goto("/login");
  await page.getByLabel("Login", { exact: true }).fill("browser");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your school connections are not set up yet",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share assignment", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open your study space" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("real and preview accounts share the Pearl home and keep uploads in the main navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/preview/lina/home");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Lina", exact: true }),
  ).toBeVisible();
  const previewFrame = await page
    .locator(".atlas-workspace")
    .evaluate((root) => ({
      frame: root.className,
      aside: root.querySelector("aside")?.className,
      main: root.querySelector("#main-content")?.className,
      hero: root.querySelector(".pearl-home-hero")?.className,
    }));
  await login(page, "student");
  const realFrame = await page.locator(".atlas-workspace").evaluate((root) => ({
    frame: root.className,
    aside: root.querySelector("aside")?.className,
    main: root.querySelector("#main-content")?.className,
    hero: root.querySelector(".pearl-home-hero")?.className,
  }));
  expect(realFrame).toEqual(previewFrame);
  await expect(page.locator(".atlas-composer-wrap")).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Main navigation" })
      .getByRole("link", { name: "Files & recordings", exact: true }),
  ).toHaveAttribute("href", "/files");
  await page
    .getByRole("complementary", { name: "Main navigation" })
    .getByRole("link", { name: "Files & recordings", exact: true })
    .click();
  await expect(page).toHaveURL("/files");
  await expect(
    page.getByRole("heading", { name: "Your files", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".atlas-workspace > aside")).toHaveClass(
    previewFrame.aside ?? "",
  );
  await expect(
    page
      .getByRole("complementary", { name: "Main navigation" })
      .getByRole("link", { name: "Files & recordings", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Welcome back, School", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Upload a document or recording",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your files", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
