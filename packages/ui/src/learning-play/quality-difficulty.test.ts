import { describe, expect, it } from "vitest";
import {
  EVAL_EXPECTATIONS,
  appendRepairComparisonEvent,
  assessEvalRelease,
  captureRepairEvidence,
  checkRepairComparisonRegression,
  checkRepairDefect,
  createRepairComparison,
  expectedEvalOutcome,
  freezeEvalCase,
  replayRepair,
  runEvalCandidate,
  runEvalTrial,
  seekRepairComparison,
  type EvalActivity,
  type EvalCase,
  type EvalTrialReceipt,
  type RepairActivity,
  type RepairEvent,
} from "@pieai/university-core";
import { getAIQualityExamples } from "./ai-quality-examples.js";
import { evalStarterQuestion, repairActionCue } from "./QualityGuidance.js";
import { getQualityFamily } from "./quality-difficulty.js";
import { messages as en } from "../i18n/catalogs/learning-play-quality-difficulty.en.js";
import { messages as zh } from "../i18n/catalogs/learning-play-quality-difficulty.zh-CN.js";

const bases = getAIQualityExamples();
const families = bases.map(getQualityFamily);
const payloads = families.flatMap((family) => Object.values(family.levels));

/** Executable solution witnesses, kept in tests rather than shipped as learner evidence. */
function evaluationWitness(activity: EvalActivity): readonly EvalCase[] {
  let cases: readonly EvalCase[] = [];
  const inputs = [
    ...(activity.requiredExpectations ?? EVAL_EXPECTATIONS).map((expected) => ({
      information: expected !== "clarify",
      availability: expected !== "unavailable",
      supported: expected !== "out-of-scope",
    })),
    ...(activity.requiredInputs ?? []),
  ];
  for (const input of inputs) {
    const frozen = freezeEvalCase(cases, input, expectedEvalOutcome(input));
    if (!frozen.valid) throw new Error(frozen.reason);
    cases = [...cases, frozen.testCase];
  }
  return cases;
}

function repairWitness(activity: RepairActivity): {
  reproduce: readonly RepairEvent[];
  regression: readonly RepairEvent[];
} {
  const [first, second, third] = activity.choices;
  const reproduce: readonly RepairEvent[] =
    activity.model === "booking"
      ? [{ type: "submit" }, { type: "submit" }]
      : [{ type: "choose", value: second!.id }, { type: "submit" }, { type: "reload" }];
  if (activity.regressionContract === "keep-other-booking")
    return {
      reproduce,
      regression: [
        { type: "submit" },
        { type: "choose", value: second!.id },
        { type: "submit" },
        { type: "cancel" },
        { type: "choose", value: third!.id },
        { type: "submit" },
      ],
    };
  if (activity.regressionContract === "persist-each-change")
    return {
      reproduce,
      regression: [
        { type: "choose", value: second!.id },
        { type: "submit" },
        { type: "reload" },
        { type: "choose", value: third!.id },
        { type: "submit" },
        { type: "reload" },
      ],
    };
  return {
    reproduce,
    regression:
      activity.model === "booking"
        ? [
            { type: "submit" },
            { type: "cancel" },
            { type: "choose", value: second!.id },
            { type: "submit" },
          ]
        : [
            { type: "choose", value: second!.id },
            { type: "submit" },
            { type: "choose", value: first!.id },
            { type: "submit" },
            { type: "reload" },
          ],
  };
}

