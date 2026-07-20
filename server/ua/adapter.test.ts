import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getUaAnalysisPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import {
  createUaAnalysisIdentity,
  failUaAnalysis,
  finalizeUaAnalysis,
  prepareUaAnalysis,
} from "./adapter.js";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup(options: { externalSymlink?: boolean } = {}) {
  const container = mkdtempSync(join(tmpdir(), "university-local-ua-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "app.ts"), "export const answer = 42;\n");
  if (options.externalSymlink) symlinkSync("../../private", join(sourceRoot, "external"));
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  return { studiesRoot, sourceRoot, snapshot };
}

function writeCompleteUaOutput(
  dataDirectory: string,
  sourceCommit: string,
  overrides: {
    graphCommit?: string;
    metaCommit?: string;
    fingerprintsCommit?: string;
    analyzedAt?: string;
  } = {},
) {
  const analyzedAt = overrides.analyzedAt ?? "2026-07-20T00:01:00.000Z";
  writeFileSync(
    join(dataDirectory, "knowledge-graph.json"),
    JSON.stringify({
      project: {
        gitCommitHash: overrides.graphCommit ?? sourceCommit,
        analyzedAt,
      },
      nodes: [{ id: "file:app.ts", type: "file" }],
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
    JSON.stringify({
      gitCommitHash: overrides.metaCommit ?? sourceCommit,
      lastAnalyzedAt: analyzedAt,
    }),
  );
  writeFileSync(
    join(dataDirectory, "fingerprints.json"),
    JSON.stringify({
      gitCommitHash: overrides.fingerprintsCommit ?? sourceCommit,
      generatedAt: analyzedAt,
      files: {},
    }),
  );
}

describe("UA adapter", () => {
  it("creates a stable analysis ID and separates different semantic configs", () => {
    const base = {
      snapshotId: "git-aaaaaaaaaaaa",
      sourceCommit: "a".repeat(40),
      engineVersion: "2.9.4",
      outputLanguage: "zh",
    } as const;
    const first = createUaAnalysisIdentity({
      ...base,
      config: { include: ["src"], exclude: ["dist"], depth: 3 },
    });
    const sameSemanticConfig = createUaAnalysisIdentity({
      ...base,
      config: { depth: 3, exclude: ["dist"], include: ["src"] },
    });
    const differentConfig = createUaAnalysisIdentity({
      ...base,
      config: { depth: 4, exclude: ["dist"], include: ["src"] },
    });

    expect(sameSemanticConfig).toEqual(first);
    expect(differentConfig.analysisId).not.toBe(first.analysisId);
    expect(differentConfig.configHash).not.toBe(first.configHash);
    expect(first.analysisId).toMatch(/^ua-aaaaaaaa-v2-9-4-zh-full-[a-f0-9]{16}-[a-f0-9]{12}$/);
  });

  it("binds the exact UA engine provenance into analysis identity", () => {
    const base = {
      snapshotId: "git-aaaaaaaaaaaa",
      sourceCommit: "a".repeat(40),
      engineVersion: "2.9.4",
      outputLanguage: "zh",
      engineProvenance: {
        source: "user-skill-local-git" as const,
        revision: "b".repeat(40),
        contentHash: `sha256:${"c".repeat(64)}`,
        dirty: false,
        entryPath: "plugin/skills/understand",
      },
    };
    const first = createUaAnalysisIdentity(base);
    expect(createUaAnalysisIdentity(base)).toEqual(first);
    expect(
      createUaAnalysisIdentity({
        ...base,
        engineProvenance: { ...base.engineProvenance, dirty: true },
      }).analysisId,
    ).not.toBe(first.analysisId);
    expect(
      createUaAnalysisIdentity({
        ...base,
        engineProvenance: {
          ...base.engineProvenance,
          contentHash: `sha256:${"d".repeat(64)}`,
        },
      }).analysisId,
    ).not.toBe(first.analysisId);
    expect(createUaAnalysisIdentity({ ...base, engineProvenance: undefined }).analysisId).not.toBe(
      first.analysisId,
    );
  });

  it("maps output, supports a safe resume, verifies it, and removes the temporary worktree", () => {
    const { studiesRoot, sourceRoot, snapshot } = setup({ externalSymlink: true });
    const sourceStatus = git(sourceRoot, ["status", "--porcelain=v1"]);
    const input = {
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-first-run",
      engineVersion: "2.9.4",
      outputLanguage: "zh",
      engineProvenance: {
        source: "user-skill-local-git" as const,
        revision: "b".repeat(40),
        contentHash: `sha256:${"c".repeat(64)}`,
        dirty: false,
        entryPath: "plugin/skills/understand",
      },
      now: new Date("2026-07-20T00:00:00.000Z"),
    } as const;
    const invocation = prepareUaAnalysis(input);
    const resumed = prepareUaAnalysis({ ...input, now: new Date("2026-07-20T00:00:30.000Z") });
    const paths = getUaAnalysisPaths(studiesRoot, "sample", "ua-first-run");

    expect(resumed.analysis).toEqual(invocation.analysis);
    expect(invocation.analysis.engineProvenance).toEqual(input.engineProvenance);
    expect(readlinkSync(join(invocation.workspace, ".ua"))).toBe(paths.data);
    expect(invocation.environment.UNDERSTAND_NO_WORKTREE_REDIRECT).toBe("1");
    expect(invocation.arguments).toContain("--no-auto-update");
    expect(readFileSync(join(paths.data, ".understandignore"), "utf8")).toContain("/external");
    expect(existsSync(join(invocation.workspace, "external"))).toBe(false);

    writeCompleteUaOutput(paths.data, snapshot.sourceCommit);
    // Key ordering and whitespace do not affect the semantic config binding.
    writeFileSync(
      join(paths.data, "config.json"),
      JSON.stringify({ outputLanguage: "zh", autoUpdate: false }, null, 4),
    );
    const ready = finalizeUaAnalysis(
      studiesRoot,
      "sample",
      "ua-first-run",
      new Date("2026-07-20T00:02:00.000Z"),
    );

    expect(ready.status).toBe("ready");
    if (ready.status === "ready") {
      expect(ready.nodeCount).toBe(1);
      expect(ready.edgeCount).toBe(0);
      expect(ready.graphHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(ready.completedAt).toBe("2026-07-20T00:02:00.000Z");
    }
    expect(existsSync(paths.workspace)).toBe(false);
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(sourceStatus);
  });

  it("refuses to resume when UA engine provenance changes", () => {
    const { studiesRoot, snapshot } = setup();
    const base = {
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-provenance-resume",
      engineVersion: "2.9.4",
      outputLanguage: "zh",
      engineProvenance: {
        source: "user-skill-local-git" as const,
        revision: "b".repeat(40),
        contentHash: `sha256:${"c".repeat(64)}`,
        dirty: false,
        entryPath: "plugin/skills/understand",
      },
    };
    prepareUaAnalysis(base);
    expect(() =>
      prepareUaAnalysis({
        ...base,
        engineProvenance: { ...base.engineProvenance, dirty: true },
      }),
    ).toThrow(/engineProvenance/);
  });

  it.each([
    ["graph", { graphCommit: "0".repeat(40) }],
    ["meta", { metaCommit: "0".repeat(40) }],
    ["fingerprints", { fingerprintsCommit: "0".repeat(40) }],
  ])("refuses a mismatched %s commit and fail cleans the worktree", (_label, overrides) => {
    const { studiesRoot, snapshot } = setup();
    prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-bad-run",
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const paths = getUaAnalysisPaths(studiesRoot, "sample", "ua-bad-run");
    writeCompleteUaOutput(paths.data, snapshot.sourceCommit, overrides);

    expect(() => finalizeUaAnalysis(studiesRoot, "sample", "ua-bad-run")).toThrow(
      /commit does not match/,
    );
    const failed = failUaAnalysis(
      studiesRoot,
      "sample",
      "ua-bad-run",
      "commit mismatch",
      new Date("2026-07-20T00:02:00.000Z"),
    );
    expect(failed.status).toBe("failed");
    expect(existsSync(paths.workspace)).toBe(false);
  });

  it("refuses stale output timestamps and a changed semantic config", () => {
    const first = setup();
    prepareUaAnalysis({
      studiesRoot: first.studiesRoot,
      studyId: "sample",
      snapshotId: first.snapshot.id,
      analysisId: "ua-stale-run",
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const firstPaths = getUaAnalysisPaths(first.studiesRoot, "sample", "ua-stale-run");
    writeCompleteUaOutput(firstPaths.data, first.snapshot.sourceCommit, {
      analyzedAt: "2026-07-19T23:59:59.000Z",
    });
    expect(() => finalizeUaAnalysis(first.studiesRoot, "sample", "ua-stale-run")).toThrow(
      /predates this analysis/,
    );
    failUaAnalysis(first.studiesRoot, "sample", "ua-stale-run", "stale output");

    const second = setup();
    prepareUaAnalysis({
      studiesRoot: second.studiesRoot,
      studyId: "sample",
      snapshotId: second.snapshot.id,
      analysisId: "ua-config-run",
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const secondPaths = getUaAnalysisPaths(second.studiesRoot, "sample", "ua-config-run");
    writeCompleteUaOutput(secondPaths.data, second.snapshot.sourceCommit);
    writeFileSync(
      join(secondPaths.data, "config.json"),
      JSON.stringify({ outputLanguage: "fr", autoUpdate: false }),
    );
    expect(() => finalizeUaAnalysis(second.studiesRoot, "sample", "ua-config-run")).toThrow(
      /semantic config hash/,
    );
    failUaAnalysis(second.studiesRoot, "sample", "ua-config-run", "config mismatch");
  });

  it.each([
    [
      "missing layer coverage",
      (graph: Record<string, unknown>) => {
        graph.layers = [
          { id: "application", name: "Application", description: "Files", nodeIds: [] },
        ];
      },
      /missing from architecture layers/,
    ],
    [
      "dangling Tour reference",
      (graph: Record<string, unknown>) => {
        graph.tour = [
          { order: 1, title: "Start", description: "Start here", nodeIds: ["missing"] },
        ];
      },
      /Tour references a missing node/,
    ],
  ])("refuses a structurally incomplete graph: %s", (_label, mutate, expected) => {
    const { studiesRoot, snapshot } = setup();
    prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-structure-run",
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const paths = getUaAnalysisPaths(studiesRoot, "sample", "ua-structure-run");
    writeCompleteUaOutput(paths.data, snapshot.sourceCommit);
    const graph = JSON.parse(
      readFileSync(join(paths.data, "knowledge-graph.json"), "utf8"),
    ) as Record<string, unknown>;
    mutate(graph);
    writeFileSync(join(paths.data, "knowledge-graph.json"), JSON.stringify(graph));

    expect(() => finalizeUaAnalysis(studiesRoot, "sample", "ua-structure-run")).toThrow(expected);
    failUaAnalysis(studiesRoot, "sample", "ua-structure-run", "incomplete graph");
  });

  it("records preparation failure and removes a worktree that cannot map .ua safely", () => {
    const container = mkdtempSync(join(tmpdir(), "university-local-ua-conflict-"));
    const studiesRoot = join(container, "studies");
    const sourceRoot = join(container, "source");
    execFileSync("git", ["init", "-q", sourceRoot]);
    git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
    git(sourceRoot, ["config", "user.email", "test@university.local"]);
    execFileSync("mkdir", [join(sourceRoot, ".ua")]);
    writeFileSync(join(sourceRoot, ".ua", "tracked.txt"), "source-owned\n");
    git(sourceRoot, ["add", ".ua/tracked.txt"]);
    git(sourceRoot, ["commit", "-q", "-m", "Track UA path"]);
    createStudy(studiesRoot, { id: "sample", title: "Sample" });
    registerLocalGitSource(studiesRoot, "sample", sourceRoot);
    const snapshot = createCleanSnapshot(studiesRoot, "sample");
    const paths = getUaAnalysisPaths(studiesRoot, "sample", "ua-conflict-run");

    expect(() =>
      prepareUaAnalysis({
        studiesRoot,
        studyId: "sample",
        snapshotId: snapshot.id,
        analysisId: "ua-conflict-run",
        engineVersion: "2.9.4",
        outputLanguage: "en",
      }),
    ).toThrow(/tracked \.ua path/);
    expect(existsSync(paths.workspace)).toBe(false);
    expect(JSON.parse(readFileSync(paths.manifest, "utf8"))).toMatchObject({
      status: "failed",
      failure: expect.stringMatching(/tracked \.ua path/),
    });
  });
});
