import { expect, test } from "@playwright/test";

test("malformed stored preview data recovers without a render crash", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "atlas-pearl-preview-v1",
      '{"answers":null,"settings":null}',
    );
  });
  await page.goto("/preview/lina/practice");
  await expect(page.getByLabel("Answer 1", { exact: true })).toHaveValue("0.4");
  await page.getByLabel("Answer 3", { exact: true }).fill("3600");
  await page.getByLabel("Working 3", { exact: true }).fill("1200 × 3");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("atlas-pearl-preview-v1") ?? "{}")
            .answers?.[2],
      ),
    )
    .toBe("3600");
  expect(errors).toEqual([]);
});
