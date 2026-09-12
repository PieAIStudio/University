import { describe, expect, it } from "vitest";
import { domainLabelY } from "./domain-layout.js";

describe("complete planet label clipping", () => {
  it("keeps a selected two-row label inside a short canvas without changing sphere size", () => {
    for (const height of [28, 40, 54]) {
      for (const viewport of [174, 230, 812]) {
        for (const anchor of [-10, height - 1.58, 70, viewport + 10]) {
          const bottom = domainLabelY(anchor, height, viewport);
          expect(bottom - height).toBeGreaterThanOrEqual(4);
          expect(bottom).toBeLessThanOrEqual(viewport - 4);
        }
      }
    }
    expect(domainLabelY(160, 40, 812)).toBe(160);
  });
});
