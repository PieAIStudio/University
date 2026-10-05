import { describe, expect, it } from "vitest";

import {
  batchIndexFromOutputFilename,
  extractSummarySkeleton,
  fileLevelTypes,
  inspectUaBatchProgress,
  inspectUaQuality,
  type UaFingerprints,
  type UaGraph,
  type UaQualityGraphNode,
} from "./quality.js";

function fileNode(path: string, type = "file") {
  return { id: `${type}:${path}`, type, filePath: path, summary: `File ${path}` };
}

function functionNode(path: string, name: string, summary: string) {
  return {
    id: `function:${path}:${name}`,
    type: "function" as const,
    filePath: path,
    name,
    summary,
  };
}

function classNode(path: string, name: string, summary: string) {
  return {
    id: `class:${path}:${name}`,
    type: "class" as const,
    filePath: path,
    name,
    summary,
  };
}

function graph(nodes: UaGraph["nodes"]): UaGraph {
  return { nodes };
}

function fingerprints(paths: readonly string[]): UaFingerprints {
  return { files: Object.fromEntries(paths.map((path) => [path, { hash: path }])) };
}

function manyFunctions(count: number, summaryFor: (index: number) => string) {
  return Array.from({ length: count }, (_, index) =>
    functionNode(`src/f${index}.ts`, `fn${index}`, summaryFor(index)),
  );
}

