import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".university-local-build/**", "studies/**"],
    setupFiles: ["./vitest.setup.ts"],
    // The course-generation and course-revision suites drive real Git objects
    // and real SQLite files through a temporary studies shelf. Alone on a warm
    // laptop that is 8s; inside `pnpm -r test`, with four packages compiling
    // beside it, the same suite has been measured at 33s. Twenty seconds sat
    // between those two numbers, so the gate failed on machine load and called
    // it a defect.
    //
    // The principle the earlier number got wrong: a timeout on an I/O-bound
    // suite exists to catch a *hang*, not to enforce a performance budget. A
    // hung test still fails inside a minute, and a busy machine stops being a
    // red build.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
