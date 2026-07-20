import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getUaAnalysisPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { importLegacyUaAnalysis } from "./import-legacy.js";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

describe("legacy UA import", () => {
  it("copies only durable allowlisted artifacts and binds them to a snapshot", () => {
    const container = mkdtempSync(join(tmpdir(), "university-local-legacy-"));
    const studiesRoot = join(container, "studies");
    const sourceRoot = join(container, "source");
    execFileSync("git", ["init", "-q", sourceRoot]);
    git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
    git(sourceRoot, ["config", "user.email", "test@university.local"]);
    writeFileSync(join(sourceRoot, "app.ts"), "export const app = true;\n");
    git(sourceRoot, ["add", "app.ts"]);
    git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
    const commit = git(sourceRoot, ["rev-parse", "HEAD"]);
    const legacy = join(sourceRoot, ".ua");
    mkdirSync(join(legacy, "intermediate"), { recursive: true });
    mkdirSync(join(legacy, ".trash-old"));
    writeFileSync(join(legacy, "knowledge-graph.json"), '{"nodes":[{"id":"app"}],"edges":[]}');
    writeFileSync(
      join(legacy, "meta.json"),
      JSON.stringify({ gitCommitHash: commit, lastAnalyzedAt: "2026-07-19T00:00:00.000Z" }),
    );
    writeFileSync(join(legacy, "fingerprints.json"), "{}");
    writeFileSync(join(legacy, "config.json"), '{"outputLanguage":"zh"}');
    writeFileSync(join(legacy, "intermediate", "scan-result.json"), "{}");
    writeFileSync(join(legacy, ".trash-old", "scratch.json"), "{}");

    createStudy(studiesRoot, { id: "sample", title: "Sample" });
    registerLocalGitSource(studiesRoot, "sample", sourceRoot);
    const snapshot = createCleanSnapshot(studiesRoot, "sample");
    const imported = importLegacyUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-legacy-first",
      sourceUaDirectory: legacy,
      engineVersion: "2.9.4",
    });
    const target = getUaAnalysisPaths(studiesRoot, "sample", "ua-legacy-first");

    expect(imported).toMatchObject({
      status: "legacy-import",
      sourceCommit: commit,
      outputLanguage: "zh",
      nodeCount: 1,
      edgeCount: 0,
    });
    expect(existsSync(join(target.data, "intermediate", "scan-result.json"))).toBe(true);
    expect(existsSync(join(target.data, ".trash-old"))).toBe(false);
  });
});
