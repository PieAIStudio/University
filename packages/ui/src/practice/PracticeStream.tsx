import { useRef, useState } from "react";
import { GameButton, GameEmptyState } from "@pieai/swimmer-ui-kit";
import {
  advancePracticeSession,
  idOfPracticeQuestion,
  indexPracticeQuestions,
  startPracticeSession,
  unlockPracticeSession,
  type LexiconEntry,
  type PracticeSession,
  type TermPracticeQuestion,
} from "@pieai/university-core";

import { ChoiceBlock, type ChoiceBlockExercise } from "../review/ChoiceBlock.js";
import { PracticeTermPanel } from "./PracticeTermPanel.js";
import type { PracticeRecentStore } from "./storage.js";

export const PRACTICE_EMPTY_TITLE = "还没有可练习的术语";

export const PRACTICE_EMPTY_DESCRIPTION = "每个术语自己带着一道判断题。有题的术语会在这里出现。";

export const PRACTICE_EMPTY_ACTION = "浏览术语";

export function practiceOrdinalLabel(ordinal: number): string {
  return `第 ${ordinal} 题`;
}

function toChoiceBlockExercise(question: TermPracticeQuestion): ChoiceBlockExercise {
  return {
    id: idOfPracticeQuestion(question),
    prompt: question.exercise.prompt,
    options: question.exercise.options,
    correctOptionId: question.exercise.correctOptionId,
  };
}

/**
 * The endless single-question stream: one judgement, then the term as a reward.
 *
 * The counter below is the only number on this surface, and it is session-local.
 * There is no total, no score, no progress bar, and no category filter. That
 * absence is the design, not an omission — a remaining-work bar here would turn
 * "随便刷两题" into a test, which is the settlement screen's job, not this
 * sitting's. Do not add one.
 */
export function PracticeStream({
  questions,
  store,
  lexicon,
  onOpenSense,
  collectionHref,
  onBrowse,
}: {
  readonly questions: readonly TermPracticeQuestion[];
  readonly store: PracticeRecentStore;
  readonly lexicon?: ReadonlyMap<string, LexiconEntry>;
  readonly onOpenSense?: (senseId: string) => void;
  readonly collectionHref?: string;
  readonly onBrowse?: () => void;
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
        <PracticeTermPanel
          question={current}
          unlocked={sitting.unlocked}
          lexicon={lexicon}
          onOpenSense={onOpenSense}
          collectionHref={collectionHref}
        />
      </div>
    </section>
  );
}
