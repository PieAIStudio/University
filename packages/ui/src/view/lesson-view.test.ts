import { describe, expect, it } from "vitest";

import { evidenceUaLayers, readingSections, type EvidenceView } from "./lesson-view.js";

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

describe("readingSections", () => {
  const prose = [
    "# 会使用 App 和会开发 App，差在哪儿？",
    "",
    "## 先把“使用 App”和“开发 App”分开",
    "",
    "## 先猜一下",
    "",
    "## 答案",
    "",
    "## 把“会使用”和“会开发”逐项放在一起看",
    "",
    "## 只想使用 App，和要修改 App，分别该看什么？",
    "",
    "## 再想想",
    "",
    "## 自检",
    "",
    "## 一句话",
  ].join("\n");

  it("counts ## headings when the manifest listed none", () => {
    const sections = readingSections([], prose);
    expect(sections).toHaveLength(8);
    expect(sections.map((section) => section.title)).toEqual([
      "先把“使用 App”和“开发 App”分开",
      "先猜一下",
      "答案",
      "把“会使用”和“会开发”逐项放在一起看",
      "只想使用 App，和要修改 App，分别该看什么？",
      "再想想",
      "自检",
      "一句话",
    ]);
  });

  it("keeps authored sections when they exist rather than re-deriving", () => {
    const authored = [{ id: "ask", title: "先猜一下" }];
    expect(readingSections(authored, prose)).toEqual(authored);
  });
});
