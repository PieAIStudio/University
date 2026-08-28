import { defineConfig } from "vitest/config";

/**
 * The island blueprint and recipe checks exercise many seeded layouts. Their
 * runtime is above Vitest's 5s default when the workspace test runners are
 * active together, even though the assertions pass when the files are given
 * enough time. Keep the timeout as a hang guard, not as a performance budget.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 20_000,
  },
});
