import { useEffect, useRef, useState } from "react";
import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  exerciseGradeOutcome,
  freeGradingRemainingText,
  gradingAttemptText,
  METERED_GRADING_COST_POWER_UNITS,
  DETERMINISTIC_GRADER_HOST,
  graderLabel,
  walletGradingBalanceText,
} from "@pieai/university-core";
import type {
  CoachingPacket,
  ExerciseAttemptResult,
  GradingPort,
  HostExerciseGrade,
  MeteredGradingExplanation,
  MeteredGradingOffer,
} from "@pieai/university-core";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { STALE_TOKEN_NOTICE, isStaleTokenFailure } from "../api/client.js";
import { CapabilityExplanation } from "../capability/CapabilityExplanation.js";
import {
  DEFAULT_AI_ENTITLEMENTS,
  openTutoringExplanation,
  openTutoringReadFailureExplanation,
  type EntitlementReader,
} from "../capability/ai-entitlements.js";
import type { LessonRef, LessonView } from "../view/lesson-view.js";
import {
  answerDraftIdentityKey,
  type AnswerDraftIdentity,
  type AnswerDraftStorage,
} from "./answer-draft.js";
import { useAnswerDraft } from "./use-answer-draft.js";
import { activeLocale, translate, type MessageKey } from "../i18n/index.js";

/**
 * How long the page keeps watching for a host grade on its own. Past this the
 * learner is no longer waiting on an assistant that is about to answer, and a
 * page that polls forever is a page that never stops. Returning to the tab
 * still refreshes immediately.
 */
const HOST_GRADE_POLL_LIMIT_MS = 10 * 60 * 1000;

const meteredOfferReadFailure = (): MeteredGradingOffer => ({
  kind: "unavailable",
  costPowerUnits: METERED_GRADING_COST_POWER_UNITS,
  availablePowerUnits: null,
  explanation: {
    kind: "explanation",
    title: translate("grading.offer.readFailureTitle"),
    whatItDoes: translate("grading.offer.readFailureWhat"),
    whyUnavailable: translate("grading.offer.readFailureReason"),
    futureSupport: translate("grading.offer.readFailureFuture"),
  },
});

interface ExerciseBlockProps {
  readonly locator: LessonRef;
  readonly exercise: LessonView["lesson"]["exercises"][number];
  readonly grading: GradingPort;
  /** Reads the server-selected AI plan before an open tutoring request. */
  readonly readEntitlements?: EntitlementReader;
  /** Account/user id projection; local guests deliberately share one stable scope. */
  readonly answerDraftScope?: string;
  /** Test seam. Undefined resolves browser storage; null means unavailable. */
  readonly answerDraftStorage?: AnswerDraftStorage | null;
  /**
   * Reloads campus data after a submission or a host write-back. Completion is
   * owned by the explicit lesson confirmation endpoint, never by rendering a
   * passed exercise.
   */
  readonly onRefresh: () => Promise<void>;
}

export function ExerciseBlock(props: ExerciseBlockProps) {
  const draftIdentity: AnswerDraftIdentity = {
    accountScope: props.answerDraftScope ?? "local-guest",
    locator: props.locator,
    exerciseId: props.exercise.id,
    contentRevision: props.exercise.contentRevision,
  };
  return (
    <ExerciseBlockSession
      key={answerDraftIdentityKey(draftIdentity)}
      {...props}
      draftIdentity={draftIdentity}
    />
  );
}

