import { describe, expect, it } from "vitest";

import { evidenceUaLayers, type EvidenceView } from "./lesson-view.js";

function ref(layer: string | null): EvidenceView {
  return {
    kind: "fact",
    sourcePath: "a.ts",
    lineStart: 1,
    lineEnd: 1,
    sourceCommit: "a".repeat(40),
    nodeIds: [],
    note: null,
    ua: layer ? { nodeId: "file:a.ts", name: "a.ts", summary: "", layerName: layer } : null,
  };
}

describe("evidenceUaLayers", () => {
  it("keeps first-seen layer order and skips gaps", () => {
    expect(
      evidenceUaLayers([ref("文档与设计"), ref(null), ref("文档与设计"), ref("应用核心层")]),
    ).toEqual(["文档与设计", "应用核心层"]);
  });
});
