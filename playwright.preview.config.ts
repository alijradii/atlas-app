import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Public preview checks do not need credentials, PostgreSQL, or the API server.
export default defineConfig({
  ...config,
  testMatch: [
    "pearl.spec.ts",
    "pearl-motion.spec.ts",
    "spotlight.spec.ts",
    "rich-message.spec.ts",
    "composer.spec.ts",
    "workflow-meaning.spec.ts",
    "home-meaning.spec.ts",
    "preview-regressions.spec.ts",
    "preview-storage.spec.ts",
    "files-regressions.spec.ts",
  ],
  webServer: Array.isArray(config.webServer)
    ? config.webServer.slice(1)
    : config.webServer,
});
