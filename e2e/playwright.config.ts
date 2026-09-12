import { fileURLToPath } from "node:url";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";

import { defineConfig } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// Cold content baking may contend with other worktrees on the same machine.
// This only budgets server preparation; test/action timeouts never change.
const startupTimeout = Number(process.env.E2E_STARTUP_TIMEOUT_MS ?? 180_000);
if (!Number.isSafeInteger(startupTimeout) || startupTimeout < 180_000 || startupTimeout > 600_000) {
  throw new Error("E2E_STARTUP_TIMEOUT_MS must be between 180000 and 600000");
}

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
    // Existing route suites exercise a returning visitor. T.product-completeness
    // explicitly overrides this with EMPTY storage and tests the real welcome.
    // No progress, identity, answers, content or grading is seeded by this flag.
    storageState: {
      cookies: [],
      origins: [ONLINE_ORIGIN, LOCAL_ORIGIN].map((origin) => ({
        origin,
        localStorage: [{ name: "university.welcome.v1", value: "acknowledged" }],
      })),
    },
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
    timeout: startupTimeout,
    stdout: "pipe",
    stderr: "pipe",
  },
});
