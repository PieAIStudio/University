import { describe, expect, it } from "vitest";
import {
  EMPTY_EVAL_POLICY,
  EVAL_EXPECTATIONS,
  assessEvalRelease,
  freezeEvalCase,
  runEvalCandidate,
  runEvalTrial,
  currentEvalReceipts,
  type EvalActivity,
  type EvalCase,
  type EvalExpectation,
  type EvalPolicy,
} from "./ai-eval.js";

const activity: EvalActivity = {
  kind: "ai-eval",
  id: "test",
  title: "",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "", url: "https://example.com" },
  product: "",
  contract: "",
  trials: 3,
  initial: { information: true, availability: true, supported: true },
  inputs: Object.fromEntries(
    ["information", "availability", "supported"].map((key) => [
      key,
      { label: "", present: "", absent: "", guard: "" },
    ]),
  ) as EvalActivity["inputs"],
  outcomes: Object.fromEntries(
    [...EVAL_EXPECTATIONS, "refused"].map((key) => [key, { label: "", observation: "" }]),
  ) as EvalActivity["outcomes"],
  candidates: [
    {
      id: "eager",
      label: "",
      note: "",
      responses: {
        fulfilled: ["fulfilled", "fulfilled", "fulfilled"],
        clarify: ["fulfilled", "fulfilled", "fulfilled"],
        unavailable: ["fulfilled", "fulfilled", "fulfilled"],
        "out-of-scope": ["fulfilled", "fulfilled", "fulfilled"],
      },
    },
    {
      id: "careful",
      label: "",
      note: "",
      responses: {
        fulfilled: ["fulfilled", "fulfilled", "fulfilled"],
        clarify: ["clarify", "clarify", "clarify"],
        unavailable: ["unavailable", "unavailable", "unavailable"],
        "out-of-scope": ["out-of-scope", "fulfilled", "out-of-scope"],
      },
    },
    {
      id: "refuse",
      label: "",
      note: "",
      responses: {
        fulfilled: ["refused", "refused", "refused"],
        clarify: ["refused", "refused", "refused"],
        unavailable: ["refused", "refused", "refused"],
        "out-of-scope": ["refused", "refused", "refused"],
      },
    },
  ],
};
const cases: readonly EvalCase[] = EVAL_EXPECTATIONS.map((expected) => {
  const input = {
    information: expected !== "clarify",
    availability: expected !== "unavailable",
    supported: expected !== "out-of-scope",
  };
  const result = freezeEvalCase([], input, expected);
  if (!result.valid) throw new Error(result.reason);
  return result.testCase;
});

describe("one-response-at-a-time investigation", () => {
  const boundary = cases.find((item) => item.expected === "out-of-scope")!;
  const first = runEvalTrial(activity, boundary, "careful", 1);
  const second = runEvalTrial(activity, boundary, "careful", 2);
  if (!first.valid || !second.valid) throw new Error("Invalid teaching fixture");
  const release = run("careful", { information: false, availability: false, supported: true });

  it("produces only the requested receipt, then exposes a different response to the exact same frozen case", () => {
    expect(first.receipt.observation).toMatchObject({
      trial: 1,
      actual: "out-of-scope",
      passed: true,
    });
    expect(second.receipt.observation).toMatchObject({
      trial: 2,
      actual: "fulfilled",
      passed: false,
    });
    expect(first.receipt.testCase).toEqual(second.receipt.testCase);
    expect(first.receipt).not.toHaveProperty("observations");
    expect(assessEvalRelease(activity, cases, [first.receipt], release).reason).toBe("blind-spot");
    expect(
      assessEvalRelease(activity, cases, [first.receipt, second.receipt], release).passed,
    ).toBe(true);
  });
  it("preserves a discovery when independent cases are added but removes it when its own criterion changes", () => {
    expect(currentEvalReceipts([boundary], [second.receipt])).toEqual([second.receipt]);
    expect(currentEvalReceipts(cases, [second.receipt])).toEqual([second.receipt]);
    const changed = cases.map((item) =>
      item.id === boundary.id ? { ...item, expected: "fulfilled" as const } : item,
    );
    expect(currentEvalReceipts(changed, [second.receipt])).toEqual([]);
    const another = runEvalTrial(activity, cases[0]!, "eager", 1);
    if (!another.valid) throw new Error("Invalid case");
    expect(currentEvalReceipts(changed, [second.receipt, another.receipt])).toEqual([
      another.receipt,
    ]);
  });
  it("does not accept a forged failure receipt or a receipt for an uncollected input", () => {
    const forged = {
      ...first.receipt,
      observation: { ...first.receipt.observation, actual: "fulfilled" as const, passed: false },
    };
    expect(assessEvalRelease(activity, cases, [forged], release).reason).toBe("blind-spot");
    const removed = cases.filter((item) => item.id !== boundary.id);
    expect(currentEvalReceipts(removed, [second.receipt])).toEqual([]);
  });
  it.each([0, -1, 4, 1.5, Number.NaN])("rejects an unavailable trial index: %s", (trial) => {
    expect(runEvalTrial(activity, boundary, "careful", trial)).toEqual({
      valid: false,
      reason: "invalid-trial",
    });
  });
});
function run(candidate = "eager", policy: EvalPolicy = EMPTY_EVAL_POLICY, suite = cases) {
  const result = runEvalCandidate(activity, suite, candidate, policy);
  if (!result.valid) throw new Error(result.reason);
  return result.run;
}

