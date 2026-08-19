import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { UaDashboardManager, resolveUaDashboardDirectory } from "./dashboard.js";

describe("UA Dashboard bridge", () => {
  it("honours an explicit Dashboard directory", () => {
    const home = mkdtempSync(join(tmpdir(), "university-local-dashboard-home-"));
    const dashboard = join(home, "custom-dashboard");
    mkdirSync(dashboard, { recursive: true });
    writeFileSync(join(dashboard, "vite.config.ts"), "export default {}\n");

    expect(
      resolveUaDashboardDirectory({
        home,
        env: { UNIVERSITY_LOCAL_UA_DASHBOARD_DIR: dashboard },
      }),
    ).toBe(realpathSync(dashboard));
  });

  it("reports a missing UA analysis before trying to start a process", async () => {
    const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-dashboard-studies-"));
    const manager = new UaDashboardManager(studiesRoot, { home: studiesRoot, env: {} });

    await expect(manager.open("sample")).rejects.toMatchObject({ status: 404 });
    manager.close();
  });
});
