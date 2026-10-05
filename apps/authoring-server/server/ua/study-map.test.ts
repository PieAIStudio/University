import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getUaAnalysisPaths } from "../studies/paths.js";
import { resolveEvidenceUa } from "./study-map.js";

const COMMIT_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COMMIT_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function writeReadyAnalysis(
  studiesRoot: string,
  studyId: string,
  analysis: {
    readonly id: string;
    readonly sourceCommit: string;
    readonly completedAt: string;
    readonly nodes: readonly Record<string, unknown>[];
    readonly layers?: readonly Record<string, unknown>[];
  },
) {
  const paths = getUaAnalysisPaths(studiesRoot, studyId, analysis.id);
  mkdirSync(paths.data, { recursive: true });
  writeFileSync(
    paths.manifest,
    JSON.stringify({
      schemaVersion: 1,
      id: analysis.id,
      engine: "understand-anything",
      engineVersion: "2.9.4",
      snapshotId: "git-aaaaaaaaaaaa",
      sourceCommit: analysis.sourceCommit,
      outputLanguage: "zh",
      configHash: HASH,
      createdAt: "2026-08-01T00:00:00.000Z",
      status: "ready",
      graphHash: HASH,
      nodeCount: analysis.nodes.length,
      edgeCount: 0,
      completedAt: analysis.completedAt,
    }),
  );
  writeFileSync(
    join(paths.data, "knowledge-graph.json"),
    JSON.stringify({
      nodes: analysis.nodes,
      layers: analysis.layers ?? [],
    }),
  );
}

describe("resolveEvidenceUa", () => {
  it("prefers the ready analysis that matches the citation commit", () => {
    const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-study-map-"));
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-newer-other-commit",
      sourceCommit: COMMIT_B,
      completedAt: "2026-08-10T00:00:00.000Z",
      nodes: [
        {
          id: "file:readme.md",
          type: "file",
          filePath: "README.md",
          name: "wrong",
          summary: "newer commit",
        },
      ],
      layers: [{ id: "later", name: "Later layer", nodeIds: ["file:readme.md"] }],
    });
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-older-matching",
      sourceCommit: COMMIT_A,
      completedAt: "2026-08-01T00:00:00.000Z",
      nodes: [
        {
          id: "document:README.md",
          type: "document",
          filePath: "README.md",
          name: "README.md",
          summary: "matching snapshot",
        },
        {
          id: "function:README.md:badge",
          type: "function",
          filePath: "README.md",
          name: "badge",
          summary: "too small",
        },
      ],
      layers: [{ id: "docs", name: "文档与设计", nodeIds: ["document:README.md"] }],
    });

    const [place] = resolveEvidenceUa(studiesRoot, "sample", [
      { sourceCommit: COMMIT_A, sourcePath: "README.md" },
    ]);

    expect(place).toMatchObject({
      analysisId: "ua-older-matching",
      nodeId: "document:README.md",
      layerName: "文档与设计",
      summary: "matching snapshot",
    });
  });

  it("uses a bound node id when the author already picked one", () => {
    const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-study-map-"));
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-bound-nodes",
      sourceCommit: COMMIT_A,
      completedAt: "2026-08-01T00:00:00.000Z",
      nodes: [
        {
          id: "file:src/main.tsx",
          type: "file",
          filePath: "src/main.tsx",
          name: "main.tsx",
          summary: "file",
        },
        {
          id: "function:src/main.tsx:bootstrap",
          type: "function",
          filePath: "src/main.tsx",
          name: "bootstrap",
          summary: "boot",
        },
      ],
    });

    const [place] = resolveEvidenceUa(studiesRoot, "sample", [
      {
        sourceCommit: COMMIT_A,
        sourcePath: "src/main.tsx",
        nodeIds: ["function:src/main.tsx:bootstrap"],
      },
    ]);

    expect(place?.nodeId).toBe("function:src/main.tsx:bootstrap");
    expect(place?.summary).toBe("boot");
  });

  it("falls back to newest ready when the matching analysis skipped the file", () => {
    const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-study-map-"));
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-matching-sparse",
      sourceCommit: COMMIT_A,
      completedAt: "2026-08-01T00:00:00.000Z",
      nodes: [{ id: "file:other.ts", type: "file", filePath: "other.ts", name: "other.ts" }],
    });
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-newer-complete",
      sourceCommit: COMMIT_B,
      completedAt: "2026-08-10T00:00:00.000Z",
      nodes: [
        {
          id: "file:src/ui/classNames.ts",
          type: "file",
          filePath: "src/ui/classNames.ts",
          name: "classNames.ts",
          summary: "later index",
        },
      ],
      layers: [{ id: "ui", name: "UI 呈现层", nodeIds: ["file:src/ui/classNames.ts"] }],
    });

    const [place] = resolveEvidenceUa(studiesRoot, "sample", [
      { sourceCommit: COMMIT_A, sourcePath: "src/ui/classNames.ts" },
    ]);
    expect(place).toMatchObject({
      analysisId: "ua-newer-complete",
      layerName: "UI 呈现层",
    });
  });

  it("returns null when the file is not on the graph", () => {
    const studiesRoot = mkdtempSync(join(tmpdir(), "university-local-study-map-"));
    writeReadyAnalysis(studiesRoot, "sample", {
      id: "ua-no-match",
      sourceCommit: COMMIT_A,
      completedAt: "2026-08-01T00:00:00.000Z",
      nodes: [{ id: "file:app.ts", type: "file", filePath: "app.ts", name: "app.ts" }],
    });

    expect(
      resolveEvidenceUa(studiesRoot, "sample", [
        { sourceCommit: COMMIT_A, sourcePath: "missing.ts" },
      ]),
    ).toEqual([null]);
  });
});
