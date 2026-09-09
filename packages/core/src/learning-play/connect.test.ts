import { describe, expect, it } from "vitest";
import { checkConnections, traceConnectionProbe } from "./connect.js";
import type { ConnectActivity } from "./types.js";

const graph = {
  edges: [
    { from: "click", to: "request", why: "" },
    { from: "request", to: "success", why: "" },
    { from: "request", to: "error", why: "" },
  ],
} as ConnectActivity;

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
