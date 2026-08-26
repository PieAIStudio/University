/**
 * The delivery shell's GradingPort: tier one, in the browser, no clipboard.
 *
 * The honesty from the previous delivery-only quiz stays: a sentence the
 * fingerprint cannot judge is not marked wrong, and a clue is a sentence the
 * learner already read, never the answer.
 */
import {
  METERED_GRADING_COST_POWER_UNITS,
  gradeDeterministically,
  type AnswerKey,
  type ExerciseAttemptResult,
  type GradingPort,
  type LessonRef,
  type MeteredGradingExplanation,
  type MeteredGradingOffer,
  type MeteredGradingResponse,
  type ProgressPort,
  type WalletBalance,
} from "@pieai/university-core";
import { readJson } from "@pieai/university-ui/api/client.js";

import { isRepositoryAnchor, peekCourse } from "../../content/library";
import type { Lesson } from "../../content/library";
import { normalise } from "../../lesson/grading";

/**
 * The lesson an answer is about, found from the address rather than handed in.
 *
 * It used to be a constructor argument, which meant a grading port could only
 * exist once a lesson had been loaded and only for that lesson. One port per
 * document is what lets the two campuses construct theirs in the same place;
 * by the time an answer is submitted the reader has the package open, so this
 * is a lookup and not a fetch.
 */
function lessonAt(locator: LessonRef): Lesson | undefined {
  return peekCourse(locator.studyId, locator.courseId)
    ?.units.find((unit) => unit.id === locator.unitId)
    ?.lessons.find((entry) => entry.id === locator.lessonId);
}