function ExerciseBlockSession({
  locator,
  exercise,
  grading,
  readEntitlements,
  onRefresh,
  answerDraftStorage,
  draftIdentity,
}: ExerciseBlockProps & { readonly draftIdentity: AnswerDraftIdentity }) {
  /**
   * The answer the server already has, or the one being typed now.
   *
   * `hostGrade.learnerAnswer` is the fallback because a grade written back
   * through the CLI carries the answer it judged even when the submission row
   * predates it.
   */
  const storedAnswer = exercise.latestSubmission?.answer ?? exercise.hostGrade?.learnerAnswer ?? "";
  const { answer, setAnswer, persistence, markSubmitted, discardDraft } = useAnswerDraft({
    identity: draftIdentity,
    submittedAnswer: storedAnswer,
    submittedAt: exercise.latestSubmission?.occurredAt ?? exercise.hostGrade?.occurredAt ?? null,
    ...(answerDraftStorage === undefined ? {} : { storage: answerDraftStorage }),
  });
  const [result, setResult] = useState<ExerciseAttemptResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packetCopied, setPacketCopied] = useState(false);
  const [packetCopyFailed, setPacketCopyFailed] = useState(false);
  const [packetInfo, setPacketInfo] = useState<CoachingPacket | null>(null);
  const [expressionCopied, setExpressionCopied] = useState(false);
  const [expressionPending, setExpressionPending] = useState(false);
  const [expressionExplanation, setExpressionExplanation] =
    useState<ReturnType<typeof openTutoringExplanation>>(null);
  const [hostGrade, setHostGrade] = useState<HostExerciseGrade | null>(exercise.hostGrade ?? null);
  const [meteredOffer, setMeteredOffer] = useState<MeteredGradingOffer | null>(null);
  const [meteredOfferLoading, setMeteredOfferLoading] = useState(false);
  const [meteredChoice, setMeteredChoice] = useState<"tier-1" | "free-ai" | "wallet-ai" | null>(
    null,
  );
  const [meteredExplanation, setMeteredExplanation] = useState<MeteredGradingExplanation | null>(
    null,
  );
  /**
   * A passed exercise is read-only until the learner asks for it back. Locking
   * it forever was the wrong end of the trade: rehearsing an answer you already
   * got right is how it sticks, and passing is recorded once — re-answering
   * cannot take the pass away.
   */
  const [reopened, setReopened] = useState(false);
  const isExplain = exercise.kind === "explain";
  const currentOutcome = hostGrade ? exerciseGradeOutcome(hostGrade) : null;
  const [passedOnce, setPassedOnce] = useState(
    exercise.hasPassed === true || currentOutcome === "pass",
  );
  const solved = passedOnce && !reopened;

  useEffect(() => {
    setHostGrade(exercise.hostGrade ?? null);
    if (
      exercise.hasPassed === true ||
      (exercise.hostGrade && exerciseGradeOutcome(exercise.hostGrade) === "pass")
    ) {
      setPassedOnce(true);
    }
  }, [exercise.id, exercise.contentRevision, exercise.hostGrade]);

  useEffect(() => {
    if (result?.meteredEligible !== true || hostGrade?.host !== "tier-1") {
      setMeteredOffer(null);
      setMeteredOfferLoading(false);
      return;
    }
    let cancelled = false;
    setMeteredOfferLoading(true);
    void grading
      .meteredGradingOffer()
      .then((offer) => {
        if (cancelled) return;
        setMeteredOffer(offer);
      })
      .catch(() => {
        if (cancelled) return;
        setMeteredOffer(meteredOfferReadFailure());
      })
      .finally(() => {
        if (!cancelled) setMeteredOfferLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.contentRevision, grading, hostGrade?.host, result?.meteredEligible]);

  useEffect(() => {
    if (!packetCopied) return;
    const timer = setTimeout(() => setPacketCopied(false), 8_000);
    return () => clearTimeout(timer);
  }, [packetCopied]);

  /**
   * Where the host grade stood when this answer was submitted. Polling stops
   * when a grade newer than this arrives — including a failing one, which is
   * feedback the learner came back for just as much as a pass.
   */
  const [gradeWatermark, setGradeWatermark] = useState<string | null>(null);
  useEffect(() => {
    setGradeWatermark(null);
  }, [exercise.id, exercise.contentRevision]);
  const awaitingGrade = gradeWatermark !== null && (hostGrade?.occurredAt ?? "") <= gradeWatermark;

  // `onRefresh` is rebuilt on every render of the campus, so depending on it
  // here would clear and restart the timer before it could ever fire.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!awaitingGrade) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      await refreshRef.current().catch(() => undefined);
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= HOST_GRADE_POLL_LIMIT_MS) return;
      // Quick at first to catch a fast write-back, then slower so a long wait
      // does not spend ten minutes hammering the local API.
      timer = setTimeout(() => void poll(), elapsed < 60_000 ? 3_000 : 10_000);
    };
    timer = setTimeout(() => void poll(), 3_000);

    // The learner is in the assistant's window while it grades, so a hidden tab
    // is the normal case here rather than a reason to stop. Coming back is the
    // moment the answer should already be on screen.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshRef.current().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [awaitingGrade]);

  async function copyExpressionPacket() {
    setExpressionPending(true);
    setExpressionExplanation(null);
    setError(null);
    try {
      let ai = DEFAULT_AI_ENTITLEMENTS;
      if (readEntitlements) {
        const result = await readEntitlements();
        if (result.kind === "explanation") {
          setExpressionExplanation(openTutoringReadFailureExplanation(result));
          return;
        }
        ai = result.value.ai;
      }

      const unavailable = openTutoringExplanation(ai);
      if (unavailable) {
        setExpressionExplanation(unavailable);
        return;
      }

      if (!grading.expressionPacket) {
        setExpressionExplanation({
          kind: "explanation",
          title: translate("grading.expression.unavailableTitle"),
          whatItDoes: translate("grading.expression.whatItDoes"),
          whyUnavailable: translate("grading.expression.whyUnavailable"),
          futureSupport: translate("grading.expression.futureSupport"),
        });
        return;
      }

      const body = await grading.expressionPacket(locator.studyId);
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(body.packet);
      setExpressionCopied(true);
      setTimeout(() => setExpressionCopied(false), 8_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : translate("grading.expression.failed"));
    } finally {
      setExpressionPending(false);
    }
  }

  async function copyCoachingPacket() {
    if (!grading.coachingPacket) return;
    try {
      const body = await grading.coachingPacket({ locator, exerciseId: exercise.id });
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(body.packet);
      setPacketInfo(body);
      setPacketCopied(true);
      setPacketCopyFailed(false);
    } catch {
      setPacketCopied(false);
      setPacketCopyFailed(true);
    }
  }

  async function submit(allowMetered = false, funding: "free" | "wallet" = "wallet") {
    const submittedAnswer = answer;
    setPending(true);
    setError(null);
    setPacketCopied(false);
    setPacketCopyFailed(false);
    setPacketInfo(null);
    setResult(null);
    setMeteredOffer(null);
    setMeteredChoice(allowMetered ? (funding === "free" ? "free-ai" : "wallet-ai") : null);
    try {
      const body: ExerciseAttemptResult = await grading.submitExercise({
        locator,
        exerciseId: exercise.id,
        contentRevision: exercise.contentRevision,
        answer: submittedAnswer,
        commandId: crypto.randomUUID(),
        allowMetered,
        meteredFunding: allowMetered ? funding : undefined,
      });
      setResult(body);
      if (body.hostGrade) {
        setHostGrade(body.hostGrade);
        if (exerciseGradeOutcome(body.hostGrade) === "pass") setPassedOnce(true);
      }
      if (passedOnce || (body.hostGrade && exerciseGradeOutcome(body.hostGrade) === "pass")) {
        setReopened(false);
      }
      if (allowMetered && body.hostGrade?.host !== "tier-2") setMeteredChoice("tier-1");
      setGradeWatermark(
        body.awaitingHostGrade === true ? (body.hostGrade?.occurredAt ?? "") : null,
      );
      if (body.answerStored !== false) markSubmitted(submittedAnswer);
      else setError(translate("grading.answer.saveFailed"));
      await onRefresh();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : translate("grading.answer.submitFailed");
      setError(isStaleTokenFailure(message) ? STALE_TOKEN_NOTICE : message);
      if (isStaleTokenFailure(message)) await onRefresh().catch(() => undefined);
    } finally {
      setPending(false);
    }
  }

  async function refreshHostGrade() {
    setPending(true);
    setError(null);
    try {
      await onRefresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : translate("grading.result.refreshFailed"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="exercise-panel" title={exercise.title}>
      <div className="exercise-prompt">
        <MarkdownContent>{exercise.prompt}</MarkdownContent>
      </div>
      <label className="answer-field">
        <span>{translate("grading.answer.label")}</span>
        <textarea
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setResult(null);
            setMeteredOffer(null);
            setMeteredChoice(null);
            setPacketCopied(false);
            setPacketCopyFailed(false);
          }}
          placeholder={
            isExplain
              ? grading.coachingPacket
                ? translate("grading.answer.explainHost")
                : translate("grading.answer.explain")
              : grading.coachingPacket
                ? translate("grading.answer.shortHost")
                : translate("grading.answer.short")
          }
          rows={isExplain ? 6 : 3}
          readOnly={solved || pending}
        />
      </label>
      {answer.trim() && persistence === "saved" ? (
        <p className="answer-field__draft-status" role="status">
          {translate("product.feedback.draftSaved")}
        </p>
      ) : persistence === "unavailable" ? (
        <p className="answer-field__draft-status answer-field__draft-status--warning" role="status">
          {translate("grading.answer.storageUnavailable")}
        </p>
      ) : persistence === "failed" ? (
        <p className="answer-field__draft-status answer-field__draft-status--warning" role="status">
          {translate("grading.answer.draftFailed")}
        </p>
      ) : null}
      {exercise.latestSubmission && !result ? (
        <p className="answer-field__saved">
          {translate("grading.answer.submittedAt", {
            date: new Date(exercise.latestSubmission.occurredAt).toLocaleString(activeLocale()),
          })}
        </p>
      ) : null}

      <div className="exercise-actions">
        <GameButton
          variant="primary"
          onClick={() => void submit()}
          disabled={!answer.trim() || pending || solved}
        >
          {/* 「判」 alone is not a verb you can end a Chinese sentence on, and
              this is the primary action of every lesson in the product. */}
          {/*
            The grading port may copy an authoring answer to an AI host while
            delivery submits it to its metered grader. That is an implementation
            boundary, not a second learner surface: the button says what the
            learner is doing in both campuses.
          */}
          {pending
            ? translate("grading.answer.submitting")
            : solved
              ? translate("grading.answer.completed")
              : reopened
                ? translate("grading.answer.resubmit")
                : translate("grading.answer.submit")}
        </GameButton>
        {passedOnce ? (
          <GameButton
            variant="ghost"
            onClick={() => {
              // Leaving the reopen restores what the server holds, so backing
              // out cannot be the thing that loses the saved answer.
              if (reopened) discardDraft(storedAnswer);
              setReopened(!reopened);
              setResult(null);
            }}
            disabled={pending}
          >
            {reopened ? translate("grading.answer.cancelRetry") : translate("grading.answer.retry")}
          </GameButton>
        ) : null}
        {/*
          Why the button is dead.

          A lesson cannot be completed without answering its exercise, so this
          is where a learner arrives to finish — and finds the one button on the
          panel greyed out, at a contrast the kit reserves for disabled
          controls, with nothing saying what would wake it. The gate itself is
          right: the whole point of the exercise is that you write the answer
          before an AI sees it. It just has to be a gate the reader can see the
          latch on.
        */}
        {!answer.trim() && !solved && !pending ? (
          <span className="exercise-actions__hint">{translate("grading.answer.emptyHint")}</span>
        ) : null}
      </div>

      {result && hostGrade === null && grading.coachingPacket ? (
        <GameCallout
          heading={translate("grading.result.awaitingTitle")}
          tone="warning"
          role="status"
        >
          {awaitingGrade
            ? translate("grading.result.awaitingRefresh")
            : translate("grading.result.awaitingInstructions")}
        </GameCallout>
      ) : null}

      {result?.meteredExplanation ? (
        <GameCallout heading={result.meteredExplanation.title} tone="warning" role="status">
          <div className="metered-grading-choice__copy">
            <p>{result.meteredExplanation.whyUnavailable}</p>
            <p>{result.meteredExplanation.futureSupport}</p>
            {result.meteredExplanation.action ? (
              <p>
                <a href={result.meteredExplanation.action.href}>
                  {result.meteredExplanation.action.label}
                </a>
              </p>
            ) : null}
          </div>
        </GameCallout>
      ) : null}

      {result?.meteredFreeQuota || result?.meteredBalance ? (
        <GameCallout heading={translate("grading.quota.afterTitle")} tone="neutral" role="status">
          {result.meteredFreeQuota ? (
            <p>
              {emphasizedGradingCopy("grading.quota.usedFree", {
                remaining: freeGradingRemainingText(
                  result.meteredFreeQuota.remainingPowerUnits,
                  activeLocale(),
                ),
              })}
            </p>
          ) : result.meteredBalance ? (
            <p>
              {emphasizedGradingCopy("grading.quota.usedWallet", {
                balance: walletGradingBalanceText(
                  result.meteredBalance.availablePowerUnits,
                  activeLocale(),
                ),
              })}
            </p>
          ) : null}
        </GameCallout>
      ) : null}

      {hostGrade ? (
        <div
          className={`host-grade host-grade--${currentOutcome ?? "undecided"}`}
          role="region"
          aria-label={translate("grading.result.region", {
            grader: graderLabel(hostGrade.host, activeLocale()),
          })}
        >
          <p className="host-grade__summary" data-grade-summary role="status">
            <span className="host-grade__mark" aria-hidden="true">
              {currentOutcome === "pass" ? "✓" : currentOutcome === "fail" ? "↻" : "?"}
            </span>
            {translate(
              currentOutcome === "pass"
                ? "product.feedback.pass"
                : currentOutcome === "fail"
                  ? "product.feedback.fail"
                  : "product.feedback.undecided",
            )}
          </p>
          <details className="product-details" data-grade-details>
            <summary>
              {translate(
                currentOutcome === "pass"
                  ? "product.feedback.explanation"
                  : "product.feedback.hint",
              )}
            </summary>
            <p className="host-grade__eyebrow">
              {graderLabel(hostGrade.host, activeLocale())} · {gradeOutcomeLabel(currentOutcome)}
              {/* Naming the model that read the answer is useful; repeating our
                internal tier name after "当场判定" is just jargon on a page a
                beginner is reading. */}
              {hostGrade.host && hostGrade.host !== DETERMINISTIC_GRADER_HOST
                ? ` · ${hostGrade.host}`
                : ""}
            </p>
            <div className="host-grade__body markdown-body">
              <MarkdownContent>{hostGrade.evaluation}</MarkdownContent>
            </div>
            {hostGrade.extensions.length > 0 ? (
              <div className="host-grade__extensions">
                <p className="eyebrow">{translate("grading.result.extensions")}</p>
                <ul>
                  {hostGrade.extensions.map((item) => (
                    // Same Markdown treatment the evaluation above gets. An
                    // assistant writing about `pnpm dev` naturally reaches for
                    // backticks, and rendering them raw here made the two halves
                    // of one answer look like they came from different products.
                    <li key={item} className="markdown-body">
                      <MarkdownContent>{item}</MarkdownContent>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {isExplain ? (
              <div className="host-grade__coach">
                {/* Grading answered "was it right"; this offers "was it clear". The
                  page only prepares the material — the coaching itself happens in
                  whatever AI host the learner pastes into, same as grading.
                  short-answer exercises have no prose to critique, so the
                  invitation only makes sense where the answer is free text. */}
                <GameButton
                  variant="ghost"
                  onClick={() => void copyExpressionPacket()}
                  disabled={pending || expressionPending}
                >
                  {expressionPending
                    ? translate("grading.expression.checking")
                    : expressionCopied
                      ? translate("grading.expression.copied")
                      : translate("grading.expression.ask")}
                </GameButton>
                {expressionCopied ? (
                  <span className="host-grade__coach-hint">
                    {translate("grading.expression.instructions")}
                  </span>
                ) : null}
              </div>
            ) : null}
          </details>
        </div>
      ) : null}

      {result?.meteredEligible ? (
        <details
          className="product-details metered-grading-choice"
          aria-label={translate("grading.quota.choices")}
        >
          <summary>{translate("product.feedback.askAi")}</summary>
          {meteredOfferLoading ? (
            <GameCallout
              heading={translate("grading.quota.loadingTitle")}
              tone="neutral"
              role="status"
            >
              {translate("grading.quota.loading")}
            </GameCallout>
          ) : meteredOffer?.kind === "free" ? (
            <GameCallout
              heading={translate("grading.quota.freeTitle")}
              tone="neutral"
              role="region"
            >
              <div className="metered-grading-choice__copy">
                <p>
                  {emphasizedGradingCopy("grading.quota.freeOffer", {
                    cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                    remaining: freeGradingRemainingText(
                      meteredOffer.remainingPowerUnits,
                      activeLocale(),
                    ),
                  })}
                </p>
                <p>{translate("grading.quota.freeConsent")}</p>
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  {translate("grading.quota.freeHintSelected")}
                </p>
              ) : meteredChoice === "free-ai" ? (
                <p className="metered-grading-choice__selected" role="status">
                  {translate("grading.quota.freeSelected")}
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="primary"
                  onClick={() => void submit(true, "free")}
                  disabled={pending}
                >
                  {translate("grading.quota.useFree", {
                    cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                  })}
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  {translate("grading.quota.freeHint")}
                </GameButton>
              </div>
            </GameCallout>
          ) : meteredOffer?.kind === "available" ? (
            <GameCallout
              heading={translate("grading.quota.walletTitle")}
              tone="warning"
              role="region"
            >
              <div className="metered-grading-choice__copy">
                {meteredOffer.freeQuotaExhausted ? (
                  <p>
                    {emphasizedGradingCopy("grading.quota.exhaustedWalletOffer", {
                      cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                      balance: walletGradingBalanceText(
                        meteredOffer.availablePowerUnits,
                        activeLocale(),
                      ),
                    })}
                  </p>
                ) : (
                  <p>
                    {emphasizedGradingCopy("grading.quota.walletOffer", {
                      cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                      balance: walletGradingBalanceText(
                        meteredOffer.availablePowerUnits,
                        activeLocale(),
                      ),
                    })}
                  </p>
                )}
                <p>{translate("grading.quota.walletConsent")}</p>
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  {translate("grading.quota.walletHintSelected")}
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="primary"
                  onClick={() => void submit(true, "wallet")}
                  disabled={pending}
                >
                  {translate("grading.quota.useWallet", {
                    cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                  })}
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  {translate("grading.quota.walletHint")}
                </GameButton>
              </div>
            </GameCallout>
          ) : meteredOffer ? (
            <GameCallout heading={meteredOffer.explanation.title} tone="neutral" role="status">
              <div className="metered-grading-choice__copy">
                <p>
                  {translate("grading.quota.unavailableOffer", {
                    cost: meteredOffer.freeQuotaExhausted
                      ? translate("grading.quota.exhausted")
                      : translate("grading.quota.attemptCost", {
                          cost: gradingAttemptText(meteredOffer.costPowerUnits, activeLocale()),
                        }),
                    balance:
                      meteredOffer.availablePowerUnits !== null
                        ? translate("grading.quota.balance", {
                            balance: walletGradingBalanceText(
                              meteredOffer.availablePowerUnits,
                              activeLocale(),
                            ),
                          })
                        : translate("grading.quota.balanceUnavailable"),
                  })}
                </p>
                <p>{meteredOffer.explanation.whyUnavailable}</p>
                {meteredOffer.explanation.action ? (
                  <p>
                    <a href={meteredOffer.explanation.action.href}>
                      {meteredOffer.explanation.action.label}
                    </a>
                  </p>
                ) : null}
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  {translate("grading.quota.walletHintSelected")}
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="secondary"
                  onClick={() => setMeteredExplanation(meteredOffer.explanation)}
                >
                  {translate("grading.quota.details")}
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  {translate("grading.quota.walletHint")}
                </GameButton>
              </div>
            </GameCallout>
          ) : null}
        </details>
      ) : null}

      {result && currentOutcome !== "pass" && grading.coachingPacket ? (
        <div
          className="coaching-packet"
          role="region"
          aria-label={translate("grading.packet.region")}
        >
          <p className="coaching-packet__status">
            {packetCopied
              ? translate("grading.packet.copied")
              : packetCopyFailed
                ? translate("grading.packet.copyFailed")
                : translate("grading.packet.copyInstructions")}
          </p>
          {packetCopied && packetInfo ? (
            // An assistant in a fresh chat cannot open the repository, so the
            // packet carries the cited code with it. Saying so is what stops
            // the learner from wondering whether the AI is judging blind.
            <p className="coaching-packet__contents">
              {translate(
                packetInfo.referenceDisclosed
                  ? "grading.packet.contentsWithAnswer"
                  : "grading.packet.contentsWithoutAnswer",
                {
                  count: packetInfo.evidenceCount,
                  omitted:
                    packetInfo.evidenceOmitted > 0
                      ? translate("grading.packet.omitted", { count: packetInfo.evidenceOmitted })
                      : "",
                },
              )}
            </p>
          ) : null}
          <ol className="coaching-packet__steps">
            <li>{translate("grading.packet.openAssistant")}</li>
            <li>{translate("grading.packet.paste")}</li>
            <li>{translate("grading.packet.writeBack")}</li>
            <li>{translate("grading.packet.return")}</li>
          </ol>
          <div className="coaching-packet__actions">
            <GameButton
              variant="secondary"
              onClick={() => void copyCoachingPacket()}
              disabled={pending}
            >
              {packetCopied
                ? translate("grading.packet.copyAgain")
                : translate("grading.packet.copy")}
            </GameButton>
            {/* The page polls on its own; this stays as the escape hatch for a
                write-back that lands after polling has given up. */}
            <GameButton variant="ghost" onClick={() => void refreshHostGrade()} disabled={pending}>
              {awaitingGrade
                ? translate("grading.result.waitAndRefresh")
                : translate("grading.result.refresh")}
            </GameButton>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}

      {expressionExplanation ? (
        <CapabilityExplanation
          explanation={expressionExplanation}
          onClose={() => setExpressionExplanation(null)}
        />
      ) : null}

      {meteredExplanation ? (
        <CapabilityExplanation
          explanation={meteredExplanation}
          onClose={() => setMeteredExplanation(null)}
        />
      ) : null}
    </GamePanel>
  );
}

function gradeOutcomeLabel(outcome: "pass" | "fail" | "undecided" | null): string {
  if (outcome === "pass") return translate("grading.result.pass");
  if (outcome === "fail") return translate("grading.result.fail");
  return translate("grading.result.undecided");
}

/** Keep the original emphasis while letting each language order the whole sentence. */
function emphasizedGradingCopy(key: MessageKey, values: Readonly<Record<string, string>>) {
  return translate(key)
    .split(/(\{\{\w+\}\})/)
    .map((part, index) => {
      const value = values[part.slice(2, -2)];
      return part.startsWith("{{") && value !== undefined ? (
        <strong key={index}>{value}</strong>
      ) : (
        part
      );
    });
}
