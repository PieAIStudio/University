import { configDefaults, defineConfig } from "vitest/config";

/**
 * Scope the test sweep to this project's own source.
 *
 * PGS materializes agent skills as symlinks under `.agents/skills` (and
 * `.claude/skills` points at the same tree). Several of those skill packs ship
 * their own example projects with `*.spec.ts` files, so Vitest's default glob
 * walks out of this repository and fails on dependencies that belong to the
 * skill, not to University.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
    // This suite uses node:test, not Vitest. The package test command runs it
    // with its native runner after this sweep; no assertions are skipped.
    exclude: [...configDefaults.exclude, "scripts/kenney-grid-bake.test.mjs"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
