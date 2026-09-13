import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
import { ONLINE_ORIGIN } from "./ports.js";

// Repeat the product-line checks against a real, already-built delivery App.
// This is an additional handoff entry, NOT a replacement for the default
// dual-mode suite or its pre-push hook. Course source freshness stays separate.
export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL(".", import.meta.url)),
  testMatch: [
    "product-completeness.spec.ts",
    "product-lightness.spec.ts",
    "practice-focus.spec.ts",
  ],
  projects: [{ name: "product-preview" }],
  outputDir: "../SCRATCH/e2e/product-results",
  reporter: [["list"]],
  webServer: {
    command: `pnpm --filter @pieai/university-app exec vite preview --mode delivery --host 127.0.0.1 --port ${new URL(ONLINE_ORIGIN).port} --strictPort`,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: ONLINE_ORIGIN,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
