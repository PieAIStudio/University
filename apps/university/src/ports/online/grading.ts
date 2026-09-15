/**
 * The delivery shell's GradingPort: tier one, in the browser, no clipboard.
 *
 * The honesty from the previous delivery-only quiz stays: a sentence the
 * fingerprint cannot judge is not marked wrong, and a clue is a sentence the
 * learner already read, never the answer.
 */
import {
  DETERMINISTIC_GRADER_HOST,
  exerciseGradeOutcome,
  gradingAttemptText,
  lessonRefKey,
  METERED_GRADING_COST_POWER_UNITS,
  gradeDeterministically,
  proseQuote,
  toPath,
  type AnswerKey,
  type ExerciseAttemptResult,
  type GradingPort,
  type LessonRef,
  type MeteredGradingExplanation,
  type MeteredGradingOffer,
  type MeteredGradingResponse,
  type ProgressPort,
} from "@pieai/university-core";
import { readJson } from "@pieai/university-ui/api/client.js";
import { activeLocale, translate } from "@pieai/university-ui/i18n.js";

import { isRepositoryAnchor, peekCourse } from "../../content/library";
import type { Lesson } from "../../content/library";
import { normalise } from "../../lesson/grading";

class MeteredRequestDeclinedError extends Error {
  readonly explanation: MeteredGradingExplanation;

  constructor(explanation: MeteredGradingExplanation) {
    super(explanation.whyUnavailable);
    this.name = "MeteredRequestDeclinedError";
    this.explanation = explanation;
  }
}

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
  readonly gradingUrl?: string;
  readonly fetchImpl?: typeof fetch;
}): GradingPort {
  const { progress } = options;
  const attempts = new Map<string, number>();
  const readAccessToken = options.readAccessToken ?? (async () => null);
  // `Window.fetch` is a method in real browsers. Passing it around unbound
  // works in some test doubles but throws `Illegal invocation` in Chromium,
  // which used to make a healthy grading endpoint look unavailable.
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const gradingUrl =
    options.gradingUrl?.trim() || import.meta.env.VITE_UNIVERSITY_GRADING_URL?.trim();

  return {
    async meteredGradingOffer() {
      return readMeteredGradingOffer({
        gradingUrl,
        readAccessToken,
        fetchImpl,
      });
    },

    async submitExercise(input) {
      const accountScope = progress?.syncState().userId ?? null;
      const saveResult = (result: ExerciseAttemptResult) => {
        if ((progress?.syncState().userId ?? null) !== accountScope) {
          throw new Error(translate("grading.account.changedBeforeSave"));
        }
        return recordAttempt(progress, input, result);
      };
      const lesson = lessonAt(input.locator);
      const exercise = lesson?.exercises.find((item) => item.id === input.exerciseId);
      const attemptKey = `${accountScope ?? "local-guest"}\u0000${lessonRefKey(input.locator)}\u0000${input.exerciseId}\u0000${input.contentRevision}`;
      const count = (attempts.get(attemptKey) ?? 0) + 1;
      attempts.set(attemptKey, count);
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
            outcome: "pass",
            passed: true,
            evaluation: translate("grading.result.correct"),
            extensions: [],
            host: DETERMINISTIC_GRADER_HOST,
            learnerAnswer: input.answer,
            occurredAt,
          },
        };
        return saveResult(result);
      }

      if (verdict.outcome === "undecided" && exercise?.prompt && input.allowMetered === true) {
        try {
          const result = await submitToMeteredService({
            fetchImpl,
            gradingUrl,
            input,
            prompt: exercise.prompt,
            readAccessToken: async () => {
              const token = await readAccessToken();
              // Check before sending, not only before storing the response.
              // A token resolved during account switching may belong to someone else.
              if ((progress?.syncState().userId ?? null) !== accountScope) {
                throw new Error(translate("grading.account.changedBeforeSend"));
              }
              return token;
            },
            attemptCount: count,
          });
          return saveResult(result);
        } catch (error) {
          if (error instanceof MeteredRequestDeclinedError) {
            const evaluation = undecidedCopy(lesson, exercise?.prompt, verdict.reason);
            const result: ExerciseAttemptResult = {
              correct: false,
              attemptCount: count,
              score: 0,
              maxScore: 1,
              awaitingHostGrade: false,
              hostGrade: {
                outcome: "undecided",
                passed: false,
                evaluation,
                extensions: [],
                host: DETERMINISTIC_GRADER_HOST,
                learnerAnswer: input.answer,
                occurredAt,
              },
              meteredEligible: false,
              meteredExplanation: error.explanation,
            };
            return saveResult(result);
          }
          // Tier two is an enhancement. A missing account, configuration,
          // balance or service must leave the learner with the free clue from
          // tier one, not turn an open question into a wall. Quota exhaustion is
          // handled above because it is an actionable membership boundary.
        }
      }

      const evaluation =
        verdict.outcome === "undecided"
          ? undecidedCopy(lesson, exercise?.prompt, verdict.reason)
          : lesson
            ? failCopy(lesson, exercise?.prompt)
            : translate("grading.hint.tryAgain");
      const result: ExerciseAttemptResult = {
        correct: false,
        attemptCount: count,
        score: 0,
        maxScore: 1,
        awaitingHostGrade: false,
        hostGrade: {
          outcome: verdict.outcome,
          passed: false,
          evaluation,
          extensions: [],
          host: DETERMINISTIC_GRADER_HOST,
          learnerAnswer: input.answer,
          occurredAt,
        },
        meteredEligible: verdict.outcome === "undecided" && Boolean(exercise?.prompt),
      };
      return saveResult(result);
    },
  };
}

