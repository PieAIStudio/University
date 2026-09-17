import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const origin = process.env.ACCOUNT_FLOW_ORIGIN;
if (!origin) {
  throw new Error("ACCOUNT_FLOW_ORIGIN must be set to a dedicated 127.0.0.1 origin");
}

export default defineConfig({
  testDir: fileURLToPath(new URL(".", import.meta.url)),
  testMatch: [
    "Z.account-feedback.spec.ts",
    "Z.account-flow.spec.ts",
    "Z.account-closure.spec.ts",
    "Z.account-app.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  outputDir:
    process.env.ACCOUNT_FLOW_OUTPUT_DIR ??
    `../.scratch/account-closeout/flows/${Date.now()}-${process.pid}`,
  reporter: [["list"]],
  use: {
    baseURL: origin,
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
    command: `pnpm --filter @pieai/university-app exec vite --mode delivery --host 127.0.0.1 --port ${new URL(origin).port} --strictPort`,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