describe("UA quality gates", () => {
  it("exports the shared file-level type set used by the adapter", () => {
    expect(fileLevelTypes.has("file")).toBe(true);
    expect(fileLevelTypes.has("endpoint")).toBe(true);
    expect(fileLevelTypes.has("function")).toBe(false);
  });

  it("passes when top-level file nodes exactly match fingerprints", () => {
    const paths = ["a.ts", "b.ts", "docs/readme.md"];
    const report = inspectUaQuality({
      graph: graph([
        fileNode("a.ts"),
        fileNode("b.ts"),
        fileNode("docs/readme.md", "document"),
        functionNode("a.ts", "run", "run does unique work with widgets"),
      ]),
      fingerprints: fingerprints(paths),
    });
    expect(report.failures).toEqual([]);
    expect(report.coverage).toEqual({ missingFromGraph: [], missingFromFingerprints: [] });
  });

  it("fails when the graph is missing fingerprint files", () => {
    const report = inspectUaQuality({
      graph: graph([fileNode("kept.ts")]),
      fingerprints: fingerprints(["kept.ts", "missing.ts", "also-missing.ts"]),
    });
    expect(report.coverage.missingFromGraph).toEqual(["also-missing.ts", "missing.ts"]);
    expect(report.coverage.missingFromFingerprints).toEqual([]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/missing from the graph/);
    expect(report.failures[0]).toMatch(/missing\.ts/);
  });

  it("fails when the graph has top-level files absent from fingerprints", () => {
    const report = inspectUaQuality({
      graph: graph([fileNode("kept.ts"), fileNode("extra.ts"), fileNode("cfg.json", "config")]),
      fingerprints: fingerprints(["kept.ts"]),
    });
    expect(report.coverage.missingFromFingerprints).toEqual(["cfg.json", "extra.ts"]);
    expect(report.coverage.missingFromGraph).toEqual([]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/missing from fingerprints/);
  });

  it("ignores non-top-level file-typed nodes when checking coverage", () => {
    const report = inspectUaQuality({
      graph: graph([
        fileNode("a.ts"),
        // Nested id shape — not a top-level file node.
        { id: "file:a.ts:extra", type: "file", filePath: "a.ts" },
      ]),
      fingerprints: fingerprints(["a.ts"]),
    });
    expect(report.failures).toEqual([]);
  });

  it("fails when function/class summaries collapse onto few skeletons", () => {
    const template =
      "This function processes the data in path/to/file.ts using HelperName and returns ResultType.";
    const nodes = manyFunctions(25, () => template);
    const report = inspectUaQuality({
      graph: graph([...nodes, fileNode("src/f0.ts")]),
      fingerprints: fingerprints(["src/f0.ts"]),
    });
    expect(report.templateCollapse.sampleSize).toBe(25);
    expect(report.templateCollapse.distinctSkeletons).toBe(1);
    expect(report.templateCollapse.duplicateRatio).toBe(1);
    expect(report.failures.some((failure) => /template collapse/i.test(failure))).toBe(true);
    expect(report.failures.find((failure) => /template collapse/i.test(failure))).toMatch(/×25/);
  });

  it("passes when function/class summaries all have distinct skeletons", () => {
    // Code-like tokens are stripped; uniqueness must live in prose (here Chinese).
    const nodes = manyFunctions(
      25,
      (index) => `${"甲".repeat(index + 1)}职责：完成与序号绑定的业务校验。`,
    );
    const report = inspectUaQuality({
      graph: graph(nodes),
      fingerprints: fingerprints([]),
    });
    expect(report.templateCollapse.sampleSize).toBe(25);
    expect(report.templateCollapse.distinctSkeletons).toBe(25);
    expect(report.templateCollapse.duplicateRatio).toBe(0);
    expect(report.failures).toEqual([]);
  });

  it("passes when English function summaries have distinct prose skeletons", () => {
    // Regression: stripping all ASCII falsely collapsed healthy English to ~2 skeletons.
    const labels = [
      "alpha",
      "bravo",
      "charlie",
      "delta",
      "echo",
      "foxtrot",
      "golf",
      "hotel",
      "india",
      "juliet",
      "kilo",
      "lima",
      "mike",
      "november",
      "oscar",
      "papa",
      "quebec",
      "romeo",
      "sierra",
      "tango",
      "uniform",
      "victor",
      "whiskey",
      "xray",
      "yankee",
    ];
    const nodes = manyFunctions(
      25,
      (index) => `Validates the ${labels[index]} payload before writing durable state.`,
    );
    const report = inspectUaQuality({
      graph: graph(nodes),
      fingerprints: fingerprints([]),
    });
    expect(report.templateCollapse.sampleSize).toBe(25);
    expect(report.templateCollapse.distinctSkeletons).toBe(25);
    expect(report.templateCollapse.duplicateRatio).toBe(0);
    expect(report.failures.some((failure) => /template collapse/i.test(failure))).toBe(false);
  });

  it("fails when English summaries only differ by code-like identifiers", () => {
    const nodes = manyFunctions(
      25,
      (index) =>
        `This function processes the data in src/file${index}.ts using HelperName${index} and returns ResultType.`,
    );
    const report = inspectUaQuality({
      graph: graph(nodes),
      fingerprints: fingerprints([]),
    });
    expect(report.templateCollapse.sampleSize).toBe(25);
    expect(report.templateCollapse.distinctSkeletons).toBe(1);
    expect(report.templateCollapse.duplicateRatio).toBe(1);
    expect(report.failures.some((failure) => /template collapse/i.test(failure))).toBe(true);
  });

  it("does not fail on high duplicate ratio when sampleSize is below 20", () => {
    const template = "Shared template body without unique meaning.";
    const nodes = [
      ...manyFunctions(10, () => template),
      ...Array.from({ length: 5 }, (_, index) =>
        classNode(`src/c${index}.ts`, `C${index}`, template),
      ),
    ];
    const report = inspectUaQuality({
      graph: graph(nodes),
      fingerprints: fingerprints([]),
    });
    expect(report.templateCollapse.sampleSize).toBe(15);
    expect(report.templateCollapse.duplicateRatio).toBe(1);
    expect(report.failures).toEqual([]);
  });

  it("truncates missing-path lists after 20 entries", () => {
    const missing = Array.from(
      { length: 25 },
      (_, index) => `path/file-${String(index).padStart(2, "0")}.ts`,
    );
    const report = inspectUaQuality({
      graph: graph([]),
      fingerprints: fingerprints(missing),
    });
    expect(report.coverage.missingFromGraph).toHaveLength(25);
    expect(report.failures).toHaveLength(1);
    const message = report.failures[0]!;
    expect(message).toMatch(/…还有 5 个/);
    // First 20 sorted paths appear; the 21st+ are only in the remainder count.
    expect(message).toContain("path/file-00.ts");
    expect(message).toContain("path/file-19.ts");
    expect(message).not.toContain("path/file-20.ts");
  });

  it("keeps ordinary prose words and strips only code-like tokens", () => {
    expect(extractSummarySkeleton("handles the request and returns a result")).toBe(
      "handlestherequestandreturnsaresult",
    );
    expect(extractSummarySkeleton("处理 services/ai/x.ts 中的请求并返回结果")).toBe(
      "处理中的请求并返回结果",
    );
    // Digits
    expect(extractSummarySkeleton("reads file2 then exits")).toBe("readsthenexits");
    expect(extractSummarySkeleton("uses 3.05 as threshold")).toBe("usesasthreshold");
    // Underscore or slash
    expect(extractSummarySkeleton("calls snake_case helper")).toBe("callshelper");
    expect(extractSummarySkeleton("opens src/foo.ts safely")).toBe("openssafely");
    // CamelCase boundary
    expect(extractSummarySkeleton("runs findNearestOpenSeat once")).toBe("runsonce");
    // ALL-CAPS constants (length >= 2)
    expect(extractSummarySkeleton("checks TABLE_SEATS limit")).toBe("checkslimit");
    expect(extractSummarySkeleton("flags XZ mode")).toBe("flagsmode");
    // Dotted member access
    expect(extractSummarySkeleton("reads performance.memory value")).toBe("readsvalue");
    // Kebab-case
    expect(extractSummarySkeleton("enters portal-entry path")).toBe("enterspath");
  });
});

