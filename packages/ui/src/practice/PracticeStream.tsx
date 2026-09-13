import { translate } from "../i18n/index.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameAssetIcon, GameButton, GameEmptyState, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  advancePracticeSession,
  idOfPracticeQuestion,
  indexPracticeQuestions,
  rememberPracticeQuestion,
  startPracticeSession,
  unlockPracticeSession,
  type PracticeQuestion,
  type PracticeSession,
} from "@pieai/university-core";

import { ChoiceBlock, type ChoiceBlockExercise } from "../review/ChoiceBlock.js";
import { PracticeRewardPanel, PRACTICE_UNLOCK_HINT } from "./PracticeRewardPanel.js";
import type { PracticeRecentStore } from "./storage.js";

export const PRACTICE_EMPTY_TITLE = translate("ui.practice.practiceStream.copy.还没有可以练的题");

export const PRACTICE_EMPTY_DESCRIPTION = translate(
  "ui.practice.practiceStream.copy.每一条词条自己带着一道判断题-带题的那些会出现在这里",
);

export const PRACTICE_EMPTY_ACTION = translate("ui.practice.practiceStream.copy.去翻翻词条");

export const PRACTICE_INTRO_TITLE = translate("product.practice.roundTitle");

export const PRACTICE_INTRO_DESCRIPTION = translate("product.practice.roundBrief");

export const PRACTICE_INTRO_ACTION = translate("product.practice.freeStart");

/**
 * How many questions this sitting has already got right.
 *
 * The stream is endless, so "第 N 题" without a total is a road with no
 * length. Inventing a denominator would be worse. The sitting already knows
 * how many it has unlocked; that number is honest.
 */
export function practiceSolvedLabel(solved: number): string {
  return translate("ui.practice.practiceStream.copy.本次已答对-value0", { value0: solved });
}

export function sittingSolvedCount(session: PracticeSession): number {
  if (session.currentId === null) return 0;
  return session.unlocked ? session.ordinal : Math.max(0, session.ordinal - 1);
}

function toChoiceBlockExercise(question: PracticeQuestion): ChoiceBlockExercise {
  return {
    id: idOfPracticeQuestion(question),
    prompt: question.exercise.prompt,
    options: question.exercise.options,
    correctOptionId: question.exercise.correctOptionId,
  };
}

/**
 * One question stream serves free practice and optional bounded rounds.
 * Free practice reports solved questions without inventing a denominator.
 * A round reports distinct solved questions; its final explanation stays until
 * the learner chooses to finish. Preparation is only shown before starting.
 *
 * The reward page is a render prop because each collection already has a
 * detail page, and SPEC-0004 forbids a second one. The stream unlocks; the
 * caller says what is behind the lock.
 */
