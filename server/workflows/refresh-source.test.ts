import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { finalizeStudyRefresh, prepareStudyRefresh } from "./refresh-source.js";

const STARTED_AT = "2026-07-20T00:00:00.000Z";
const GENERATED_AT = "2026-07-20T00:01:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function createUaFixture(container: string): string {
  const root = join(container, "ua-plugin");
  const skill = join(root, "plugin", "skills", "understand");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "# Understand\n");
  writeFileSync(join(root, "plugin", "engine.ts"), "export const engine = '2.9.4';\n");
  execFileSync("git", ["init", "-q", "-b", "main", root]);
  git(root, ["config", "user.name", "UniversityLocal Test"]);
  git(root, ["config", "user.email", "test@university.local"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "Initial UA"]);
  return skill;
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-refresh-source-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "app.ts"), "export const answer = 42;\n");
  git(sourceRoot, ["add", "app.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const uaSkillPath = createUaFixture(container);
  return { studiesRoot, sourceRoot, uaSkillPath };
}

function writeCompleteUaOutput(dataDirectory: string, sourceCommit: string): void {
  writeFileSync(
    join(dataDirectory, "knowledge-graph.json"),
    JSON.stringify({
      project: { gitCommitHash: sourceCommit, analyzedAt: GENERATED_AT },
      nodes: [{ id: "file:app.ts", type: "file", filePath: "app.ts" }],
      edges: [],
      layers: [
        {
          id: "application",
          name: "Application",
          description: "Application files",
          nodeIds: ["file:app.ts"],
        },
      ],
      tour: [
        {
          order: 1,
          title: "Start",
          description: "Start here",
          nodeIds: ["file:app.ts"],
        },
      ],
    }),
  );
  writeFileSync(
    join(dataDirectory, "meta.json"),
    JSON.stringify({ gitCommitHash: sourceCommit, lastAnalyzedAt: GENERATED_AT }),
  );
  writeFileSync(
    join(dataDirectory, "fingerprints.json"),
    JSON.stringify({
      gitCommitHash: sourceCommit,
      generatedAt: GENERATED_AT,
      files: { "app.ts": { contentHash: "fixture" } },
    }),
  );
}

describe("source refresh orchestration", () => {
  it("rejects dirty state by default and proceeds only after explicit exclusion acknowledgement", () => {
    const { studiesRoot, sourceRoot, uaSkillPath } = setup();
    writeFileSync(join(sourceRoot, "app.ts"), "export const answer = 43;\n");
    git(sourceRoot, ["add", "app.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Local unpushed commit"]);
    const localCommit = git(sourceRoot, ["rev-parse", "HEAD"]);
    writeFileSync(join(sourceRoot, "draft.ts"), "export const draft = true;\n");
    const before = git(sourceRoot, ["status", "--porcelain=v1"]);

    expect(() => prepareStudyRefresh({ studiesRoot, studyId: "sample", uaSkillPath })).toThrow(
      /--acknowledge-dirty-excluded/,
    );

    const receipt = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      reference: "HEAD",
      uaSkillPath,
      acknowledgeDirtyExcluded: true,
      now: new Date(STARTED_AT),
    });
    expect(receipt).toMatchObject({
      disposition: "prepared",
      source: {
        dirty: true,
        dirtyEntries: ["?? draft.ts"],
        dirtyChangesIncluded: false,
        acknowledged: true,
        localCommitSufficient: true,
        pushRequired: false,
        requestedRef: "HEAD",
        resolvedCommit: localCommit,
      },
      snapshot: { sourceCommit: localCommit },
      invocation: { skill: "understand" },
      uaWasExecuted: false,
    });
    expect(receipt.invocation?.arguments).toEqual([
      receipt.invocation!.workspace,
      "--no-auto-update",
      "--language",
      "zh",
    ]);
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(before);
  });

  it("uses a clean local commit without a push and reuses an identical ready analysis", () => {
    const { studiesRoot, sourceRoot, uaSkillPath } = setup();
    const sourceBefore = git(sourceRoot, ["status", "--porcelain=v1"]);
    const prepared = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date(STARTED_AT),
    });
    expect(prepared.source.pushRequired).toBe(false);
    expect(prepared.source.resolvedCommit).toBe(git(sourceRoot, ["rev-parse", "HEAD"]));
    expect(prepared.invocation).not.toBeNull();
    writeCompleteUaOutput(prepared.invocation!.dataDirectory, prepared.snapshot.sourceCommit);

    const finalized = finalizeStudyRefresh({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      now: new Date("2026-07-20T00:02:00.000Z"),
    });
    expect(finalized.analysis.status).toBe("ready");

    const reused = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:03:00.000Z"),
    });
    expect(reused).toMatchObject({
      disposition: "ready-reused",
      invocation: null,
      nextAction: "audit-freshness",
      analysis: { id: prepared.analysis.id, status: "ready" },
    });
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(sourceBefore);
  });
});
