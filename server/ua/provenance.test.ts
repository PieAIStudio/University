import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectUaEngineProvenance } from "./provenance.js";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function makeUaRepository(): { readonly root: string; readonly skill: string } {
  const root = mkdtempSync(join(tmpdir(), "university-local-ua-provenance-"));
  const skill = join(root, "plugin", "skills", "understand");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "# Understand\n");
  writeFileSync(join(root, "plugin", "engine.ts"), "export const version = 1;\n");
  symlinkSync("engine.ts", join(root, "plugin", "engine-link.ts"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "UniversityLocal Test"]);
  git(root, ["config", "user.email", "test@university.local"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "Initial"]);
  return { root, skill };
}

describe("UA engine provenance", () => {
  it("binds a clean local plugin to its commit and content", () => {
    const fixture = makeUaRepository();
    const result = inspectUaEngineProvenance({ skillPath: fixture.skill });
    expect(result).toMatchObject({
      source: "user-skill-local-git",
      revision: git(fixture.root, ["rev-parse", "HEAD"]),
      dirty: false,
      entryPath: "plugin/skills/understand",
    });
    expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(fixture.root);
  });

  it("changes its content hash and dirty flag for tracked or untracked engine changes", () => {
    const fixture = makeUaRepository();
    const clean = inspectUaEngineProvenance({ skillPath: fixture.skill });
    writeFileSync(join(fixture.root, "plugin", "engine.ts"), "export const version = 2;\n");
    const tracked = inspectUaEngineProvenance({ skillPath: fixture.skill });
    expect(tracked.dirty).toBe(true);
    expect(tracked.contentHash).not.toBe(clean.contentHash);

    writeFileSync(join(fixture.root, "plugin", "new-engine.ts"), "export const added = true;\n");
    const untracked = inspectUaEngineProvenance({ skillPath: fixture.skill });
    expect(untracked.contentHash).not.toBe(tracked.contentHash);
  });

  it("binds a tracked deletion without trying to read the deleted file", () => {
    const fixture = makeUaRepository();
    const clean = inspectUaEngineProvenance({ skillPath: fixture.skill });
    rmSync(join(fixture.root, "plugin", "engine.ts"));
    const deleted = inspectUaEngineProvenance({ skillPath: fixture.skill });
    expect(deleted.dirty).toBe(true);
    expect(deleted.contentHash).not.toBe(clean.contentHash);
  });

  it("does not bind unrelated files outside the plugin boundary", () => {
    const fixture = makeUaRepository();
    const before = inspectUaEngineProvenance({ skillPath: fixture.skill });
    writeFileSync(join(fixture.root, "unrelated.txt"), "machine-local scratch\n");
    const after = inspectUaEngineProvenance({ skillPath: fixture.skill });
    expect(after).toEqual(before);
  });
});
