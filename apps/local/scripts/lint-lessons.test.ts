import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./lint-lessons.mjs", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../fixtures/lesson-lint", import.meta.url));

function runFixture(name: "valid" | "two-openings") {
  const root = mkdtempSync(join(tmpdir(), "university-lesson-lint-"));
  try {
    cpSync(join(FIXTURES, name, "studies"), join(root, "studies"), { recursive: true });
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: root,
      encoding: "utf8",
    });
    return { ...result, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("lint-lessons opening shape", () => {
  it("keeps a legal single-opening 现象 lesson green", () => {
    const result = runFixture("valid");

    expect(result.status).toBe(0);
    expect(result.output).toContain("1 节课已检查，0 节有问题");
  });

  it("rejects a 现象 lesson with two opening sections", () => {
    const result = runFixture("two-openings");

    expect(result.status).toBe(1);
    expect(result.output).toContain("需要恰好 1 个开场章节，实际为 2");
  });
});
