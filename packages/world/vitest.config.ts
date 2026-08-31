import { defineConfig } from "vitest/config";

/**
 * The island blueprint and recipe checks exercise many seeded layouts. Their
 * runtime is above Vitest's 5s default when the workspace test runners are
 * active together, even though the assertions pass when the files are given
 * enough time. Keep the timeout as a hang guard, not as a performance budget.
 *
 * 20s still timed out at load averages around 40 (the same files pass in ~10s
 * when run alone). 60s remains a hang guard; it is not a performance claim.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 60_000,
  },
});