function recordAttempt(
  progress: ProgressPort | undefined,
  input: Parameters<GradingPort["submitExercise"]>[0],
  result: ExerciseAttemptResult,
): ExerciseAttemptResult {
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
  return { ...result, answerStored: progress?.localSaveState?.() === "saved" };
}

async function submitToMeteredService(options: {
  readonly fetchImpl: typeof fetch;
  readonly gradingUrl: string | undefined;
  readonly input: Parameters<GradingPort["submitExercise"]>[0];
  readonly prompt: string;
  readonly readAccessToken: () => Promise<string | null>;
  readonly attemptCount: number;
}): Promise<ExerciseAttemptResult> {
  const accessToken = await options.readAccessToken();
  if (!accessToken) {
    throw new Error(translate("grading.request.signIn"));
  }
  if (!options.gradingUrl) {
    throw new Error(translate("grading.request.notConfigured"));
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
        funding: options.input.meteredFunding ?? "wallet",
      }),
    });
    const body = await readMeteredResponse(response);
    if (!body.hostGrade) {
      throw new Error(translate("grading.request.incomplete"));
    }
    const hostGrade = withExplicitOutcome(body.hostGrade);
    return {
      correct: false,
      attemptCount: options.attemptCount,
      score: exerciseGradeOutcome(hostGrade) === "pass" ? 1 : 0,
      maxScore: 1,
      awaitingHostGrade: false,
      hostGrade,
      meteredFunding: body.funding,
      ...(body.balance ? { meteredBalance: body.balance } : {}),
      ...(body.freeQuota ? { meteredFreeQuota: body.freeQuota } : {}),
    };
  } catch (error) {
    if (error instanceof MeteredRequestDeclinedError) throw error;
    if (
      error instanceof Error &&
      /^(?:AI 批改|登录凭证|AI 批改钱包|这个 commandId|AI 语义批改)/.test(error.message)
    ) {
      throw error;
    }
    throw new Error(translate("grading.request.unavailable"));
  }
}

function withExplicitOutcome(
  grade: MeteredGradingResponse["hostGrade"],
): MeteredGradingResponse["hostGrade"] {
  return { ...grade, outcome: exerciseGradeOutcome(grade) };
}

async function readMeteredResponse(response: Response): Promise<MeteredGradingResponse> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(translate("grading.request.failed", { status: response.status }));
  }

  if (!response.ok) {
    if (isRecord(body)) {
      if (isMeteredGradingExplanation(body.explanation)) {
        throw new MeteredRequestDeclinedError(body.explanation);
      }
      if (body.code === "free_quota_exhausted") {
        throw new MeteredRequestDeclinedError(quotaExhaustedExplanation(stringField(body.error)));
      }
      if (body.code === "free_quota_unavailable") {
        throw new MeteredRequestDeclinedError(quotaUnavailableExplanation(stringField(body.error)));
      }
    }
    throw new Error(
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : translate("grading.request.failed", { status: response.status }),
    );
  }

  return body as MeteredGradingResponse;
}

function quotaExhaustedExplanation(message: string): MeteredGradingExplanation {
  return {
    kind: "explanation",
    title: translate("grading.quota.exhaustedTitle"),
    whatItDoes: translate("grading.quota.whatItDoes"),
    whyUnavailable: message || translate("grading.quota.exhausted"),
    futureSupport: translate("grading.quota.exhaustedFuture"),
    action: { label: translate("grading.quota.viewPlans"), href: toPath({ kind: "plans" }) },
  };
}

