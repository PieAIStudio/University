import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./lint-lessons.mjs", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../fixtures/lesson-lint", import.meta.url));

const MANIFEST = join(
  "studies",
  "fixture-study",
  "courses",
  "fixture-course",
  "units",
  "fixture-unit",
  "lessons",
  "valid-opening",
  "revisions",
  "1",
  "manifest.json",
);

function runFixture(
  name: "valid" | "two-openings",
  /** Applied to the copied manifest before linting, for rules that read it. */
  editManifest?: (manifest: Record<string, unknown>) => void,
) {
  const root = mkdtempSync(join(tmpdir(), "university-lesson-lint-"));
  try {
    cpSync(join(FIXTURES, name, "studies"), join(root, "studies"), { recursive: true });
    if (editManifest) {
      const path = join(root, MANIFEST);
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      editManifest(manifest);
      writeFileSync(path, JSON.stringify(manifest, null, 2));
    }
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

/*
  The rule that says a lesson does something with its hands, and the cutoff that
  keeps it off the four hundred and thirty-five lessons written before it
  existed.

  Both directions are asserted, because either alone reads as working. A rule
  that never fires is the three-per-cent status quo with a comment on it; a rule
  with no cutoff fails the entire existing shelf and gets switched off within a
  day. The fixture carries no `updatedAt` at all, which is the third case: an
  unreadable date must be treated as old rather than reported as this defect.
*/
describe("every lesson does something with its hands", () => {
  const ACTIVITY = {
    id: "fixture-play",
    kind: "sort",
    role: "apply",
    difficulty: "practice",
    title: "占位",
    brief: "占位",
    goal: "占位",
    takeaway: "占位",
    hint: "占位",
    source: { label: "占位", url: "https://example.org/fixture" },
  };

  it("fails a lesson written after the rule that carries no activity", () => {
    const result = runFixture("valid", (manifest) => {
      manifest.updatedAt = "2026-09-30T00:00:00.000Z";
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("这节课没有互动组件");
  });

  it("passes that same lesson once it carries one", () => {
    const result = runFixture("valid", (manifest) => {
      manifest.updatedAt = "2026-09-30T00:00:00.000Z";
      manifest.activities = [ACTIVITY];
    });

    expect(result.output).not.toContain("这节课没有互动组件");
  });

  it("leaves a lesson written before the rule alone, and counts it instead", () => {
    const result = runFixture("valid", (manifest) => {
      manifest.updatedAt = "2026-08-01T00:00:00.000Z";
    });

    expect(result.status).toBe(0);
    expect(result.output).not.toContain("这节课没有互动组件");
    expect(result.output).toContain("没有互动组件的存量课文：1 节");
  });

  it("treats a manifest with no date at all as predating the rule", () => {
    const result = runFixture("valid");

    expect(result.status).toBe(0);
    expect(result.output).toContain("没有互动组件的存量课文：1 节");
  });
});
