import type { z } from "zod";
import type { InteractionPathPayloadSchema } from "../domain/schemas.js";
import type { ActivityBase } from "./types.js";

export type InteractionPathPayload = z.infer<typeof InteractionPathPayloadSchema>;
export type InteractionPathActivity = ActivityBase &
  InteractionPathPayload & { readonly kind: "interaction-path" };
export type InteractionStep = InteractionPathPayload["steps"][number];
export type AssemblyStep = Extract<InteractionStep, { kind: "assemble" }>;
export interface PathAttempt {
  readonly stepId: string;
  readonly answer: readonly string[];
  readonly passed: boolean;
  readonly helpUsed: boolean;
  readonly priorEvidence: boolean;
}
export interface PathEvidence {
  readonly attempts: readonly PathAttempt[];
  readonly helpedStepIds: readonly string[];
  readonly reviewed: boolean;
  readonly resets: number;
}
export const emptyPathEvidence = (): PathEvidence => ({
  attempts: [],
  helpedStepIds: [],
  reviewed: false,
  resets: 0,
});

/** IDs represent authored semantic pieces; there is no free-text keyword matching. */
export function unmetAssemblyConstraints(step: AssemblyStep, answer: readonly string[]): string[] {
  return step.constraints
    .filter((rule) => {
      const present = rule.pieceIds.filter((id) => answer.includes(id)).length;
      switch (rule.kind) {
        case "include":
          return present !== rule.pieceIds.length;
        case "exclude":
          return present !== 0;
        case "one-of":
          return present !== 1;
        case "before":
          return (
            present === 2 && answer.indexOf(rule.pieceIds[0]!) >= answer.indexOf(rule.pieceIds[1]!)
          );
      }
    })
    .map((rule) => rule.id);
}

export function evaluateInteractionStep(
  step: InteractionStep,
  answer: readonly string[],
): { passed: boolean; feedback: string[]; artifact?: string } {
  const choices =
    step.kind === "decision"
      ? step.options
      : step.kind === "evidence"
        ? step.material.sentences
        : step.pieces;
  if (
    new Set(answer).size !== answer.length ||
    answer.some((id) => !choices.some((choice) => choice.id === id))
  ) {
    return { passed: false, feedback: [] };
  }
  if (step.kind !== "assemble") {
    const choice = answer.length === 1 ? choices.find((item) => item.id === answer[0]) : undefined;
    const correct = step.kind === "decision" ? step.correctOptionId : step.correctSentenceId;
    return {
      passed: Boolean(choice && choice.id === correct),
      feedback:
        choice && "explanation" in choice && typeof choice.explanation === "string"
          ? [choice.explanation]
          : [],
    };
  }
  const unmet = unmetAssemblyConstraints(step, answer);
  return {
    passed: unmet.length === 0 && answer.length > 0,
    feedback: step.constraints
      .filter((rule) => unmet.includes(rule.id))
      .map((rule) => rule.explanation),
    artifact: answer.map((id) => step.pieces.find((piece) => piece.id === id)!.label).join("\n"),
  };
}

export function recordPathAttempt(
  evidence: PathEvidence,
  step: InteractionStep,
  answer: readonly string[],
): PathEvidence {
  return {
    ...evidence,
    attempts: [
      ...evidence.attempts,
      {
        stepId: step.id,
        answer: [...answer],
        passed: evaluateInteractionStep(step, answer).passed,
        helpUsed: evidence.helpedStepIds.includes(step.id),
        priorEvidence:
          evidence.reviewed || evidence.attempts.some((attempt) => attempt.stepId === step.id),
      },
    ],
  };
}

/** First exposure stays first, including after reset and after corrected completion. */
export function pathFirstAttemptCount(evidence: PathEvidence): number {
  const seen = new Set<string>();
  return evidence.attempts.filter((attempt) => {
    if (seen.has(attempt.stepId)) return false;
    seen.add(attempt.stepId);
    return attempt.passed && !attempt.helpUsed && !attempt.priorEvidence;
  }).length;
}

const repeated = (ids: readonly string[]) => new Set(ids).size !== ids.length;

function assemblyHasSolution(step: AssemblyStep): boolean {
  // At most 10 pieces (1024 subsets). Topological order allows all unconstrained orders.
  for (let mask = 1; mask < 2 ** step.pieces.length; mask++) {
    const remaining = step.pieces
      .filter((_, index) => mask & (1 << index))
      .map((piece) => piece.id);
    const ordered: string[] = [];
    while (remaining.length) {
      const index = remaining.findIndex(
        (id) =>
          !step.constraints.some(
            (rule) =>
              rule.kind === "before" &&
              rule.pieceIds[1] === id &&
              remaining.includes(rule.pieceIds[0]!),
          ),
      );
      if (index < 0) break;
      ordered.push(...remaining.splice(index, 1));
    }
    if (!remaining.length && !unmetAssemblyConstraints(step, ordered).length) return true;
  }
  return false;
}

/** Shape is Zod's job; cross references and satisfiability belong to the pure engine. */
export function interactionPathIssues(path: InteractionPathPayload): string[] {
  const issues: string[] = [];
  if (repeated(path.sources.map((source) => source.id))) issues.push("Duplicate path source ID");
  if (repeated(path.steps.map((step) => step.id))) issues.push("Duplicate path step ID");
  if (
    path.steps[0]?.kind !== "decision" ||
    !path.steps.some((step) => step.kind === "assemble") ||
    !path.steps.some((step) => step.kind === "evidence")
  ) {
    issues.push("A path starts with decision and includes evidence and a usable assembly");
  }
  for (const source of path.sources) {
    if ("url" in source.reference && !/^https?:\/\//.test(source.reference.url))
      issues.push(`Unsafe source URL: ${source.id}`);
  }
  for (const step of path.steps) {
    if (!path.sources.some((source) => source.id === step.sourceId))
      issues.push(`Unknown source: ${step.sourceId}`);
    if (step.kind === "evidence" && step.task === "unsupported" && !step.material.reference)
      issues.push(`Unsupported-claim task needs a visible source record: ${step.id}`);
    const choices =
      step.kind === "decision"
        ? step.options
        : step.kind === "evidence"
          ? step.material.sentences
          : step.pieces;
    const ids = choices.map((choice) => choice.id);
    if (repeated(ids)) issues.push(`Duplicate choice/piece ID: ${step.id}`);
    if (step.kind !== "assemble") {
      const correct = step.kind === "decision" ? step.correctOptionId : step.correctSentenceId;
      if (!ids.includes(correct)) issues.push(`Unknown correct choice: ${step.id}`);
    } else {
      if (repeated(step.initialPieceIds) || step.initialPieceIds.some((id) => !ids.includes(id)))
        issues.push(`Invalid initial pieces: ${step.id}`);
      if (repeated(step.constraints.map((rule) => rule.id)))
        issues.push(`Duplicate constraint ID: ${step.id}`);
      for (const rule of step.constraints) {
        if (
          repeated(rule.pieceIds) ||
          rule.pieceIds.some((id) => !ids.includes(id)) ||
          (rule.kind === "before" && rule.pieceIds.length !== 2)
        )
          issues.push(`Invalid constraint: ${step.id}/${rule.id}`);
      }
      if (
        ids.some(
          (id) =>
            !step.constraints.some((rule) => rule.kind !== "before" && rule.pieceIds.includes(id)),
        )
      )
        issues.push(`Unclassified semantic piece: ${step.id}`);
      if (!assemblyHasSolution(step)) issues.push(`Unsatisfiable assembly: ${step.id}`);
    }
  }
  return issues;
}
