import { cpus } from "node:os";
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
 * How many browsers run at once, and what that costs a waiting assertion.
 *
 * Price of one full run, 2026-09-21: **432 tests, ~16-18 minutes, no failures**
 * — and that price holds only while this suite is the heaviest thing on the
 * machine. Four runs said so: 15.3min and 16.2min and 17.9min all green, while
 * a run started alongside a second full suite measured 27.9min and five reds,
 * all in the authoring specs. That is not a different result, it is a
 * different condition. What makes this record stale: another full suite (or
 * another agent's) running beside it, a materially larger suite, or a
 * different machine.
 *
 * The suite ran on one worker from the day it was created, when it was small.
 * Measured 2026-09-21 on this 10-core machine, 432 tests: one worker 42.3min,
 * three 17.0, four 15.2, six 15.0. Four is where the wall time flattens —
 * past it the machine only buys contention, and six produced four reds where
 * four produced one. `fullyParallel` was measured too (14.7min, three reds):
 * half a minute for three more failures, so it stays off.
 *
 * It is a share of the machine, not a fixed count, and a deliberately small
 * one. This laptop is a person's laptop: it runs their browser, their editor
 * and often another project's suite at the same time. Sampled during a run,
 * the suite held 3.4 cores while everything else held 3.5 and about three sat
 * idle — so the gate was never short of machine, and taking more of it would
 * cost the owner their laptop for a quarter of an hour to buy nothing. 40% is
 * also where the measurements above flatten, so the ceiling and the optimum
 * agree. On Apple silicon it keeps the workers on performance cores: ten
 * logical cores here are eight performance and two efficiency, and a worker
 * scheduled onto an efficiency core is the slowest test in the run.
 *
 * Four browsers, two dev servers, an API and a grading function on one laptop
 * make every page legitimately slower to become interactive. The waits below
 * ask "did it happen", not "was it fast", so under parallel load they are
 * given proportionate room. The assertions that really are speed budgets —
 * click-to-landing in 540ms, frame timing — live in the `timing` project,
 * which runs alone and keeps its original strictness. One threshold must not
 * serve both questions.
 */
const workerShare = process.env.E2E_WORKERS ?? "40%";
if (!/^(\d+%|\d+)$/.test(workerShare)) {
  throw new Error("E2E_WORKERS must be a worker count or a percentage of cores");
}
// Playwright takes a percentage as a string and a count as a number, and
// rejects a numeric string. Resolving the share here also tells the timeouts
// below whether anything is actually sharing the machine.
const workers = workerShare.endsWith("%") ? workerShare : Number(workerShare);
const resolvedWorkers = workerShare.endsWith("%")
  ? Math.max(1, Math.floor((cpus().length * Number.parseInt(workerShare, 10)) / 100))
  : Number(workerShare);
const contended = resolvedWorkers > 1;
const actionTimeout = contended ? 45_000 : 20_000;

/** Speed budgets measure the machine, so they must not share it. */
const TIMING_SPECS = [
  "**/avatar.spec.ts",
  "**/archipelago-reference.spec.ts",
  "**/experience.spec.ts",
  "**/map-studio-3d.spec.ts",
  "**/motion-time.spec.ts",
];

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
  workers,
  timeout: contended ? 240_000 : 180_000,
  expect: { timeout: actionTimeout },
  retries: 0,
  outputDir: "../SCRATCH/e2e/test-results",
  reporter: [["list"], ["html", { outputFolder: "../SCRATCH/e2e/report", open: "never" }]],
  projects: [
    {
      name: "default",
      testIgnore: ["**/island-look.spec.ts", ...TIMING_SPECS],
    },
    {
      // Run this one alone: `pnpm e2e:timing`. Its budgets are meaningless on
      // a machine that is also running three other browsers.
      name: "timing",
      testMatch: TIMING_SPECS,
    },
    {
      name: "island-look",
      testMatch: "**/island-look.spec.ts",
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
    actionTimeout,
    navigationTimeout: contended ? 90_000 : 60_000,
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
