import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: ".cache/browser-results",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
  },
  webServer: [
    {
      command: "uv run --frozen python scripts/e2e_server.py",
      url: "http://127.0.0.1:8100/api/v1/health/live",
      reuseExistingServer: false,
    },
    {
      command:
        process.env.SCHOOL_E2E_PRODUCTION === "1"
          ? "bun scripts/e2e-production.ts"
          : "bun run --cwd apps/web dev --port 3100",
      timeout: 120000,
      url: "http://localhost:3100",
      env: { API_INTERNAL_URL: "http://127.0.0.1:8100", SCHOOL_E2E: "1" },
      reuseExistingServer: false,
    },
  ],
});
