import { describe, expect, it } from "vitest";
import { evaluateExpression, evaluateTuning } from "./tune.js";
import type { TuneActivity } from "./types.js";

const model = {
  id: "batch",
  kind: "tune",
  title: "调一调批次大小",
  brief: "找到既快又够用的批次。",
  goal: "在限制内调节批次。",
  takeaway: "合适的范围比一个神奇数字更重要。",
  hint: "先看产量和延误。",
  source: { label: "测试资料", url: "https://example.com/source" },
  controls: [{ id: "batch", label: "批次", unit: "件", min: 1, max: 10, initial: 5 }],
  metrics: [
    {
      id: "output",
      label: "产量",
      unit: "件",
      expression: { op: "product", args: [10, { control: "batch" }] },
      min: 40,
      scale: 1,
      precision: 0,
      explanation: "每批十件。",
    },
    {
      id: "delay",
      label: "延误",
      unit: "分钟",
      expression: { control: "batch" },
      max: 6,
      scale: 1,
      precision: 0,
      explanation: "批次越大，等待越久。",
    },
  ],
  modelNote: "测试模型。",
} satisfies TuneActivity;

describe("constrained tuning", () => {
  it("accepts a region of solutions, not one author's exact number", () => {
    expect([4, 5, 6].every((batch) => evaluateTuning(model, { batch }).passed)).toBe(true);
    expect(evaluateTuning(model, { batch: 10 }).passed).toBe(false);
    expect(evaluateTuning(model, { batch: 1 }).passed).toBe(false);
  });
  it("does not certify missing, nonfinite or out-of-range inputs", () => {
    const invalidInputs: Readonly<Record<string, number>>[] = [
      {},
      { batch: Infinity },
      { batch: NaN },
      { batch: 11 },
    ];
    for (const values of invalidInputs) expect(evaluateTuning(model, values).passed).toBe(false);
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