describe("UA batch progress gates", () => {
  function outputs(
    entries: ReadonlyArray<readonly [number, readonly UaQualityGraphNode[]]>,
  ): Map<number, readonly UaQualityGraphNode[]> {
    return new Map(entries);
  }

  it("marks every batch pending with no failures when nothing is produced yet", () => {
    const report = inspectUaBatchProgress({
      batches: [{ files: ["a.ts"] }, { files: ["b.ts", "c.ts"] }, { files: ["d.ts"] }],
      outputsByBatchIndex: outputs([]),
    });
    expect(report.totalBatches).toBe(3);
    expect(report.producedBatches).toBe(0);
    expect(report.plannedFileCount).toBe(4);
    expect(report.coveredFileCount).toBe(0);
    expect(report.batches.every((batch) => batch.status === "pending")).toBe(true);
    expect(report.failures).toEqual([]);
  });

  it("marks a fully covered produced batch complete and leaves the rest pending", () => {
    const report = inspectUaBatchProgress({
      batches: [{ files: ["a.ts", "b.ts"] }, { files: ["c.ts"] }],
      outputsByBatchIndex: outputs([
        [1, [fileNode("a.ts"), fileNode("b.ts"), functionNode("a.ts", "run", "unique work")]],
      ]),
    });
    expect(report.producedBatches).toBe(1);
    expect(report.batches[0]).toMatchObject({
      batchIndex: 1,
      status: "complete",
      plannedFiles: 2,
      producedFiles: 2,
      missingFiles: [],
    });
    expect(report.batches[1]).toMatchObject({ batchIndex: 2, status: "pending" });
    expect(report.coveredFileCount).toBe(2);
    expect(report.failures).toEqual([]);
  });

  it("marks a produced batch incomplete and records missing planned paths", () => {
    const report = inspectUaBatchProgress({
      batches: [{ files: ["kept.ts", "missing.ts", "also-missing.ts"] }],
      outputsByBatchIndex: outputs([[1, [fileNode("kept.ts")]]]),
    });
    expect(report.batches[0]).toMatchObject({
      status: "incomplete",
      plannedFiles: 3,
      producedFiles: 1,
    });
    expect(report.batches[0]!.missingFiles).toEqual(["missing.ts", "also-missing.ts"]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/batch 1 incomplete/);
    expect(report.failures[0]).toMatch(/missing\.ts/);
    expect(report.failures[0]).toMatch(/also-missing\.ts/);
    expect(report.coveredFileCount).toBe(1);
  });

  it("merges multiple part outputs for the same batch index before judging coverage", () => {
    const report = inspectUaBatchProgress({
      batches: [{ files: ["a.ts", "b.ts"] }],
      outputsByBatchIndex: outputs([
        // Simulates merging batch-1-part-1.json and batch-1-part-2.json upstream.
        [1, [fileNode("a.ts"), fileNode("b.ts")]],
      ]),
    });
    expect(report.batches[0]!.status).toBe("complete");
    expect(report.failures).toEqual([]);
  });

  it("fails when function/class summaries across produced batches collapse templates", () => {
    const template =
      "This function processes the data in path/to/file.ts using HelperName and returns ResultType.";
    const nodes = manyFunctions(25, () => template);
    const report = inspectUaBatchProgress({
      batches: [
        { files: ["src/f0.ts"] },
        { files: Array.from({ length: 24 }, (_, index) => `src/f${index + 1}.ts`) },
      ],
      outputsByBatchIndex: outputs([
        [1, [fileNode("src/f0.ts"), ...nodes.slice(0, 10)]],
        [
          2,
          [
            ...nodes.slice(10),
            ...Array.from({ length: 24 }, (_, i) => fileNode(`src/f${i + 1}.ts`)),
          ],
        ],
      ]),
    });
    expect(report.templateCollapse.sampleSize).toBe(25);
    expect(report.templateCollapse.duplicateRatio).toBe(1);
    expect(report.failures.some((failure) => /template collapse/i.test(failure))).toBe(true);
  });

  it("reads planned files when batches.json elements are plain string arrays", () => {
    const report = inspectUaBatchProgress({
      batches: [["a.ts", "b.ts"], ["c.ts"]],
      outputsByBatchIndex: outputs([[1, [fileNode("a.ts"), fileNode("b.ts")]]]),
    });
    expect(report.batches[0]).toMatchObject({
      status: "complete",
      plannedFiles: 2,
    });
    expect(report.batches[1]!.status).toBe("pending");
    expect(report.plannedFileCount).toBe(3);
    expect(report.failures).toEqual([]);
  });

  it("ignores intermediate filenames that do not match batch-<i> patterns", () => {
    expect(batchIndexFromOutputFilename("batch-1.json")).toBe(1);
    expect(batchIndexFromOutputFilename("batch-12-part-3.json")).toBe(12);
    expect(batchIndexFromOutputFilename("batch-0.json")).toBeNull();
    expect(batchIndexFromOutputFilename("batches.json")).toBeNull();
    expect(batchIndexFromOutputFilename("scan-result.json")).toBeNull();
    expect(batchIndexFromOutputFilename("batch-1.txt")).toBeNull();
    expect(batchIndexFromOutputFilename("batch-1-extra.json")).toBeNull();
    expect(batchIndexFromOutputFilename("notes-batch-1.json")).toBeNull();
  });
});
