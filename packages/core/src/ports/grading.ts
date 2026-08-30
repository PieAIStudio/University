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
 *
 * A string that is not a plain non-negative integer returns `null` instead of
 * throwing. These numbers arrive off the wire from the wallet service, and the
 * three surfaces below call this while rendering: a throw there blanks the
 * screen in the middle of a lesson, which is the one thing this product is not
 * allowed to do with a number it could not read. `null` makes the surface say
 * so instead.
 */
export function gradingAttemptsFromPowerUnits(powerUnits: string): bigint | null {
  if (!/^\d+$/.test(powerUnits)) return null;
  return BigInt(powerUnits) / BigInt(METERED_GRADING_COST_POWER_UNITS);
}

/*
  The learner only ever hears 「次」. These three sentences are the whole
  learner-facing vocabulary for the accounting unit, and they live here — beside
  the conversion — because the exercise page, the membership page, the online
  grading port and the grading service all say them. Four copies of one sentence
  is four places for the wording and the rounding to drift apart.

  Each case rewrites the sentence rather than substituting a noun, which is why
  these are sentences and not one formatter: 「你的钱包还够 0 次」 would be a lie
  told with correct arithmetic.
*/

/** What one cost or balance buys, as a bare quantity: 「3 次」. */
export function gradingAttemptText(powerUnits: string): string {
  const attempts = gradingAttemptsFromPowerUnits(powerUnits);
  if (attempts === null) return "暂时读不到";
  return attempts === 0n ? "不够一次了" : `${attempts} 次`;
}

/** Today's remaining free AI gradings. */
export function freeGradingRemainingText(powerUnits: string): string {
  const attempts = gradingAttemptsFromPowerUnits(powerUnits);
  if (attempts === null) return "今天还剩多少次暂时读不到";
  return attempts === 0n ? "今天还不够一次了" : `今天还剩 ${attempts} 次`;
}

/** The wallet balance, counted in gradings rather than in accounting units. */
export function walletGradingBalanceText(powerUnits: string): string {
  const attempts = gradingAttemptsFromPowerUnits(powerUnits);
  if (attempts === null) return "你的钱包余额暂时读不到";
  return attempts === 0n ? "你的钱包还不够一次了" : `你的钱包还够 ${attempts} 次`;
}

/** A grader's verdict, written back through the CLI or returned immediately. */
export interface HostExerciseGrade {
  readonly passed: boolean;
  readonly evaluation: string;
  readonly extensions: readonly string[];
  readonly host: string | null;
  readonly learnerAnswer: string | null;
  readonly occurredAt: string;
}

/**
 * The `host` a tier-one verdict carries.
 *
 * Tier one is string comparison against the answer key. No model runs, and the
 * learner must not be told one did — the free tier's promise is that obvious
 * answers are judged on the spot, and the paid tier's promise is that a model
 * reads the ones that are not. Labelling deterministic matching as AI collapses
 * the difference the product is sold on.
 */
export const DETERMINISTIC_GRADER_HOST = "tier-1";

/** What to call whatever produced this verdict, in the learner's words. */
export function graderLabel(host: string | null): string {
  return host === DETERMINISTIC_GRADER_HOST ? "当场判定" : "AI 评估";
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
  /** A metered request was declined after submission and needs visible guidance. */
  readonly meteredExplanation?: MeteredGradingExplanation;
  /** The funding path confirmed by the server after a tier-two response. */
  readonly meteredFunding?: "free" | "wallet";
  /** The post-settlement wallet balance returned by the server. */
  readonly meteredBalance?: MeteredGradingBalance;
  /** The post-settlement daily free quota returned by the server. */
  readonly meteredFreeQuota?: MeteredGradingFreeQuota;
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

export interface MeteredGradingFreeQuota {
  readonly remainingPowerUnits: string;
  readonly resetsAt: string;
}

export interface MeteredGradingResponse {
  readonly hostGrade: HostExerciseGrade;
  /** Present for wallet-funded grading; free-quota grading does not touch it. */
  readonly balance?: MeteredGradingBalance;
  readonly funding: "free" | "wallet";
  readonly freeQuota?: MeteredGradingFreeQuota;
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
