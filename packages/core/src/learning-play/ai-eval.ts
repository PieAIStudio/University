import type { ActivityBase } from "./types.js";

export type EvalExpectation = "fulfilled" | "clarify" | "unavailable" | "out-of-scope";
export type EvalOutcome = EvalExpectation | "refused";
export interface EvalScenario {
  readonly information: boolean;
  readonly availability: boolean;
  readonly supported: boolean;
}
export interface EvalPolicy {
  readonly information: boolean;
  readonly availability: boolean;
  readonly supported: boolean;
}
export const EMPTY_EVAL_POLICY: EvalPolicy = {
  information: false,
  availability: false,
  supported: false,
};
export const EVAL_EXPECTATIONS: readonly EvalExpectation[] = [
  "fulfilled",
  "clarify",
  "unavailable",
  "out-of-scope",
];
export interface EvalActivity extends ActivityBase {
  readonly kind: "ai-eval";
  readonly product: string;
  readonly contract: string;
  readonly initial: EvalScenario;
  readonly inputs: Readonly<
    Record<
      keyof EvalScenario,
      {
        readonly label: string;
        readonly present: string;
        readonly absent: string;
        readonly guard: string;
      }
    >
  >;
  readonly outcomes: Readonly<
    Record<
      EvalOutcome,
      {
        readonly label: string;
        readonly observation: string;
        readonly artifact?: { readonly label: string; readonly value: string };
      }
    >
  >;
  /** Fixed teaching responses, never a sample of a live model's reliability. */
  readonly candidates: readonly {
    readonly id: string;
    readonly label: string;
    readonly note: string;
    readonly responses: Readonly<Record<EvalExpectation, readonly EvalOutcome[]>>;
  }[];
  readonly trials: number;
  /** Always include a useful normal request and at least one boundary category. */
  readonly requiredExpectations?: readonly EvalExpectation[];
  /** Exact condition combinations the learner must freeze and include in the release run. */
  readonly requiredInputs?: readonly EvalScenario[];
}
export interface EvalCase {
  readonly id: string;
  readonly input: EvalScenario;
  readonly expected: EvalExpectation;
}
export interface EvalObservation {
  readonly caseId: string;
  readonly trial: number;
  readonly expected: EvalExpectation;
  readonly contract: EvalExpectation;
  readonly actual: EvalOutcome;
  readonly guarded: boolean;
  readonly passed: boolean;
}
export interface EvalRun {
  readonly candidateId: string;
  readonly caseSignature: string;
  readonly policy: EvalPolicy;
  readonly observations: readonly EvalObservation[];
}
/** One deliberately requested teaching response. Unseen trials are not evidence. */
export interface EvalTrialReceipt {
  readonly testCase: EvalCase;
  readonly candidateId: string;
  readonly policy: EvalPolicy;
  readonly observation: EvalObservation;
}

const isScenario = (input: EvalScenario): boolean =>
  input != null &&
  [input.information, input.availability, input.supported].every(
    (value) => typeof value === "boolean",
  );
const inputKey = (input: EvalScenario): string =>
  [input.information, input.availability, input.supported].map(Number).join("");

/** Observable product contract. Business scope takes precedence over missing facts. */
export function expectedEvalOutcome(input: EvalScenario): EvalExpectation {
  if (!input.supported) return "out-of-scope";
  if (!input.information) return "clarify";
  if (!input.availability) return "unavailable";
  return "fulfilled";
}

function validEvalRequirements(activity: EvalActivity): boolean {
  const categories = activity.requiredExpectations ?? EVAL_EXPECTATIONS;
  const inputs = activity.requiredInputs ?? [];
  return (
    Array.isArray(categories) &&
    categories.length >= 2 &&
    categories.length <= EVAL_EXPECTATIONS.length &&
    categories.includes("fulfilled") &&
    new Set(categories).size === categories.length &&
    categories.every((category) => EVAL_EXPECTATIONS.includes(category)) &&
    Array.isArray(inputs) &&
    inputs.length <= 8 &&
    inputs.every((input) => isScenario(input) && categories.includes(expectedEvalOutcome(input))) &&
    new Set(inputs.map(inputKey)).size === inputs.length
  );
}

