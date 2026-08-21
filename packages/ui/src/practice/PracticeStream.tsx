import { useRef, useState, type ReactNode } from "react";
import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";
import {
  advancePracticeSession,
  idOfPracticeQuestion,
  indexPracticeQuestions,
  startPracticeSession,
  unlockPracticeSession,
  type PracticeQuestion,
  type PracticeSession,
} from "@pieai/university-core";

import { ChoiceBlock, type ChoiceBlockExercise } from "../review/ChoiceBlock.js";
import { PracticeRewardPanel } from "./PracticeRewardPanel.js";
import type { PracticeRecentStore } from "./storage.js";

export const PRACTICE_EMPTY_TITLE = "还没有可以练的题";

export const PRACTICE_EMPTY_DESCRIPTION = "每一条词条自己带着一道判断题。带题的那些会出现在这里。";

export const PRACTICE_EMPTY_ACTION = "去翻翻词条";

export function practiceOrdinalLabel(ordinal: number): string {
  return `第 ${ordinal} 题`;
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
 * The endless single-question stream: one judgement, then the entry as a reward.
 *
 * The counter below is the only number on this surface, and it is session-local.
 * There is no total, no score, no progress bar, and no category filter. That
 * absence is the design, not an omission — a remaining-work bar here would turn
 * "随便刷两题" into a test, which is the settlement screen's job, not this
 * sitting's. Do not add one.
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
}: {
  readonly questions: readonly PracticeQuestion<Head>[];
  readonly store: PracticeRecentStore;
  readonly onBrowse?: () => void;
  readonly renderReward: (question: PracticeQuestion<Head>) => ReactNode;
}) {
  const indexed = indexPracticeQuestions(questions);
  const bankKey = indexed.ids.join("\0");
  const [session, setSession] = useState<PracticeSession>(() =>
    startPracticeSession(indexed.ids, store.read()),
  );
  const seenBank = useRef(bankKey);
  let sitting = session;
  if (seenBank.current !== bankKey) {
    seenBank.current = bankKey;
    sitting = startPracticeSession(indexed.ids, store.read());
    setSession(sitting);
  }

  const current = sitting.currentId ? (indexed.byId.get(sitting.currentId) ?? null) : null;

  function handleSolved() {
    setSession((prev) => unlockPracticeSession(prev));
  }

  function handleNext() {
    const next = advancePracticeSession(sitting, indexed.ids, store.read());
    store.write(next.recent);
    setSession(next.session);
  }

  if (!current) {
    return (
      <GameEmptyState
        className="practice-stream practice-stream--empty"
        title={PRACTICE_EMPTY_TITLE}
        description={PRACTICE_EMPTY_DESCRIPTION}
        action={
          onBrowse ? (
            <GameButton variant="primary" type="button" onClick={onBrowse}>
              {PRACTICE_EMPTY_ACTION}
            </GameButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="practice-stream" aria-label="练习">
      <p className="practice-stream__ordinal" aria-live="polite">
        {practiceOrdinalLabel(sitting.ordinal)}
      </p>
      <div className="practice-stream__columns">
        <div className="practice-stream__question">
          <ChoiceBlock
            key={`${sitting.ordinal}:${sitting.currentId}`}
            exercise={toChoiceBlockExercise(current)}
            onSolved={handleSolved}
            onNext={handleNext}
          />
        </div>
        <PracticeRewardPanel unlocked={sitting.unlocked}>
          {sitting.unlocked ? renderReward(current) : null}
        </PracticeRewardPanel>
      </div>
    </section>
  );
}
