import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
});

for (const route of ["/preview/lina/home", "/"] as const) {
  test(`blue spheres keep a continuous compositor orbit on ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
    const scene = page.locator(".pearl-scene").first();
    await expect(scene).toHaveAttribute("data-pearl-scene", "running");
    const motion = await scene.locator(".blue.float").evaluateAll((elements) =>
      elements.map((element) => {
        const animation = element
          .getAnimations()
          .find(
            (item) =>
              item instanceof CSSAnimation &&
              item.animationName === "pearl-blue-orbit",
          );
        if (!animation?.effect) throw new Error("Sphere orbit is missing");
        const duration = Number(animation.effect.getTiming().duration);
        const delay = Number(animation.effect.getTiming().delay);
        animation.pause();
        const steps: number[] = [];
        let previous: DOMRect | undefined;
        for (let elapsed = 0; elapsed <= duration * 2; elapsed += 1000 / 60) {
          animation.currentTime = delay + duration + elapsed;
          const current = element.getBoundingClientRect();
          if (previous)
            steps.push(
              Math.hypot(current.x - previous.x, current.y - previous.y),
            );
          previous = current;
        }
        const frames = (animation.effect as KeyframeEffect).getKeyframes();
        animation.play();
        return {
          min: Math.min(...steps),
          max: Math.max(...steps),
          transformOnly: frames.every(
            (frame) => "transform" in frame && !("opacity" in frame),
          ),
        };
      }),
    );
    expect(motion).toHaveLength(2);
    for (const sphere of motion) {
      expect(sphere.transformOnly).toBe(true);
      expect(sphere.min, "No stop-and-reverse dwell").toBeGreaterThan(0.005);
      expect(
        sphere.max,
        "No jump between 60Hz samples, including loop seams",
      ).toBeLessThan(0.2);
      expect(sphere.max / sphere.min).toBeLessThan(2.5);
    }
  });
}

test("ambient glass pauses off screen and honors changing motion preferences", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  const scene = page.locator(".pearl-home-hero-stage");
  const shape = scene.locator(".blue.float").first();
  await expect(scene).toHaveAttribute("data-pearl-scene", "running");
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
  );
  await expect(scene).toHaveAttribute("data-pearl-scene", "paused");
  await expect(shape).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(scene).toHaveAttribute("data-pearl-scene", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene).toHaveAttribute("data-pearl-scene", "paused");
  for (const object of await scene.locator(".float").all())
    await expect(object).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene).toHaveAttribute("data-pearl-scene", "running");
});

test("helper state changes preserve animation identity and use bare line icons", async ({
  page,
}) => {
  await page.goto("/preview/lina/home");
  const scene = page.locator(".pearl-home-hero-stage");
  await expect(scene).toHaveAttribute("data-pearl-scene", "running");
  const objects = scene.locator(".blue.float");
  await objects.evaluateAll((elements) => {
    (window as unknown as { pearlAnimations: Animation[] }).pearlAnimations =
      elements.map((element) => element.getAnimations()[0]);
  });
  await page.locator(".pearl-home-helper").first().click();
  await expect(page.locator(".pearl-home-helper").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await objects.evaluateAll((elements) =>
      elements.every(
        (element, i) =>
          element.getAnimations()[0] ===
          (window as unknown as { pearlAnimations: Animation[] })
            .pearlAnimations[i],
      ),
    ),
  ).toBe(true);
  const icons = page.locator(".pearl-home-helper-icon");
  await expect(icons.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(icons.first()).toHaveCSS("box-shadow", "none");
  await page
    .getByRole("button", { name: "Enable all updates", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "All selected" }),
  ).toBeVisible();
});

test("home reference proportions and student work sections survive narrow layouts", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/lina/home");
  const bounds = await page.locator(".pearl-home").evaluate((home) => {
    const rect = (selector: string) => {
      const element = home.querySelector(selector);
      if (!element) throw new Error(`Missing home element: ${selector}`);
      return element.getBoundingClientRect();
    };
    return {
      hero: rect(".pearl-home-hero").width,
      copy: rect(".pearl-home-hero-copy").width,
      tile: rect(".pearl-home-action").height,
      helper: rect(".pearl-home-more").width,
    };
  });
  expect(bounds.copy / bounds.hero).toBeCloseTo(0.575, 2);
  expect(bounds.tile).toBeGreaterThanOrEqual(270);
  expect(bounds.tile).toBeLessThan(360);
  expect(bounds.helper).toBe(720);
  await expect(
    page.getByRole("heading", { name: "Needs your attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unfinished work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".pearl-home-date")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
