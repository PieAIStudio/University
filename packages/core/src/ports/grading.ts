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

/** The internal accounting cost for one structured tier-two grading request. */
export const METERED_GRADING_COST_POWER_UNITS = "100";

/**
 * Convert internal wallet units into complete learner-facing AI grading
 * attempts. BigInt keeps the floor exact even when a wallet balance is larger
 * than JavaScript's safe integer range.
 */
export function gradingAttemptsFromPowerUnits(powerUnits: string): bigint {
  if (!/^\d+$/.test(powerUnits)) {
    throw new Error("The accounting balance must be a non-negative integer.");
  }
  return BigInt(powerUnits) / BigInt(METERED_GRADING_COST_POWER_UNITS);
}

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
  /** True when the free verdict was undecidable and an optional tier two exists. */
  readonly meteredEligible?: boolean;
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
  /** Safe by default: tier two needs an explicit learner choice. */
  readonly allowMetered?: boolean;
  /** Which explicit funding choice the delivery server must honor. */
  readonly meteredFunding?: "free" | "wallet";
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
  /** Present for wallet-funded grading; free-quota grading does not touch it. */
  readonly balance?: MeteredGradingBalance;
  readonly funding: "free" | "wallet";
  readonly freeQuota?: {
    readonly remainingPowerUnits: string;
    readonly resetsAt: string;
  };
}

/** The explanation shown when a metered grading capability is not available. */
export interface MeteredGradingExplanation {
  readonly kind: "explanation";
  readonly title: string;
  readonly whatItDoes: string;
  readonly whyUnavailable: string;
  readonly futureSupport: string;
  /** An existing learner-facing route, such as the account binding page. */
  readonly action?: {
    readonly label: string;
    readonly href: string;
  };
}

/** A quote is read before an explicit choice, never after a charge. */
export type MeteredGradingOffer =
  | {
      /** The next request is covered by today's free structured-grading quota. */
      readonly kind: "free";
      readonly costPowerUnits: string;
      readonly remainingPowerUnits: string;
      readonly resetsAt: string;
    }
  | {
      /** The next request will reserve the learner's wallet after opt-in. */
      readonly kind: "available";
      readonly costPowerUnits: string;
      readonly availablePowerUnits: string;
      readonly freeQuotaExhausted?: boolean;
      readonly freeQuotaResetsAt?: string;
    }
  | {
      readonly kind: "unavailable";
      readonly costPowerUnits: string;
      readonly availablePowerUnits: string | null;
      readonly explanation: MeteredGradingExplanation;
      readonly freeQuotaExhausted?: boolean;
      readonly freeQuotaResetsAt?: string;
    };

export interface GradingPort {
  submitExercise(input: ExerciseSubmitInput): Promise<ExerciseAttemptResult>;
  meteredGradingOffer(): Promise<MeteredGradingOffer>;
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
    async meteredGradingOffer() {
      return {
        kind: "unavailable",
        costPowerUnits: METERED_GRADING_COST_POWER_UNITS,
        availablePowerUnits: null,
        explanation: {
          kind: "explanation",
          title: "AI 语义批改暂不可用",
          whatItDoes: "它会在确定性判题无法判断的开放题上提供一次额外的结构化评估。",
          whyUnavailable: "当前只是内存测试端口，没有登录态、钱包或线上批改服务。",
          futureSupport: "线上端会先显示费用和余额，再让学习者明确选择是否使用。",
        },
      };
    },
  };
}