function quotaUnavailableExplanation(message: string): MeteredGradingExplanation {
  return {
    kind: "explanation",
    title: translate("grading.quota.unavailableTitle"),
    whatItDoes: translate("grading.quota.whatItDoes"),
    whyUnavailable: message || translate("grading.quota.unavailableReason"),
    futureSupport: translate("grading.quota.unavailableFuture"),
    action: { label: translate("grading.quota.viewPlans"), href: toPath({ kind: "plans" }) },
  };
}

function isMeteredGradingExplanation(value: unknown): value is MeteredGradingExplanation {
  if (!isRecord(value)) return false;
  if (
    value.kind !== "explanation" ||
    typeof value.title !== "string" ||
    typeof value.whatItDoes !== "string" ||
    typeof value.whyUnavailable !== "string" ||
    typeof value.futureSupport !== "string"
  ) {
    return false;
  }
  return (
    value.action === undefined ||
    (isRecord(value.action) &&
      typeof value.action.label === "string" &&
      typeof value.action.href === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readMeteredGradingOffer(options: {
  readonly gradingUrl: string | undefined;
  readonly readAccessToken: () => Promise<string | null>;
  readonly fetchImpl: typeof fetch;
}): Promise<MeteredGradingOffer> {
  let accessToken: string | null;
  try {
    accessToken = await options.readAccessToken();
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    return unavailableOffer({
      title: translate("grading.offer.signInTitle"),
      whyUnavailable: translate("grading.offer.signInReason"),
      futureSupport: translate("grading.offer.signInFuture"),
    });
  }
  if (!options.gradingUrl) {
    return unavailableOffer({
      title: translate("grading.offer.notConfiguredTitle"),
      whyUnavailable: translate("grading.offer.notConfiguredReason"),
      futureSupport: translate("grading.offer.notConfiguredFuture"),
    });
  }
  try {
    const response = await options.fetchImpl(options.gradingUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const offer = await readJson<MeteredGradingOffer>(response);
    if (offer.kind !== "free" && offer.kind !== "available" && offer.kind !== "unavailable") {
      throw new Error("invalid grading offer");
    }
    return offer;
  } catch {
    return unavailableOffer({
      title: translate("grading.offer.unavailableTitle"),
      whyUnavailable: translate("grading.offer.unavailableReason"),
      futureSupport: translate("grading.offer.unavailableFuture"),
    });
  }
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
    whatItDoes: translate("grading.offer.whatItDoes", {
      cost: gradingAttemptText(METERED_GRADING_COST_POWER_UNITS, activeLocale()),
    }),
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

/**
 * A clue, not a verdict. Anchoring on the question's own words finds the
 * passage the question came from, which is what a learner who missed actually
 * needs to re-read. A clue built from the answer was a step away from printing
 * it, and the answer is not available here any more — and should not be.
 */
function failCopy(lesson: Lesson, prompt: string | undefined): string {
  if (!prompt) return translate("grading.hint.tryAgain");
  const needle = normalise(prompt).slice(0, 5);
  const line = lesson.content
    .split(/\n+/)
    .find((row) => row.includes(needle) && !row.startsWith("```") && row.length > 12);
  if (!line) return translate("grading.hint.tryAgain");
  // Lesson source, not prose: the line can carry `[[evidence:…]]` and other
  // markup, and printing it raw at the moment a learner missed reads as a
  // broken product rather than a broken answer.
  const quoted = proseQuote(line);
  if (quoted.length === 0) return translate("grading.hint.tryAgain");
  /*
    「出自真实项目」 is a claim about a repository, so it is only offered when
    one of this lesson's citations actually is one. A 通用课 cites MDN; naming
    a file and a line range it never had would be the wrong kind of confident.
  */
  const evidence = lesson.evidence.find(isRepositoryAnchor);
  const source = evidence
    ? translate("grading.hint.source", {
        path: evidence.sourcePath,
        start: evidence.lineStart,
        end: evidence.lineEnd,
      })
    : "";
  return translate("grading.hint.quote", { quote: quoted, source });
}

function undecidedCopy(
  lesson: Lesson | undefined,
  prompt: string | undefined,
  reason: string,
): string {
  const hint = lesson ? failCopy(lesson, prompt) : translate("grading.hint.addReasons");
  return [
    translate("grading.result.undecidedExplanation"),
    translate("grading.result.undecidedNext"),
    hint || reason,
  ]
    .filter(Boolean)
    .join("\n\n");
}
