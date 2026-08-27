import { fileURLToPath } from "node:url";
import { ONLINE_ORIGIN } from "./ports.js";

import { defineConfig } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * System Chrome, not Playwright's bundled Chromium.
 *
 * The binary is hundreds of megabytes and this machine already has
 * /Applications/Google Chrome.app. `channel: "chrome"` was probed at
 * install time and launched HeadlessChrome/151.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  outputDir: "../SCRATCH/e2e/test-results",
  reporter: [["list"], ["html", { outputFolder: "../SCRATCH/e2e/report", open: "never" }]],
  projects: [
    {
      name: "default",
      testIgnore: "**/J.island-look.spec.ts",
    },
    {
      name: "island-look",
      testMatch: "**/J.island-look.spec.ts",
    },
  ],
  use: {
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    channel: "chrome",
    headless: true,
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: "node e2e/start-servers.mjs",
    cwd: ROOT,
    url: ONLINE_ORIGIN,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