describe("quality difficulty families have real solvable contracts", () => {
  it("provides four families and twelve independent IDs while preserving the previous practice payloads", () => {
    expect(families).toHaveLength(4);
    expect(payloads).toHaveLength(12);
    expect(new Set(payloads.map((payload) => payload.id)).size).toBe(12);
    for (const [index, family] of families.entries()) {
      const base = bases[index]!;
      expect(family.id).toBe(base.id);
      for (const [difficulty, payload] of Object.entries(family.levels)) {
        expect(payload.id).toBe(`${base.id}:${difficulty}:v1`);
        expect(payload.difficulty).toBe(difficulty);
        expect(payload.kind).toBe(base.kind);
        expect(payload).not.toHaveProperty("receipts");
        expect(payload).not.toHaveProperty("evidence");
        expect(JSON.stringify(payload)).not.toContain("{{");
      }
      expect(family.levels.practice).toEqual({
        ...base,
        id: `${base.id}:practice:v1`,
        difficulty: "practice",
      });
    }
  });

  it.each(payloads.filter((payload): payload is EvalActivity => payload.kind === "ai-eval"))(
    "$id can be solved using frozen real cases and observed trials",
    (activity) => {
      const cases = evaluationWitness(activity);
      const candidate = activity.candidates[0]!.id;
      const receipts: EvalTrialReceipt[] = [];
      expect(assessEvalRelease(activity, [], receipts, undefined).passed).toBe(false);
      for (const testCase of cases)
        for (let trial = 1; trial <= activity.trials; trial++) {
          const result = runEvalTrial(activity, testCase, candidate, trial);
          if (!result.valid) throw new Error(result.reason);
          receipts.push(result.receipt);
        }
      const release = runEvalCandidate(activity, cases, candidate, {
        information: true,
        availability: true,
        supported: true,
      });
      if (!release.valid) throw new Error(release.reason);
      expect(cases).toHaveLength(
        activity.difficulty === "intro" ? 2 : activity.difficulty === "challenge" ? 6 : 4,
      );
      expect(assessEvalRelease(activity, cases, receipts, release.run).passed).toBe(true);
      const starter = evalStarterQuestion(activity);
      expect(
        assessEvalRelease(
          activity,
          cases.filter((item) => item.expected === starter.expected),
          receipts,
          release.run,
        ).passed,
      ).toBe(false);
      expect(receipts.some((receipt) => !receipt.observation.passed)).toBe(true);
      expect(
        release.run.observations
          .filter((item) => item.contract === "fulfilled")
          .every((item) => item.passed),
      ).toBe(true);
    },
  );

  it("keeps the shop intro's third response, where its actual failure appears", () => {
    const activity = payloads.find(
      (payload): payload is EvalActivity =>
        payload.kind === "ai-eval" && payload.id === "ai-eval-shop:intro:v1",
    )!;
    const boundary = evaluationWitness(activity).find((item) => item.expected === "unavailable")!;
    expect(activity.trials).toBe(3);
    expect(activity.requiredExpectations).toEqual(["fulfilled", "unavailable"]);
    const responses = [1, 2, 3].map((trial) =>
      runEvalTrial(activity, boundary, activity.candidates[0]!.id, trial),
    );
    expect(
      responses.map((response) => response.valid && response.receipt.observation.passed),
    ).toEqual([true, true, false]);
  });

  it.each(payloads.filter((payload): payload is RepairActivity => payload.kind === "ai-repair"))(
    "$id has a reproducible defect and a manual regression witness",
    (activity) => {
      const witness = repairWitness(activity);
      const broken = replayRepair(activity, "broken", witness.reproduce);
      if (!broken.valid) throw new Error(broken.reason);
      const evidence = captureRepairEvidence(activity, broken.trace)!;
      expect(evidence).toBeDefined();
      expect(checkRepairDefect(activity, "scoped", evidence).passed).toBe(true);
      expect(checkRepairDefect(activity, "removed", evidence).passed).toBe(false);
      let manual = createRepairComparison(activity, "broken", "scoped", [], "manual")!;
      for (const event of witness.regression) {
        const cue = repairActionCue(activity, manual.right, true);
        expect(cue.action).toBe(event.type);
        if (event.type === "choose") expect(cue.choice).toBe(event.value);
        manual = appendRepairComparisonEvent(activity, manual, event);
      }
      expect(repairActionCue(activity, manual.right, true).name).toBe("checkOld");
      expect(checkRepairComparisonRegression(activity, manual)).toBe("passed");
      const automatic = createRepairComparison(activity, "broken", "scoped", witness.regression)!;
      expect(
        checkRepairComparisonRegression(
          activity,
          seekRepairComparison(automatic, witness.regression.length),
        ),
      ).toBe("missing");
      if (activity.difficulty === "intro")
        expect(activity.offeredPatches).toEqual(["scoped", "removed"]);
      if (activity.difficulty === "challenge") expect(activity.choices).toHaveLength(3);
    },
  );

  it("includes a complete English catalog for the same public requirement keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });
});
