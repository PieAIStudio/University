import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".university-local-build/**", "studies/**"],
    // The course-generation and course-revision suites drive real Git objects
    // and real SQLite files through a temporary studies shelf, which lands at
    // 5-6s on a warm laptop — right on top of Vitest's 5s default. That made
    // `pnpm verify` fail at random with a timeout rather than a real defect.
    // 20s keeps a genuinely hung test failing fast while giving the two
    // filesystem-bound suites the headroom they actually need.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
