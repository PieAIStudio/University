import { describe, expect, it } from "vitest";

import { evaluateHunt } from "./hunt.js";
import type { HuntActivity } from "./types.js";

const threshold: HuntActivity = {
  id: "shipping",
  kind: "hunt",
  title: "Shipping boundary",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "Specification", url: "https://example.com/specification" },
  model: "threshold",
  boundary: 100,
  input: { label: "Order total", unit: "credits", min: 0, max: 200, initial: 120 },
  rule: "Orders of 100 or more qualify.",
  program: "total > 100",
  outputLabel: "Qualifies",
};

const clamp: HuntActivity = {
  ...threshold,
  id: "volume",
  model: "clamp",
  input: { label: "Requested volume", unit: "%", min: -100, max: 200, initial: 40 },
  rule: "Output stays between 0 and 100.",
  program: "Math.min(100, input)",
  outputLabel: "Actual volume",
};

describe("evaluateHunt", () => {
  it("finds the inclusive threshold bug only at the boundary", () => {
    expect(evaluateHunt(threshold, "100")).toEqual({
      valid: true,
      input: 100,
      expected: true,
      actual: false,
      counterexample: true,
    });
    for (const value of [0, 99.99, 100.01, 120, 200]) {
      expect(evaluateHunt(threshold, value)).toMatchObject({ valid: true, counterexample: false });
    }
  });

  it("uses the supplied boundary rather than the sample answer", () => {
    const changed = { ...threshold, boundary: 37.5 };
    expect(evaluateHunt(changed, " 37.5 ")).toMatchObject({ valid: true, counterexample: true });
    expect(evaluateHunt(changed, 100)).toMatchObject({ valid: true, counterexample: false });
  });

  it("accepts every legal negative counterexample to the missing lower clamp", () => {
    for (const value of [-100, -23, -0.01]) {
      expect(evaluateHunt(clamp, value)).toEqual({
        valid: true,
        input: value,
        expected: 0,
        actual: value,
        counterexample: true,
      });
    }
  });

  it("does not call ordinary values or upper clamping a counterexample", () => {
    for (const value of [0, 40, 100, 200]) {
      expect(evaluateHunt(clamp, value)).toMatchObject({ valid: true, counterexample: false });
    }
    expect(evaluateHunt({ ...clamp, boundary: 60 }, 180)).toMatchObject({
      expected: 60,
      actual: 60,
      counterexample: false,
    });
  });

  it.each(["", " ", "\n\t"])("rejects an empty input without coercing it to zero: %j", (raw) => {
    expect(evaluateHunt(clamp, raw)).toEqual({ valid: false, reason: "empty" });
  });

  it.each(["NaN", "Infinity", "one", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite input: %j",
    (raw) => {
      expect(evaluateHunt(clamp, raw)).toEqual({ valid: false, reason: "not-finite" });
    },
  );

  it("rejects out-of-domain inputs even when they would expose the bug", () => {
    expect(evaluateHunt(clamp, -101)).toEqual({ valid: false, reason: "out-of-range" });
    expect(evaluateHunt(threshold, 201)).toEqual({ valid: false, reason: "out-of-range" });
  });

  it("refuses an invalid numeric model", () => {
    expect(evaluateHunt({ ...clamp, boundary: -1 }, -10)).toEqual({
      valid: false,
      reason: "invalid-activity",
    });
    expect(evaluateHunt({ ...threshold, input: { ...threshold.input, min: 201 } }, 100)).toEqual({
      valid: false,
      reason: "invalid-activity",
    });
  });
});
