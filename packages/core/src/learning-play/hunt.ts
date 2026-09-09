import type { HuntActivity } from "./types.js";

export type HuntInputError = "empty" | "not-finite" | "out-of-range" | "invalid-activity";

export interface HuntObservation {
  readonly valid: true;
  readonly input: number;
  readonly expected: number | boolean;
  readonly actual: number | boolean;
  readonly counterexample: boolean;
}

export type HuntEvaluation =
  | HuntObservation
  | { readonly valid: false; readonly reason: HuntInputError };

/** Compare one learner-created input with both contracts; never execute supplied code. */
export function evaluateHunt(activity: HuntActivity, raw: string | number): HuntEvaluation {
  const { min, max } = activity.input;
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min > max ||
    !Number.isFinite(activity.boundary) ||
    (activity.model === "clamp" && activity.boundary < 0)
  ) {
    return { valid: false, reason: "invalid-activity" };
  }
  if (typeof raw === "string" && raw.trim() === "") return { valid: false, reason: "empty" };
  const input = typeof raw === "number" ? raw : Number(raw.trim());
  if (!Number.isFinite(input)) return { valid: false, reason: "not-finite" };
  if (input < min || input > max) return { valid: false, reason: "out-of-range" };

  const expected =
    activity.model === "threshold"
      ? input >= activity.boundary
      : Math.min(activity.boundary, Math.max(0, input));
  const actual =
    activity.model === "threshold" ? input > activity.boundary : Math.min(activity.boundary, input);
  return { valid: true, input, expected, actual, counterexample: expected !== actual };
}

/** Challenge evidence is replayed from real inputs; a reported counterexample flag is not trusted. */
export function assessHuntEvidence(activity: HuntActivity, history: readonly HuntObservation[]) {
  const verified = history.filter((item) => {
    const replay = evaluateHunt(activity, item.input);
    return (
      replay.valid &&
      replay.expected === item.expected &&
      replay.actual === item.actual &&
      replay.counterexample === item.counterexample
    );
  });
  const boundary = activity.model === "clamp" ? 0 : activity.boundary;
  const sides = new Set(verified.map((item) => Math.sign(item.input - boundary)));
  const found = verified.some((item) => item.counterexample);
  return {
    passed: found && (!activity.verifyBoundarySides || [-1, 0, 1].every((side) => sides.has(side))),
    found,
    sides: [...sides],
  };
}
