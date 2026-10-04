import { describe, expect, it } from "vitest";
import { checkConnections, traceConnectionProbe } from "./connect.js";
import type { ConnectActivity } from "./types.js";

const graph = {
  id: "route",
  kind: "connect",
  title: "顺着名字找文件",
  brief: "把画面和文件连起来。",
  goal: "找到对应文件。",
  takeaway: "先看画面，再顺着名字找。",
  hint: "从画面上的名字开始。",
  source: { label: "测试资料", url: "https://example.com/source" },
  nodes: [
    { id: "click", label: "点击处", note: "点击处", x: 0, y: 0 },
    { id: "request", label: "请求", note: "请求", x: 1, y: 0 },
    { id: "success", label: "成功", note: "成功", x: 2, y: 0 },
    { id: "error", label: "失败", note: "失败", x: 2, y: 1 },
  ],
  probes: [{ label: "从点击到结果", path: ["click", "request", "success"] }],
  edges: [
    { from: "click", to: "request", why: "" },
    { from: "request", to: "success", why: "" },
    { from: "request", to: "error", why: "" },
  ],
} satisfies ConnectActivity;

describe("causal connections", () => {
  it("accepts any order of construction and requires both outcome branches", () => {
    expect(checkConnections(graph, [...graph.edges].reverse()).passed).toBe(true);
    expect(checkConnections(graph, graph.edges.slice(0, 2)).missing[0]?.to).toBe("error");
  });
  it("rejects extra, reversed, and duplicate edges even with all required links present", () => {
    for (const edge of [{ from: "error", to: "request" }, graph.edges[0]!]) {
      expect(checkConnections(graph, [...graph.edges, edge]).passed).toBe(false);
    }
  });
  it("stops the visible probe at the first actual break", () => {
    expect(traceConnectionProbe(["click", "request", "error"], graph.edges.slice(0, 2))).toEqual({
      visited: ["click", "request"],
      blocked: { from: "request", to: "error" },
    });
  });
});
