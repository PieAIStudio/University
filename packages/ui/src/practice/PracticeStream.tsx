import { translate } from "../i18n/index.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameEmptyState, GamePanel } from "@pieai/swimmer-ui-kit";
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
import { LiquidCtaButton } from "../cta/LiquidCtaButton.js";
import { PracticeRewardPanel } from "./PracticeRewardPanel.js";
import type { PracticeRecentStore } from "./storage.js";

export const PRACTICE_EMPTY_TITLE = translate("ui.practice.practiceStream.copy.还没有可以练的题");

export const PRACTICE_EMPTY_DESCRIPTION = translate(
  "ui.practice.practiceStream.copy.每一条词条自己带着一道判断题-带题的那些会出现在这里",
);

export const PRACTICE_EMPTY_ACTION = translate("ui.practice.practiceStream.copy.去翻翻词条");

export const PRACTICE_INTRO_TITLE = translate("ui.practice.practiceStream.copy.今天练一道判断");

export const PRACTICE_INTRO_DESCRIPTION = translate(
  "ui.practice.practiceStream.copy.概念自己带着判断题-答对一道-展开这一条-题流没有尽头-停下来就行",
);

export const PRACTICE_INTRO_ACTION = translate("ui.practice.practiceStream.copy.开始一道判断");

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
 * The endless single-question stream: one judgement, then the entry as a reward.
 *
 * There is no total, no remaining-work bar, and no category filter. That
 * absence is the design, not an omission — a fraction here would turn
 * "随便刷两题" into a test, which is the settlement screen's job, not this
 * sitting's. The number on screen is how many this sitting has already got
 * right, which is a fact the session already holds.
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
  const [started, setStarted] = useState(false);
  const seenBank = useRef(bankKey);
  const seenRecent = useRef(store.read().ids.join("\0"));
  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe(() => {
      const next = store.read().ids.join("\0");
      if (next === seenRecent.current) return;
      seenRecent.current = next;
      setSession(startPracticeSession(indexed.ids, store.read()));
      setStarted(false);
    });
  }, [bankKey, store]);
  let sitting = session;
  let intro = started;
  if (seenBank.current !== bankKey) {
    seenBank.current = bankKey;
    sitting = startPracticeSession(indexed.ids, store.read());
    intro = false;
    setSession(sitting);
    setStarted(false);
  }

  const current = sitting.currentId ? (indexed.byId.get(sitting.currentId) ?? null) : null;

  function handleSolved() {
    setSession((prev) => unlockPracticeSession(prev));
  }

  function handleNext() {
    const next = advancePracticeSession(sitting, indexed.ids, store.read());
    seenRecent.current = next.recent.ids.join("\0");
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
            <LiquidCtaButton type="button" onClick={onBrowse}>
              {PRACTICE_EMPTY_ACTION}
            </LiquidCtaButton>
          ) : undefined
        }
      />
    );
  }

  if (!intro) {
    return (
      <section
        className="practice-stream"
        aria-label={translate("ui.practice.practiceStream.copy.练习")}
      >
        <GamePanel className="practice-stream__intro" title={PRACTICE_INTRO_TITLE}>
          <p className="practice-stream__intro-copy">{PRACTICE_INTRO_DESCRIPTION}</p>
          <LiquidCtaButton type="button" onClick={() => setStarted(true)}>
            {PRACTICE_INTRO_ACTION}
          </LiquidCtaButton>
        </GamePanel>
      </section>
    );
  }

  return (
    <section
      className="practice-stream"
      aria-label={translate("ui.practice.practiceStream.copy.练习")}
    >
      <p className="practice-stream__ordinal" aria-live="polite">
        {practiceSolvedLabel(sittingSolvedCount(sitting))}
      </p>
      <div className="practice-stream__columns">
        <div className="practice-stream__question">
          <ChoiceBlock
            key={`${sitting.ordinal}:${sitting.currentId}`}
            exercise={toChoiceBlockExercise(current)}
            liquidPrimary
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
