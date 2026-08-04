import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getUaAnalysisPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { failUaAnalysis, retireUaAnalysis } from "../ua/adapter.js";
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

function writeCompleteUaOutput(
  dataDirectory: string,
  sourceCommit: string,
  analyzedAt: string = GENERATED_AT,
): void {
  writeFileSync(
    join(dataDirectory, "knowledge-graph.json"),
    JSON.stringify({
      project: { gitCommitHash: sourceCommit, analyzedAt },
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
    JSON.stringify({ gitCommitHash: sourceCommit, lastAnalyzedAt: analyzedAt }),
  );
  writeFileSync(
    join(dataDirectory, "fingerprints.json"),
    JSON.stringify({
      gitCommitHash: sourceCommit,
      generatedAt: analyzedAt,
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

  it("allocates -retry2 with disposition retried when the identity slot is superseded", () => {
    const { studiesRoot, uaSkillPath } = setup();
    const prepared = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date(STARTED_AT),
    });
    writeCompleteUaOutput(prepared.invocation!.dataDirectory, prepared.snapshot.sourceCommit);
    finalizeStudyRefresh({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      now: new Date("2026-07-20T00:02:00.000Z"),
    });
    const retired = retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      reason: "quality gate failed; re-run same config",
      now: new Date("2026-07-20T00:03:00.000Z"),
    });
    const retiredManifestBefore = readFileSync(
      getUaAnalysisPaths(studiesRoot, "sample", prepared.analysis.id).manifest,
      "utf8",
    );

    const retried = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:04:00.000Z"),
    });
    expect(retried.disposition).toBe("retried");
    expect(retried.analysis.id).toBe(`${prepared.analysis.id}-retry2`);
    expect(retried.analysis.status).toBe("preparing");
    expect(retried.invocation).not.toBeNull();
    expect(retried.analysis.id.endsWith("-retry2")).toBe(true);

    const retiredManifestAfter = readFileSync(
      getUaAnalysisPaths(studiesRoot, "sample", prepared.analysis.id).manifest,
      "utf8",
    );
    expect(retiredManifestAfter).toBe(retiredManifestBefore);
    expect(retired.status).toBe("superseded");
    expect(JSON.parse(retiredManifestAfter)).toMatchObject({
      status: "superseded",
      id: prepared.analysis.id,
      supersededReason: "quality gate failed; re-run same config",
    });
  });

  it("resumes an interrupted -retry2 instead of orphaning it behind -retry3", () => {
    const { studiesRoot, uaSkillPath } = setup();
    const prepared = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date(STARTED_AT),
    });
    writeCompleteUaOutput(prepared.invocation!.dataDirectory, prepared.snapshot.sourceCommit);
    finalizeStudyRefresh({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      now: new Date("2026-07-20T00:02:00.000Z"),
    });
    retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      reason: "quality gate failed; re-run same config",
      now: new Date("2026-07-20T00:03:00.000Z"),
    });
    const firstRetry = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:04:00.000Z"),
    });
    expect(firstRetry.analysis.id).toBe(`${prepared.analysis.id}-retry2`);
    expect(firstRetry.analysis.status).toBe("preparing");

    // The retry run is interrupted before finalize, then prepare is called again.
    const resumed = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:05:00.000Z"),
    });
    expect(resumed.disposition).toBe("resumed");
    expect(resumed.analysis.id).toBe(`${prepared.analysis.id}-retry2`);
    expect(resumed.analysis.status).toBe("preparing");
    expect(resumed.invocation).not.toBeNull();
    expect(
      existsSync(getUaAnalysisPaths(studiesRoot, "sample", `${prepared.analysis.id}-retry3`).root),
    ).toBe(false);
  });

  it("allocates -retry3 when -retry2 already exists as superseded", () => {
    const { studiesRoot, uaSkillPath } = setup();
    const prepared = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date(STARTED_AT),
    });
    writeCompleteUaOutput(prepared.invocation!.dataDirectory, prepared.snapshot.sourceCommit);
    finalizeStudyRefresh({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      now: new Date("2026-07-20T00:02:00.000Z"),
    });
    retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId: prepared.analysis.id,
      reason: "first bad run",
      now: new Date("2026-07-20T00:03:00.000Z"),
    });

    const retry2 = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:04:00.000Z"),
    });
    expect(retry2.analysis.id).toBe(`${prepared.analysis.id}-retry2`);
    writeCompleteUaOutput(
      retry2.invocation!.dataDirectory,
      retry2.snapshot.sourceCommit,
      "2026-07-20T00:04:30.000Z",
    );
    finalizeStudyRefresh({
      studiesRoot,
      studyId: "sample",
      analysisId: retry2.analysis.id,
      now: new Date("2026-07-20T00:05:00.000Z"),
    });
    retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId: retry2.analysis.id,
      reason: "second bad run",
      now: new Date("2026-07-20T00:06:00.000Z"),
    });

    const retry3 = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date("2026-07-20T00:07:00.000Z"),
    });
    expect(retry3.disposition).toBe("retried");
    expect(retry3.analysis.id).toBe(`${prepared.analysis.id}-retry3`);
    expect(retry3.analysis.status).toBe("preparing");
  });

  it("still refuses to prepare when the identity slot is failed", () => {
    const { studiesRoot, uaSkillPath } = setup();
    const prepared = prepareStudyRefresh({
      studiesRoot,
      studyId: "sample",
      uaSkillPath,
      now: new Date(STARTED_AT),
    });
    failUaAnalysis(
      studiesRoot,
      "sample",
      prepared.analysis.id,
      "host aborted analysis",
      new Date("2026-07-20T00:02:00.000Z"),
    );

    expect(() =>
      prepareStudyRefresh({
        studiesRoot,
        studyId: "sample",
        uaSkillPath,
        now: new Date("2026-07-20T00:03:00.000Z"),
      }),
    ).toThrow(/is failed; it cannot be prepared or reused/);
  });
});