export function createOnlineGradingPort(options: {
  readonly progress?: ProgressPort;
  readonly readAccessToken?: () => Promise<string | null>;
  readonly readBalance?: () => Promise<WalletBalance | null>;
  readonly gradingUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): GradingPort {
  const { progress } = options;
  const attempts = new Map<string, number>();
  const readAccessToken = options.readAccessToken ?? (async () => null);
  const fetchImpl = options.fetchImpl ?? fetch;
  const gradingUrl =
    options.gradingUrl?.trim() || import.meta.env.VITE_UNIVERSITY_GRADING_URL?.trim();

  return {
    async meteredGradingOffer() {
      return readMeteredGradingOffer({
        gradingUrl,
        readAccessToken,
        readBalance: options.readBalance,
      });
    },

    async submitExercise(input) {
      const lesson = lessonAt(input.locator);
      const exercise = lesson?.exercises.find((item) => item.id === input.exerciseId);
      const count = (attempts.get(input.exerciseId) ?? 0) + 1;
      attempts.set(input.exerciseId, count);
      const verdict = gradeDeterministically(
        input.answer,
        exercise?.answerKey as AnswerKey | undefined,
      );
      const occurredAt = new Date().toISOString();

      if (verdict.outcome === "pass") {
        const result: ExerciseAttemptResult = {
          correct: false,
          attemptCount: count,
          score: 1,
          maxScore: 1,
          awaitingHostGrade: false,
          hostGrade: {
            passed: true,
            evaluation: "答对了。",
            extensions: [],
            host: "tier-1",
            learnerAnswer: input.answer,
            occurredAt,
          },
        };
        recordAttempt(progress, input, result);
        return result;
      }

      if (verdict.outcome === "undecided" && exercise?.prompt && input.allowMetered === true) {
        try {
          const result = await submitToMeteredService({
            fetchImpl,
            gradingUrl,
            input,
            prompt: exercise.prompt,
            readAccessToken,
            readBalance: options.readBalance,
            attemptCount: count,
          });
          recordAttempt(progress, input, result);
          return result;
        } catch {
          // Tier two is an enhancement. A missing account, configuration,
          // balance or service must leave the learner with the free clue from
          // tier one, not turn an open question into a wall.
        }
      }

      const evaluation =
        verdict.outcome === "undecided"
          ? lesson
            ? failCopy(lesson, exercise?.prompt)
            : verdict.reason
          : lesson
            ? failCopy(lesson, exercise?.prompt)
            : "再想一下，答案就在上面这段里。";
      const result: ExerciseAttemptResult = {
        correct: false,
        attemptCount: count,
        score: 0,
        maxScore: 1,
        awaitingHostGrade: false,
        hostGrade: {
          passed: false,
          evaluation,
          extensions: [],
          host: "tier-1",
          learnerAnswer: input.answer,
          occurredAt,
        },
        meteredEligible: verdict.outcome === "undecided" && Boolean(exercise?.prompt),
      };
      recordAttempt(progress, input, result);
      return result;
    },
  };
}

function recordAttempt(
  progress: ProgressPort | undefined,
  input: Parameters<GradingPort["submitExercise"]>[0],
  result: ExerciseAttemptResult,
): void {
  progress?.recordExerciseAttempt({
    commandId: input.commandId,
    locator: input.locator,
    exerciseId: input.exerciseId,
    contentRevision: input.contentRevision,
    answer: input.answer,
    score: result.score,
    maxScore: result.maxScore,
    hostGrade: result.hostGrade ?? null,
    occurredAt: result.hostGrade?.occurredAt ?? new Date().toISOString(),
  });
}

async function submitToMeteredService(options: {
  readonly fetchImpl: typeof fetch;
  readonly gradingUrl: string | undefined;
  readonly input: Parameters<GradingPort["submitExercise"]>[0];
  readonly prompt: string;
  readonly readAccessToken: () => Promise<string | null>;
  readonly readBalance: (() => Promise<WalletBalance | null>) | undefined;
  readonly attemptCount: number;
}): Promise<ExerciseAttemptResult> {
  const accessToken = await options.readAccessToken();
  if (!accessToken) {
    throw new Error("这道题需要登录后才能使用 AI 语义批改。确定性判题仍然免费；请登录后再试。");
  }
  if (!options.gradingUrl) {
    throw new Error("AI 语义批改服务尚未配置。确定性判题仍然免费；请联系产品管理员完成服务配置。");
  }
  if (!options.readBalance) {
    throw new Error("AI 批改额度暂时读不到。确定性判题仍然免费；请稍后再试。");
  }
  const balance = await options.readBalance();
  if (
    !balance ||
    !hasEnoughPowerUnits(balance.availablePowerUnits, METERED_GRADING_COST_POWER_UNITS)
  ) {
    throw new Error(
      `AI 批改余额不足：还剩 ${balance?.availablePowerUnits ?? "未知"} power units，这次需要 ${METERED_GRADING_COST_POWER_UNITS}。`,
    );
  }

  try {
    const response = await options.fetchImpl(options.gradingUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answer: options.input.answer,
        commandId: options.input.commandId,
        contentRevision: options.input.contentRevision,
        exerciseId: options.input.exerciseId,
        prompt: options.prompt,
      }),
    });
    const body = await readJson<MeteredGradingResponse>(response);
    if (!body.hostGrade || !body.balance) {
      throw new Error("AI 语义批改服务返回了不完整的结果。");
    }
    return {
      correct: false,
      attemptCount: options.attemptCount,
      score: body.hostGrade.passed ? 1 : 0,
      maxScore: 1,
      awaitingHostGrade: false,
      hostGrade: body.hostGrade,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /^(?:AI 批改|登录凭证|计量钱包|这个 commandId|AI 语义批改)/.test(error.message)
    ) {
      throw error;
    }
    throw new Error("AI 语义批改服务暂时不可用，请稍后重试。");
  }
}

