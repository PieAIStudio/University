import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

import base from "./playwright.config.js";

// Explicit opt-in: reuse the existing ordinary-page assertions and server
// lifecycle. Never add this lane to the default/pre-push suite implicitly.
// Install with this project's version: pnpm exec playwright install webkit.
// Playwright WebKit is not installed Safari or a physical iPhone.
process.env.UNIVERSITY_COURSE_CAPTURE_DIR ??= fileURLToPath(
  new URL("../SCRATCH/e2e-webkit/continuous-course/", import.meta.url),
);

export default defineConfig({
  ...base,
  outputDir: "../SCRATCH/e2e-webkit/test-results",
  reporter: [["list"], ["html", { outputFolder: "../SCRATCH/e2e-webkit/report", open: "never" }]],
  use: {
    ...base.use,
    browserName: "webkit",
    channel: undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "webkit-course-smoke",
      testMatch: "**/continuous-course.spec.ts",
    },
  ],
});