export function freezeEvalCase(
  existing: readonly EvalCase[],
  input: EvalScenario,
  expected: EvalExpectation,
):
  | { readonly valid: true; readonly testCase: EvalCase }
  | {
      readonly valid: false;
      readonly reason: "invalid-input" | "expectation-required" | "duplicate" | "full";
    } {
  if (!isScenario(input)) return { valid: false, reason: "invalid-input" };
  if (!EVAL_EXPECTATIONS.includes(expected))
    return { valid: false, reason: "expectation-required" };
  if (existing.length >= 8) return { valid: false, reason: "full" };
  if (existing.some((item) => inputKey(item.input) === inputKey(input)))
    return { valid: false, reason: "duplicate" };
  return {
    valid: true,
    testCase: { id: `case-${inputKey(input)}`, input: { ...input }, expected },
  };
}

export function evalCaseSignature(cases: readonly EvalCase[]): string {
  return JSON.stringify(cases.map((item) => [item.id, inputKey(item.input), item.expected]));
}

export function runEvalCandidate(
  activity: EvalActivity,
  cases: readonly EvalCase[],
  candidateId: string,
  policy: EvalPolicy = EMPTY_EVAL_POLICY,
):
  | { readonly valid: true; readonly run: EvalRun }
  | {
      readonly valid: false;
      readonly reason: "invalid-activity" | "invalid-cases" | "invalid-policy";
    } {
  const candidate = activity.candidates.find((item) => item.id === candidateId);
  if (
    !candidate ||
    !validEvalRequirements(activity) ||
    !Number.isInteger(activity.trials) ||
    activity.trials < 2 ||
    activity.trials > 5 ||
    EVAL_EXPECTATIONS.some(
      (expected) =>
        candidate.responses[expected]?.length !== activity.trials ||
        candidate.responses[expected].some(
          (outcome) => ![...EVAL_EXPECTATIONS, "refused"].includes(outcome),
        ),
    )
  ) {
    return { valid: false, reason: "invalid-activity" };
  }
  if (
    cases.length === 0 ||
    cases.length > 8 ||
    cases.some(
      (item) =>
        !isScenario(item.input) ||
        !EVAL_EXPECTATIONS.includes(item.expected) ||
        item.id !== `case-${inputKey(item.input)}`,
    ) ||
    new Set(cases.map((item) => item.id)).size !== cases.length
  ) {
    return { valid: false, reason: "invalid-cases" };
  }
  if (!isScenario(policy)) return { valid: false, reason: "invalid-policy" };
  const observations = cases.flatMap((testCase): EvalObservation[] => {
    const contract = expectedEvalOutcome(testCase.input);
    const intercept =
      !testCase.input.supported && policy.supported
        ? "out-of-scope"
        : testCase.input.supported && !testCase.input.information && policy.information
          ? "clarify"
          : testCase.input.supported &&
              testCase.input.information &&
              !testCase.input.availability &&
              policy.availability
            ? "unavailable"
            : undefined;
    return candidate.responses[contract].map((response, index) => {
      const actual = intercept ?? response;
      return {
        caseId: testCase.id,
        trial: index + 1,
        expected: testCase.expected,
        contract,
        actual,
        guarded: intercept !== undefined,
        passed: testCase.expected === contract && actual === testCase.expected,
      };
    });
  });
  return {
    valid: true,
    run: {
      candidateId,
      caseSignature: evalCaseSignature(cases),
      policy: { ...policy },
      observations,
    },
  };
}

export function runEvalTrial(
  activity: EvalActivity,
  testCase: EvalCase,
  candidateId: string,
  trial: number,
  policy: EvalPolicy = EMPTY_EVAL_POLICY,
):
  | { readonly valid: true; readonly receipt: EvalTrialReceipt }
  | {
      readonly valid: false;
      readonly reason: "invalid-trial" | "invalid-activity" | "invalid-cases" | "invalid-policy";
    } {
  if (!Number.isInteger(trial) || trial < 1 || trial > activity.trials)
    return { valid: false, reason: "invalid-trial" };
  const evaluated = runEvalCandidate(activity, [testCase], candidateId, policy);
  if (!evaluated.valid) return evaluated;
  return {
    valid: true,
    receipt: {
      testCase: { ...testCase, input: { ...testCase.input } },
      candidateId,
      policy: { ...policy },
      observation: evaluated.run.observations[trial - 1]!,
    },
  };
}