export function PracticeStream<Head = unknown>({
  questions,
  store,
  onBrowse,
  renderReward,
  onFinish,
  introduction,
  extraAction,
}: {
  readonly questions: readonly PracticeQuestion<Head>[];
  readonly store: PracticeRecentStore;
  readonly onBrowse?: () => void;
  readonly renderReward: (question: PracticeQuestion<Head>) => ReactNode;
  readonly onFinish?: () => void;
  /** Prepared by the shared surface; not repeated above an active question. */
  readonly introduction?: ReactNode;
  readonly extraAction?: ReactNode;
}) {
  const indexed = indexPracticeQuestions(questions);
  const bankKey = indexed.ids.join("\0");
  const [session, setSession] = useState<PracticeSession>(() =>
    startPracticeSession(indexed.ids, store.read()),
  );
  const [phase, setPhase] = useState<"intro" | "question" | "complete">("intro");
  const [mode, setMode] = useState<"free" | "round">("free");
  const [solvedIds, setSolvedIds] = useState<readonly string[]>([]);
  const solvedIdsRef = useRef<readonly string[]>([]);
  const roundSize = Math.min(3, indexed.ids.length);
  const seenBank = useRef(bankKey);
  const seenRecent = useRef(store.read().ids.join("\0"));
  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe(() => {
      const next = store.read().ids.join("\0");
      if (next === seenRecent.current) return;
      seenRecent.current = next;
      setSession(startPracticeSession(indexed.ids, store.read()));
      setPhase("intro");
      setMode("free");
      solvedIdsRef.current = [];
      setSolvedIds([]);
    });
  }, [bankKey, store]);
  let sitting = session;
  let currentPhase = phase;
  if (seenBank.current !== bankKey) {
    seenBank.current = bankKey;
    sitting = startPracticeSession(indexed.ids, store.read());
    currentPhase = "intro";
    setSession(sitting);
    setPhase("intro");
    solvedIdsRef.current = [];
    setSolvedIds([]);
    setMode("free");
  }

  const current = sitting.currentId ? (indexed.byId.get(sitting.currentId) ?? null) : null;
  const focusRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (currentPhase === "intro") return;
    // Only an explicit start/next/finish moves focus. An answer or disclosure
    // never jumps the viewport away from the feedback the learner is reading.
    focusRef.current?.focus({ preventScroll: true });
    focusRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [currentPhase, sitting.currentId, sitting.ordinal]);

  function handleSolved() {
    if (
      mode === "round" &&
      sitting.currentId &&
      !solvedIdsRef.current.includes(sitting.currentId)
    ) {
      const completed = [...solvedIdsRef.current, sitting.currentId];
      solvedIdsRef.current = completed;
      setSolvedIds(completed);
      // Include the last question in history even when no Next button is used.
      const recent = rememberPracticeQuestion(store.read(), sitting.currentId);
      seenRecent.current = recent.ids.join("\0");
      store.write(recent);
    }
    setSession((prev) => unlockPracticeSession(prev));
  }

  function handleNext() {
    if (mode === "round" && solvedIdsRef.current.length >= roundSize) {
      setPhase("complete");
      return;
    }
    const remaining =
      mode === "round"
        ? indexed.ids.filter((id) => !solvedIdsRef.current.includes(id))
        : indexed.ids;
    const next = advancePracticeSession(sitting, remaining, store.read());
    seenRecent.current = next.recent.ids.join("\0");
    store.write(next.recent);
    setSession(next.session);
  }

  function start(mode: "free" | "round") {
    solvedIdsRef.current = [];
    setSolvedIds([]);
    setMode(mode);
    setSession(startPracticeSession(indexed.ids, store.read()));
    setPhase("question");
  }

  function finish() {
    setPhase("intro");
    if (onFinish) onFinish();
  }

  if (!current) {
    return (
      <>
        {introduction}
        <GameEmptyState
          className="practice-stream practice-stream--empty"
          title={PRACTICE_EMPTY_TITLE}
          description={PRACTICE_EMPTY_DESCRIPTION}
          action={
            onBrowse ? (
              <GameButton
                variant="primary"
                surface="liquid"
                liquidFinish="glossy"
                className="university-cta"
                type="button"
                onClick={onBrowse}
              >
                {PRACTICE_EMPTY_ACTION}
              </GameButton>
            ) : undefined
          }
        />
        {extraAction}
      </>
    );
  }

  if (currentPhase === "intro") {
    return (
      <>
        {introduction}
        <section
          className="practice-stream"
          aria-label={translate("ui.practice.practiceStream.copy.练习")}
        >
          <GamePanel className="practice-stream__intro" title={PRACTICE_INTRO_TITLE}>
            <p className="practice-stream__intro-copy">{PRACTICE_INTRO_DESCRIPTION}</p>
            <div className="practice-stream__actions">
              <GameButton
                variant="primary"
                surface="liquid"
                liquidFinish="glossy"
                className="university-cta"
                type="button"
                data-practice-round
                onClick={() => start("round")}
              >
                {translate("product.practice.startRound", { count: roundSize })}
              </GameButton>
              <GameButton variant="secondary" static type="button" onClick={() => start("free")}>
                {PRACTICE_INTRO_ACTION}
              </GameButton>
            </div>
          </GamePanel>
        </section>
        {extraAction}
      </>
    );
  }

  if (currentPhase === "complete") {
    return (
      <section
        className="practice-stream"
        data-practice-phase="complete"
        data-practice-round-complete
      >
        <GamePanel>
          <h1 ref={focusRef} tabIndex={-1} data-practice-focus className="practice-stream__heading">
            {translate("product.practice.roundDone")}
          </h1>
          <div className="practice-stream__celebrate" aria-hidden="true">
            <GameAssetIcon icon="trophy" size="xl" />
          </div>
          <p>{translate("product.practice.roundReceipt", { count: solvedIds.length })}</p>
          <div className="practice-stream__actions">
            <GameButton variant="primary" static data-practice-finish onClick={finish}>
              {translate("product.practice.stop")}
            </GameButton>
            <GameButton variant="secondary" static onClick={() => start("free")}>
              {translate("product.practice.free")}
            </GameButton>
            <GameButton variant="ghost" static onClick={() => start("round")}>
              {translate("product.practice.another")}
            </GameButton>
          </div>
        </GamePanel>
      </section>
    );
  }

  return (
    <section
      className="practice-stream"
      data-practice-phase="question"
      aria-label={translate("ui.practice.practiceStream.copy.练习")}
    >
      <header className="practice-stream__head">
        <h1 ref={focusRef} tabIndex={-1} data-practice-focus className="practice-stream__heading">
          {translate("ui.practice.practiceStream.copy.练习")}
        </h1>
        <GameButton variant="ghost" static onClick={finish}>
          {translate("product.practice.pause")}
        </GameButton>
      </header>
      <div className="practice-stream__progress">
        <p className="practice-stream__ordinal" aria-live="polite">
          {mode === "round"
            ? translate("product.practice.roundCount", {
                done: solvedIds.length,
                total: roundSize,
              })
            : practiceSolvedLabel(sittingSolvedCount(sitting))}
        </p>
        {mode === "round" ? (
          <div className="practice-stream__steps" aria-hidden="true">
            {Array.from({ length: roundSize }, (_, index) => (
              <span key={index} data-done={index < solvedIds.length}>
                {index < solvedIds.length ? "✓" : index + 1}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="practice-stream__columns">
        <div className="practice-stream__question">
          <ChoiceBlock
            key={`${sitting.ordinal}:${sitting.currentId}`}
            exercise={toChoiceBlockExercise(current)}
            liquidPrimary
            onSolved={handleSolved}
            onNext={handleNext}
            nextLabel={
              mode === "round" && solvedIds.length >= roundSize
                ? translate("product.practice.finishRound")
                : undefined
            }
          />
        </div>
        {sitting.unlocked ? (
          <details
            key={sitting.currentId}
            className="product-details practice-stream__reward"
            data-practice-reward
          >
            <summary>{translate("product.practice.readEntry")}</summary>
            <PracticeRewardPanel unlocked>{renderReward(current)}</PracticeRewardPanel>
          </details>
        ) : (
          <p className="practice-stream__unlock-hint">{PRACTICE_UNLOCK_HINT}</p>
        )}
      </div>
    </section>
  );
}
