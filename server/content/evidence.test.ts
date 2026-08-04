import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference } from "../../src/domain/schemas.js";
import { getSnapshotPaths, getUaAnalysisPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot, refreshStudyRepository } from "../studies/snapshots.js";
import { finalizeUaAnalysis, prepareUaAnalysis, retireUaAnalysis } from "../ua/adapter.js";
import {
  EVIDENCE_SNIPPET_LIMITS,
  evaluateEvidenceFreshness,
  readEvidenceSnippet,
  validateEvidence,
} from "./evidence.js";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-evidence-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  execFileSync("mkdir", [join(sourceRoot, "folder")]);
  writeFileSync(join(sourceRoot, "folder", "auth.ts"), "export const owner = 'session';\n");
  writeFileSync(join(sourceRoot, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  symlinkSync("folder/auth.ts", join(sourceRoot, "auth-link"));
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "folder/auth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  return { container, studiesRoot, sourceRoot, snapshot, evidence };
}

describe("Git-object evidence", () => {
  it("returns bounded context from the immutable commit rather than the live checkout", () => {
    const { studiesRoot, sourceRoot, snapshot } = setup();
    const original = Array.from(
      { length: 12 },
      (_, index) => `export const line${index + 1} = ${index + 1};`,
    ).join("\n");
    writeFileSync(join(sourceRoot, "snippet.ts"), `${original}\n`);
    git(sourceRoot, ["add", "snippet.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Add snippet"]);
    const snippetSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const reference: EvidenceReference = {
      kind: "fact",
      snapshotId: snippetSnapshot.id,
      sourceCommit: snippetSnapshot.sourceCommit,
      sourcePath: "snippet.ts",
      lineStart: 6,
      lineEnd: 7,
      nodeIds: [],
    };

    writeFileSync(join(sourceRoot, "snippet.ts"), "export const replaced = true;\n");
    const result = readEvidenceSnippet(studiesRoot, "sample", reference, 2);

    expect(result).toEqual({
      sourcePath: "snippet.ts",
      sourceCommit: snippetSnapshot.sourceCommit,
      startLine: 4,
      endLine: 9,
      highlightStartLine: 6,
      highlightEndLine: 7,
      language: "typescript",
      code: original.split("\n").slice(3, 9).join("\n"),
    });
    expect(result.code).not.toContain("replaced");
    expect(snapshot.sourceCommit).not.toBe(snippetSnapshot.sourceCommit);
  });

  it("enforces source, response, context, and line-count bounds", () => {
    const { studiesRoot, sourceRoot } = setup();
    writeFileSync(
      join(sourceRoot, "many-lines.ts"),
      `${Array.from({ length: 170 }, (_, index) => `const value${index} = ${index};`).join("\n")}\n`,
    );
    writeFileSync(join(sourceRoot, "wide.ts"), `// ${"x".repeat(70 * 1024)}\n`);
    writeFileSync(
      join(sourceRoot, "oversize.ts"),
      Buffer.alloc(EVIDENCE_SNIPPET_LIMITS.maxSourceBytes + 1, 0x61),
    );
    git(sourceRoot, ["add", "many-lines.ts", "wide.ts", "oversize.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Add bounded evidence fixtures"]);
    const snapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const reference = (sourcePath: string): EvidenceReference => ({
      kind: "fact",
      snapshotId: snapshot.id,
      sourceCommit: snapshot.sourceCommit,
      sourcePath,
      nodeIds: [],
    });

    expect(() => readEvidenceSnippet(studiesRoot, "sample", reference("many-lines.ts"))).toThrow(
      /cite a narrower range/,
    );
    expect(() =>
      readEvidenceSnippet(studiesRoot, "sample", {
        ...reference("many-lines.ts"),
        lineStart: 1,
        lineEnd: 121,
      }),
    ).toThrow(/120-line display limit/);
    expect(() =>
      readEvidenceSnippet(
        studiesRoot,
        "sample",
        { ...reference("many-lines.ts"), lineStart: 80, lineEnd: 80 },
        EVIDENCE_SNIPPET_LIMITS.maxContextLines + 1,
      ),
    ).toThrow(/context must be between/);
    expect(() => readEvidenceSnippet(studiesRoot, "sample", reference("wide.ts"))).toThrow(
      /byte response limit/,
    );
    expect(() => readEvidenceSnippet(studiesRoot, "sample", reference("oversize.ts"))).toThrow(
      /byte display limit/,
    );
  });

  it("rejects binary content even when approved evidence has no line range", () => {
    const { studiesRoot, evidence } = setup();
    expect(() =>
      readEvidenceSnippet(studiesRoot, "sample", {
        ...evidence,
        sourcePath: "binary.bin",
        lineStart: undefined,
        lineEnd: undefined,
      }),
    ).toThrow(/cannot display a binary blob/);
  });

  it("reads regular blobs offline without contacting the registered source", () => {
    const { container, studiesRoot, sourceRoot, evidence } = setup();
    renameSync(sourceRoot, join(container, "source-offline"));

    expect(validateEvidence(studiesRoot, "sample", evidence)).toEqual(evidence);
  });

  it("rejects symlinks, trees, and binary line evidence", () => {
    const { studiesRoot, evidence } = setup();
    expect(() =>
      validateEvidence(studiesRoot, "sample", { ...evidence, sourcePath: "auth-link" }),
    ).toThrow(/regular Git blob/);
    expect(() =>
      validateEvidence(studiesRoot, "sample", { ...evidence, sourcePath: "folder" }),
    ).toThrow(/regular Git blob/);
    expect(() =>
      validateEvidence(studiesRoot, "sample", { ...evidence, sourcePath: "binary.bin" }),
    ).toThrow(/binary blob/);
    expect(() =>
      validateEvidence(studiesRoot, "sample", { ...evidence, lineStart: 2, lineEnd: 2 }),
    ).toThrow(/line range exceeds/);
  });

  it("rejects a gitlink even if a corrupt legacy manifest failed to declare it", () => {
    const { studiesRoot, sourceRoot, evidence } = setup();
    const gitlinkCommit = git(sourceRoot, ["rev-parse", "HEAD"]);
    git(sourceRoot, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${gitlinkCommit},vendor/module`,
    ]);
    git(sourceRoot, ["commit", "-q", "-m", "Add gitlink"]);
    const refreshed = refreshStudyRepository(studiesRoot, "sample", "HEAD");
    const snapshotId = `git-${refreshed.sourceCommit.slice(0, 12)}`;
    writeFileSync(
      getSnapshotPaths(studiesRoot, "sample", snapshotId).manifest,
      `${JSON.stringify({
        schemaVersion: 1,
        id: snapshotId,
        mode: "clean",
        sourceCommit: refreshed.sourceCommit,
        sourceTree: refreshed.sourceTree,
        createdAt: "2026-07-20T00:00:00.000Z",
        status: "ready",
        toolVersion: "legacy-test",
        excludedPaths: [],
        submodulePaths: [],
        lfsPaths: [],
      })}\n`,
    );

    expect(() =>
      validateEvidence(studiesRoot, "sample", {
        ...evidence,
        snapshotId,
        sourceCommit: refreshed.sourceCommit,
        sourcePath: "vendor/module",
      }),
    ).toThrow(/regular Git blob/);
  });

  it("compares immutable blob ids offline for freshness", () => {
    const { container, studiesRoot, sourceRoot, evidence } = setup();
    writeFileSync(join(sourceRoot, "unrelated.ts"), "export const value = 1;\n");
    git(sourceRoot, ["add", "unrelated.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Unrelated"]);
    const unchangedSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    writeFileSync(join(sourceRoot, "folder", "auth.ts"), "export const owner = 'identity';\n");
    git(sourceRoot, ["add", "folder/auth.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Change auth"]);
    const changedSnapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    renameSync(sourceRoot, join(container, "source-offline"));

    expect(
      evaluateEvidenceFreshness(studiesRoot, "sample", evidence, unchangedSnapshot.id),
    ).toEqual({ status: "fresh", reasons: [] });
    expect(evaluateEvidenceFreshness(studiesRoot, "sample", evidence, changedSnapshot.id)).toEqual({
      status: "stale",
      reasons: ["Referenced source changed: folder/auth.ts"],
    });
  });

  it("rehashes a ready UA graph before trusting its nodes", () => {
    const { studiesRoot, snapshot, evidence } = setup();
    const analysisId = "ua-evidence-test";
    const invocation = prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId,
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const generatedAt = "2026-07-20T00:01:00.000Z";
    writeFileSync(
      join(invocation.dataDirectory, "knowledge-graph.json"),
      JSON.stringify({
        project: { gitCommitHash: snapshot.sourceCommit, analyzedAt: generatedAt },
        nodes: [{ id: "file:folder/auth.ts", type: "file", filePath: "folder/auth.ts" }],
        edges: [],
        layers: [
          {
            id: "application",
            name: "Application",
            description: "Application files",
            nodeIds: ["file:folder/auth.ts"],
          },
        ],
        tour: [
          {
            order: 1,
            title: "Authentication",
            description: "Authentication ownership",
            nodeIds: ["file:folder/auth.ts"],
          },
        ],
      }),
    );
    writeFileSync(
      join(invocation.dataDirectory, "meta.json"),
      JSON.stringify({ gitCommitHash: snapshot.sourceCommit, lastAnalyzedAt: generatedAt }),
    );
    writeFileSync(
      join(invocation.dataDirectory, "fingerprints.json"),
      JSON.stringify({
        gitCommitHash: snapshot.sourceCommit,
        generatedAt,
        files: { "folder/auth.ts": { contentHash: "fixture" } },
      }),
    );
    const ready = finalizeUaAnalysis(
      studiesRoot,
      "sample",
      analysisId,
      new Date("2026-07-20T00:02:00.000Z"),
    );
    if (ready.status !== "ready") throw new Error("Expected a ready test analysis");
    const boundEvidence = {
      ...evidence,
      analysisId,
      graphHash: ready.graphHash,
      nodeIds: ["file:folder/auth.ts"],
    };
    expect(validateEvidence(studiesRoot, "sample", boundEvidence)).toEqual(boundEvidence);

    const graphPath = join(
      getUaAnalysisPaths(studiesRoot, "sample", analysisId).data,
      "knowledge-graph.json",
    );
    writeFileSync(graphPath, `${readFileSync(graphPath, "utf8")}\n`);
    expect(() => validateEvidence(studiesRoot, "sample", boundEvidence)).toThrow(
      /immutable graphHash/,
    );
  });

  it("still validates evidence after its bound analysis is superseded", () => {
    const { studiesRoot, snapshot, evidence } = setup();
    const analysisId = "ua-superseded-validate";
    const invocation = prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId,
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const generatedAt = "2026-07-20T00:01:00.000Z";
    writeFileSync(
      join(invocation.dataDirectory, "knowledge-graph.json"),
      JSON.stringify({
        project: { gitCommitHash: snapshot.sourceCommit, analyzedAt: generatedAt },
        nodes: [{ id: "file:folder/auth.ts", type: "file", filePath: "folder/auth.ts" }],
        edges: [],
        layers: [
          {
            id: "application",
            name: "Application",
            description: "Application files",
            nodeIds: ["file:folder/auth.ts"],
          },
        ],
        tour: [
          {
            order: 1,
            title: "Authentication",
            description: "Authentication ownership",
            nodeIds: ["file:folder/auth.ts"],
          },
        ],
      }),
    );
    writeFileSync(
      join(invocation.dataDirectory, "meta.json"),
      JSON.stringify({ gitCommitHash: snapshot.sourceCommit, lastAnalyzedAt: generatedAt }),
    );
    writeFileSync(
      join(invocation.dataDirectory, "fingerprints.json"),
      JSON.stringify({
        gitCommitHash: snapshot.sourceCommit,
        generatedAt,
        files: { "folder/auth.ts": { contentHash: "fixture" } },
      }),
    );
    const ready = finalizeUaAnalysis(
      studiesRoot,
      "sample",
      analysisId,
      new Date("2026-07-20T00:02:00.000Z"),
    );
    if (ready.status !== "ready") throw new Error("Expected a ready test analysis");
    const boundEvidence = {
      ...evidence,
      analysisId,
      graphHash: ready.graphHash,
      nodeIds: ["file:folder/auth.ts"],
    };
    expect(validateEvidence(studiesRoot, "sample", boundEvidence)).toEqual(boundEvidence);

    retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId,
      reason: "quality gate failed",
      now: new Date("2026-07-20T00:03:00.000Z"),
    });
    expect(validateEvidence(studiesRoot, "sample", boundEvidence)).toEqual(boundEvidence);
  });

  it("marks UA-bound evidence stale when the bound analysis is superseded, without throwing", () => {
    const { studiesRoot, snapshot, evidence } = setup();
    const oldAnalysisId = "ua-old-for-freshness";
    const targetAnalysisId = "ua-target-for-freshness";
    for (const analysisId of [oldAnalysisId, targetAnalysisId]) {
      const invocation = prepareUaAnalysis({
        studiesRoot,
        studyId: "sample",
        snapshotId: snapshot.id,
        analysisId,
        engineVersion: "2.9.4",
        outputLanguage: "en",
        now: new Date("2026-07-20T00:00:00.000Z"),
      });
      const generatedAt = "2026-07-20T00:01:00.000Z";
      writeFileSync(
        join(invocation.dataDirectory, "knowledge-graph.json"),
        JSON.stringify({
          project: { gitCommitHash: snapshot.sourceCommit, analyzedAt: generatedAt },
          nodes: [{ id: "file:folder/auth.ts", type: "file", filePath: "folder/auth.ts" }],
          edges: [],
          layers: [
            {
              id: "application",
              name: "Application",
              description: "Application files",
              nodeIds: ["file:folder/auth.ts"],
            },
          ],
          tour: [
            {
              order: 1,
              title: "Authentication",
              description: "Authentication ownership",
              nodeIds: ["file:folder/auth.ts"],
            },
          ],
        }),
      );
      writeFileSync(
        join(invocation.dataDirectory, "meta.json"),
        JSON.stringify({ gitCommitHash: snapshot.sourceCommit, lastAnalyzedAt: generatedAt }),
      );
      writeFileSync(
        join(invocation.dataDirectory, "fingerprints.json"),
        JSON.stringify({
          gitCommitHash: snapshot.sourceCommit,
          generatedAt,
          files: { "folder/auth.ts": { contentHash: "fixture" } },
        }),
      );
      finalizeUaAnalysis(studiesRoot, "sample", analysisId, new Date("2026-07-20T00:02:00.000Z"));
    }
    const oldPaths = getUaAnalysisPaths(studiesRoot, "sample", oldAnalysisId);
    const oldReady = JSON.parse(readFileSync(oldPaths.manifest, "utf8")) as {
      graphHash: string;
    };
    const boundEvidence = {
      ...evidence,
      analysisId: oldAnalysisId,
      graphHash: oldReady.graphHash,
      nodeIds: ["file:folder/auth.ts"],
    };

    retireUaAnalysis({
      studiesRoot,
      studyId: "sample",
      analysisId: oldAnalysisId,
      reason: "replaced by better analysis",
      now: new Date("2026-07-20T00:03:00.000Z"),
    });

    const freshness = evaluateEvidenceFreshness(
      studiesRoot,
      "sample",
      boundEvidence,
      snapshot.id,
      targetAnalysisId,
    );
    expect(freshness.status).toBe("stale");
    expect(freshness.reasons.some((reason) => /superseded/i.test(reason))).toBe(true);
  });

  it("still throws when the bound analysis is preparing", () => {
    const { studiesRoot, snapshot, evidence } = setup();
    const analysisId = "ua-preparing-bound";
    prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId,
      engineVersion: "2.9.4",
      outputLanguage: "en",
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const preparingEvidence = {
      ...evidence,
      analysisId,
      graphHash: `sha256:${"a".repeat(64)}`,
      nodeIds: ["file:folder/auth.ts"],
    };
    expect(() => validateEvidence(studiesRoot, "sample", preparingEvidence)).toThrow(
      /not ready or does not match/,
    );
    expect(() =>
      evaluateEvidenceFreshness(studiesRoot, "sample", preparingEvidence, snapshot.id, analysisId),
    ).toThrow(/not ready or does not match|not ready/);
  });
});