/** Independent additions preserve old evidence; changed/deleted cases cannot reuse it. */
export function currentEvalReceipts(
  cases: readonly EvalCase[],
  receipts: readonly EvalTrialReceipt[],
): readonly EvalTrialReceipt[] {
  return receipts.filter((receipt) =>
    cases.some(
      (testCase) => evalCaseSignature([testCase]) === evalCaseSignature([receipt.testCase]),
    ),
  );
}

export type EvalReleaseReason =
  | "invalid-requirements"
  | "coverage"
  | "input-coverage"
  | "change-required"
  | "blind-spot"
  | "run-required"
  | "stale-run"
  | "failed-cases"
  | "ready";
export function assessEvalRelease(
  activity: EvalActivity,
  cases: readonly EvalCase[],
  comparisons: readonly (EvalRun | EvalTrialReceipt)[],
  releaseRun: EvalRun | undefined,
): {
  readonly passed: boolean;
  readonly reason: EvalReleaseReason;
  readonly uncovered: readonly EvalExpectation[];
  readonly uncoveredInputs: readonly EvalScenario[];
} {
  const validRequirements = validEvalRequirements(activity);
  const required = validRequirements ? (activity.requiredExpectations ?? EVAL_EXPECTATIONS) : [];
  const uncovered = required.filter(
    (expected) =>
      !cases.some(
        (item) => item.expected === expected && expectedEvalOutcome(item.input) === expected,
      ),
  );
  const uncoveredInputs = (validRequirements ? (activity.requiredInputs ?? []) : []).filter(
    (input) =>
      !cases.some(
        (item) =>
          isScenario(item.input) &&
          inputKey(item.input) === inputKey(input) &&
          item.expected === expectedEvalOutcome(input),
      ),
  );
  const verdict = (reason: EvalReleaseReason) => ({
    passed: reason === "ready",
    reason,
    uncovered,
    uncoveredInputs,
  });
  if (!validRequirements) return verdict("invalid-requirements");
  if (uncovered.length > 0) return verdict("coverage");
  if (uncoveredInputs.length > 0) return verdict("input-coverage");
  if (!cases.some((item) => inputKey(item.input) !== inputKey(activity.initial)))
    return verdict("change-required");
  const signature = evalCaseSignature(cases);
  const hasBlindSpot = comparisons.some((run) => {
    if ("testCase" in run) {
      if (currentEvalReceipts(cases, [run]).length === 0 || Object.values(run.policy).some(Boolean))
        return false;
      const replay = runEvalTrial(
        activity,
        run.testCase,
        run.candidateId,
        run.observation.trial,
        run.policy,
      );
      return (
        replay.valid &&
        JSON.stringify(replay.receipt) === JSON.stringify(run) &&
        run.observation.contract !== "fulfilled" &&
        !run.observation.passed
      );
    }
    if (run.caseSignature !== signature || Object.values(run.policy).some(Boolean)) return false;
    const replay = runEvalCandidate(activity, cases, run.candidateId);
    return (
      replay.valid &&
      JSON.stringify(replay.run) === JSON.stringify(run) &&
      replay.run.observations.some((item) => item.contract !== "fulfilled" && !item.passed)
    );
  });
  if (!hasBlindSpot) return verdict("blind-spot");
  if (!releaseRun) return verdict("run-required");
  if (releaseRun.caseSignature !== signature) return verdict("stale-run");
  const replay = runEvalCandidate(activity, cases, releaseRun.candidateId, releaseRun.policy);
  if (!replay.valid || JSON.stringify(replay.run) !== JSON.stringify(releaseRun))
    return verdict("stale-run");
  if (replay.run.observations.some((item) => !item.passed)) return verdict("failed-cases");
  return verdict("ready");
}
