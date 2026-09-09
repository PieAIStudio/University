import { describe, expect, it } from "vitest";
import { evaluateExpression, evaluateTuning } from "./tune.js";
import type { TuneActivity } from "./types.js";

const model = {
  controls: [{ id: "batch", min: 1, max: 10 }],
  metrics: [
    { id: "output", expression: { op: "product", args: [10, { control: "batch" }] }, min: 40 },
    { id: "delay", expression: { control: "batch" }, max: 6 },
  ],
} as TuneActivity;

describe("constrained tuning", () => {
  it("accepts a region of solutions, not one author's exact number", () => {
    expect([4, 5, 6].every((batch) => evaluateTuning(model, { batch }).passed)).toBe(true);
    expect(evaluateTuning(model, { batch: 10 }).passed).toBe(false);
    expect(evaluateTuning(model, { batch: 1 }).passed).toBe(false);
  });
  it("does not certify missing, nonfinite or out-of-range inputs", () => {
    for (const values of [{}, { batch: Infinity }, { batch: NaN }, { batch: 11 }])
      expect(evaluateTuning(model, values).passed).toBe(false);
  });
  it("evaluates arithmetic nesting and refuses unbounded input", () => {
    expect(
      evaluateExpression(
        { op: "max", args: [0, { op: "sum", args: [-3, { control: "x" }] }] },
        { x: 2 },
      ),
    ).toBe(0);
    expect(() => evaluateExpression({ control: "x" }, { x: 2 }, 17)).toThrow();
  });
});