describe("AI test bench", () => {
  it("freezes a copy of the player's actual input and explicit expectation", () => {
    const input = { ...activity.initial, information: false };
    const frozen = freezeEvalCase([], input, "clarify");
    input.information = true;
    expect(frozen).toMatchObject({
      valid: true,
      testCase: { input: { information: false }, expected: "clarify" },
    });
    expect(freezeEvalCase(cases, cases[0]!.input, "fulfilled")).toMatchObject({
      valid: false,
      reason: "duplicate",
    });
    expect(freezeEvalCase([], input, "" as EvalExpectation)).toMatchObject({
      valid: false,
      reason: "expectation-required",
    });
  });
  it("does not reveal or fabricate results before a test exists", () => {
    expect(runEvalCandidate(activity, [], "eager")).toEqual({
      valid: false,
      reason: "invalid-cases",
    });
  });
  it("retains each concrete trial, exposing a blind spot missed in the first response", () => {
    const observations = run("careful").observations.filter(
      (item) => item.contract === "out-of-scope",
    );
    expect(observations.map((item) => item.passed)).toEqual([true, false, true]);
    expect(observations.map((item) => item.trial)).toEqual([1, 2, 3]);
  });
  it("accepts two useful release configurations with distinct required guards", () => {
    const comparisons = [run("eager"), run("careful")];
    expect(
      assessEvalRelease(
        activity,
        cases,
        comparisons,
        run("eager", { information: true, availability: true, supported: true }),
      ).passed,
    ).toBe(true);
    expect(
      assessEvalRelease(
        activity,
        cases,
        comparisons,
        run("careful", { information: false, availability: false, supported: true }),
      ).passed,
    ).toBe(true);
  });
  it("rejects over-refusal even with every guard enabled", () => {
    const result = run("refuse", { information: true, availability: true, supported: true });
    expect(
      result.observations
        .filter((item) => item.contract === "fulfilled")
        .every((item) => !item.passed),
    ).toBe(true);
    expect(assessEvalRelease(activity, cases, [run()], result).reason).toBe("failed-cases");
  });
  it("cannot release with only happy paths, only broken paths, or no observed blind spot", () => {
    expect(assessEvalRelease(activity, cases.slice(0, 1), [run()], run()).reason).toBe("coverage");
    expect(assessEvalRelease(activity, cases.slice(1), [run()], run()).uncovered).toEqual([
      "fulfilled",
    ]);
    expect(assessEvalRelease(activity, cases, [], run()).reason).toBe("blind-spot");
  });
  it("marks a convenient but wrong acceptance expectation as a failed test", () => {
    const permissive = cases.map((item) => ({ ...item, expected: "fulfilled" as const }));
    const result = run("eager", EMPTY_EVAL_POLICY, permissive);
    expect(
      result.observations
        .filter((item) => item.contract !== "fulfilled")
        .every((item) => !item.passed),
    ).toBe(true);
    expect(assessEvalRelease(activity, permissive, [result], result).reason).toBe("coverage");
  });
  it("invalidates the release when inputs or the frozen criterion change", () => {
    const old = run("careful", { information: false, availability: false, supported: true });
    const extra = freezeEvalCase(
      cases,
      { information: false, availability: false, supported: true },
      "clarify",
    );
    if (!extra.valid) throw new Error(extra.reason);
    const changed = [...cases, extra.testCase];
    const comparison = run("eager", EMPTY_EVAL_POLICY, changed);
    expect(assessEvalRelease(activity, changed, [comparison], old).reason).toBe("stale-run");
  });
  it("rejects forged green observations and bounds malformed fixtures", () => {
    const forged = {
      ...run(),
      observations: run().observations.map((item) => ({ ...item, passed: true })),
    };
    expect(assessEvalRelease(activity, cases, [run()], forged).reason).toBe("stale-run");
    expect(runEvalCandidate({ ...activity, trials: 5000 }, cases, "eager")).toMatchObject({
      valid: false,
    });
    expect(runEvalCandidate(activity, [...cases, cases[0]!], "eager")).toMatchObject({
      valid: false,
    });
    expect(runEvalCandidate(activity, cases, "unknown")).toMatchObject({ valid: false });
  });
});
