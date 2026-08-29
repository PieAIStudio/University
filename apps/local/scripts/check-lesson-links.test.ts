import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./check-lesson-links.mjs", import.meta.url));
const FIXTURE_ROOT = fileURLToPath(new URL("../fixtures/lesson-links", import.meta.url));

function run(args: readonly string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
  });
}

describe("check-lesson-links", () => {
  it("executes the checked-in resolver fixture", () => {
    const result = run(["--studies-root", FIXTURE_ROOT]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Total [[lesson:]] links parsed: 2");
    expect(result.stdout).toContain("PASS: lesson links and resolver-scoped lesson ids are valid.");
  });

  it("fails closed when the requested source has no studies", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "university-lesson-links-empty-"));
    try {
      const result = run(["--studies-root", emptyRoot]);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("ERROR: no study manifests");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