async function readMeteredGradingOffer(options: {
  readonly gradingUrl: string | undefined;
  readonly readAccessToken: () => Promise<string | null>;
  readonly readBalance: (() => Promise<WalletBalance | null>) | undefined;
}): Promise<MeteredGradingOffer> {
  let accessToken: string | null;
  try {
    accessToken = await options.readAccessToken();
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    return unavailableOffer({
      title: "AI 语义批改可以选择，但需要登录",
      whyUnavailable:
        "当前没有登录账号，服务端无法把这次计量批改绑定到你的钱包；免费提示仍然可用。",
      futureSupport: "登录后，这里会读取同一个账号的 AI 批改余额，再由你决定是否使用。",
    });
  }
  if (!options.gradingUrl) {
    return unavailableOffer({
      title: "AI 语义批改服务还没接通",
      whyUnavailable:
        "当前交付环境还没有配置线上批改服务；这不是你的答案有问题，免费提示仍然可用。",
      futureSupport: "服务部署后，这里会先展示费用和余额，再让你明确选择是否使用。",
    });
  }
  if (!options.readBalance) {
    return unavailableOffer({
      title: "AI 批改额度暂时读不到",
      whyUnavailable:
        "当前没有可用的钱包读取通道，所以页面不会猜一个余额，也不会直接发起可能扣费的请求。",
      futureSupport: "登录并连接钱包后，这里会显示服务端返回的可用余额。",
    });
  }

  let balance: WalletBalance | null;
  try {
    balance = await options.readBalance();
  } catch {
    balance = null;
  }
  if (!balance) {
    return unavailableOffer({
      title: "AI 批改额度暂时读不到",
      whyUnavailable:
        "当前没有读到服务端钱包余额，所以页面不会把未知余额当成可用，也不会直接发起可能扣费的请求。",
      futureSupport: "钱包服务恢复后，这里会先显示本次费用和你的可用余额。",
    });
  }
  if (!hasEnoughPowerUnits(balance.availablePowerUnits, METERED_GRADING_COST_POWER_UNITS)) {
    return unavailableOffer({
      title: "这次 AI 批改的额度不够",
      availablePowerUnits: balance.availablePowerUnits,
      whyUnavailable: `你的钱包还剩 ${balance.availablePowerUnits} power units，这次约需要 ${METERED_GRADING_COST_POWER_UNITS}；不充值也不影响你查看下面的免费提示。`,
      futureSupport: "充值后重新打开这道题，页面会再次读取余额；免费提示始终可用。",
    });
  }
  return {
    kind: "available",
    costPowerUnits: METERED_GRADING_COST_POWER_UNITS,
    availablePowerUnits: balance.availablePowerUnits,
  };
}

function unavailableOffer(options: {
  readonly title: string;
  readonly whyUnavailable: string;
  readonly futureSupport: string;
  readonly availablePowerUnits?: string;
}): MeteredGradingOffer {
  const explanation: MeteredGradingExplanation = {
    kind: "explanation",
    title: options.title,
    whatItDoes: `它会在确定性判题无法判断的开放题上提供一次结构化 AI 评估，本次约消耗 ${METERED_GRADING_COST_POWER_UNITS} power units。`,
    whyUnavailable: options.whyUnavailable,
    futureSupport: options.futureSupport,
  };
  return {
    kind: "unavailable",
    costPowerUnits: METERED_GRADING_COST_POWER_UNITS,
    availablePowerUnits: options.availablePowerUnits ?? null,
    explanation,
  };
}

function hasEnoughPowerUnits(available: string, required: string): boolean {
  try {
    return BigInt(available) >= BigInt(required);
  } catch {
    return false;
  }
}

/**
 * A clue, not a verdict. Anchoring on the question's own words finds the
 * passage the question came from, which is what a learner who missed actually
 * needs to re-read. A clue built from the answer was a step away from printing
 * it, and the answer is not available here any more — and should not be.
 */
function failCopy(lesson: Lesson, prompt: string | undefined): string {
  if (!prompt) return "再想一下，答案就在上面这段里。";
  const needle = normalise(prompt).slice(0, 5);
  const line = lesson.content
    .split(/\n+/)
    .find((row) => row.includes(needle) && !row.startsWith("```") && row.length > 12);
  if (!line) return "再想一下，答案就在上面这段里。";
  const quoted = line.replace(/[*`]/g, "").trim();
  /*
    「出自真实项目」 is a claim about a repository, so it is only offered when
    one of this lesson's citations actually is one. A 通用课 cites MDN; naming
    a file and a line range it never had would be the wrong kind of confident.
  */
  const evidence = lesson.evidence.find(isRepositoryAnchor);
  const source = evidence
    ? `\n\n出自真实项目：${evidence.sourcePath} 第 ${evidence.lineStart}–${evidence.lineEnd} 行`
    : "";
  return `再看一眼你刚才读过的这句：\n\n> ${quoted}${source}`;
}
