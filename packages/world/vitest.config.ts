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
    projects: [
      {
        test: {
          name: "world",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: [
            "src/island/remote-props.test.ts",
            "src/island/remote-island-field.test.ts",
            "src/island/remote-world-projection.test.ts",
            "src/world-course-projection.test.ts",
            "src/island/island-geometry.test.ts",
          ],
          testTimeout: 60_000,
          sequence: { groupOrder: 0 },
        },
      },
      {
        // CPU budgets need an uncontended runner, after the seeded suite.
        // The 60-shape topology matrix also belongs here: in R32 it took
        // 36s alone but exceeded 60s under concurrent geometry workers.
        // The cache probe measured 2.4ms alone versus 24.3ms in that same
        // contention. Keep all assertions and the 20ms/60s limits unchanged.
        test: {
          name: "remote-performance",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "src/island/remote-props.test.ts",
            "src/island/remote-island-field.test.ts",
            "src/island/remote-world-projection.test.ts",
            "src/world-course-projection.test.ts",
            "src/island/island-geometry.test.ts",
          ],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 60_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
