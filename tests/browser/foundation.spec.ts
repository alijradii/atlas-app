import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("sign in, upload a private file, download, and sign out", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?next=files");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Login").fill("browser");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid sign-in credentials" }),
  ).toHaveText("Invalid sign-in credentials");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic browser password 2036");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "Your files" })).toBeVisible();
  await page.getByLabel("Choose a file").setInputFiles({
    name: "hello.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Hello from the foundation"),
  });
  const download = page.getByRole("link", { name: "Download hello.txt" });
  await expect(download).toBeVisible();
  const response = await page.request.get(
    (await download.getAttribute("href")) as string,
  );
  expect(await response.text()).toBe("Hello from the foundation");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Delete hello.txt" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(download).toBeHidden();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.goto("/school");
  await expect(page.getByText("404", { exact: true })).toBeVisible();
});
