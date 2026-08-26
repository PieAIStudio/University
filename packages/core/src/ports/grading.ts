/**
 * Where an answer is judged.
 *
 * The one permitted difference between the shells: the authoring shell hands
 * the question to the coding tool already on the machine, and the delivery
 * shell grades what it can for free then meters anything above that. Everything
 * above this port is one implementation. This file is the type and an
 * in-process fake; it has no React, no filesystem, and no network.
 */

import type { LessonRef } from "../progress/contract.js";

/** An AI host's verdict, written back through the CLI or returned immediately. */
export interface HostExerciseGrade {
  readonly passed: boolean;
  readonly evaluation: string;
  readonly extensions: readonly string[];
  readonly host: string | null;
  readonly learnerAnswer: string | null;
  readonly occurredAt: string;
}

/**
 * What submitting returns.
 *
 * `correct` is always false on the authoring path — the page records the
 * answer and the verdict arrives later from a host. A delivery implementation
 * that can decide immediately fills `hostGrade` on the same turn.
 */
export interface ExerciseAttemptResult {
  readonly correct: boolean;
  readonly attemptCount: number;
  readonly score: number;
  readonly maxScore: number;
  readonly awaitingHostGrade?: boolean;
  readonly hostGrade?: HostExerciseGrade | null;
}

/**
 * The packet is built by the implementation, not the page.
 *
 * It has to carry the real source lines the question is about — an assistant
 * in a fresh chat window usually cannot open the repository. The delivery
 * shell has no clipboard host, so its implementation may omit this method.
 */
export interface CoachingPacket {
  readonly packet: string;
  readonly referenceDisclosed: boolean;
  readonly evidenceCount: number;
  readonly evidenceOmitted: number;
  readonly submissionCount: number;
}

export interface ExerciseSubmitInput {
  readonly locator: LessonRef;
  readonly exerciseId: string;
  readonly contentRevision: number;
  readonly answer: string;
  readonly commandId: string;
}

/**
 * The JSON envelope returned by delivery's server-side tier two grader.
 *
 * This is a wire shape behind the existing GradingPort, not a fourth port.
 * Keeping it in the platform-neutral contract lets the browser and the
 * server agree on one response without making the core package own fetch,
 * Supabase, a wallet, or a model client.
 */
export interface MeteredGradingBalance {
  readonly availablePowerUnits: string;
  readonly balancePowerUnits: string;
  readonly reservedPowerUnits: string;
}

export interface MeteredGradingResponse {
  readonly hostGrade: HostExerciseGrade;
  readonly balance: MeteredGradingBalance;
}

export interface GradingPort {
  submitExercise(input: ExerciseSubmitInput): Promise<ExerciseAttemptResult>;
  coachingPacket?(input: {
    readonly locator: LessonRef;
    readonly exerciseId: string;
  }): Promise<CoachingPacket>;
  expressionPacket?(studyId: string): Promise<{ readonly packet: string }>;
}

export interface MemoryGradingPort extends GradingPort {
  readonly submissions: ExerciseSubmitInput[];
}

/** In-process fake: non-empty answers pass, empty answers stay undecided. */
export function createMemoryGradingPort(): MemoryGradingPort {
  const submissions: ExerciseSubmitInput[] = [];
  return {
    submissions,
    async submitExercise(input) {
      submissions.push(input);
      const passed = input.answer.trim().length > 0;
      return {
        correct: false,
        attemptCount: submissions.length,
        score: passed ? 1 : 0,
        maxScore: 1,
        awaitingHostGrade: false,
        hostGrade: {
          passed,
          evaluation: passed ? "答对了。" : "再想一下。",
          extensions: [],
          host: "memory",
          learnerAnswer: input.answer,
          occurredAt: new Date().toISOString(),
        },
      };
    },
  };
}
