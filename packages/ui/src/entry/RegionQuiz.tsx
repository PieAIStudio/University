import { useEffect, useRef, useState } from "react";
import { GameCallout } from "@pieai/swimmer-ui-kit";

import { playSound } from "../sound/index.js";

/**
 * C12: click the part of the page being named.
 *
 * The exercise their teardown singles out, and it earns the attention. A
 * three-option question about 「首屏」 can be passed by recognising the word in
 * the correct answer; this one can only be passed by finding the thing, which
 * is the skill someone actually needs when an AI says "I have updated the hero
 * section" and they have to check.
 *
 * Regions are buttons, so the keyboard gets the same exercise rather than a
 * described version of it. Labels stay hidden until the right one is found —
 * a labelled mockup answers its own question.
 */

export interface QuizRegion {
  readonly id: string;
  readonly label: string;
  readonly span?: "full" | "half";
  readonly height?: "short" | "tall";
}

export function RegionQuiz({
  question,
  regions,
  correctRegionId,
  reveal,
}: {
  readonly question: string;
  readonly regions: readonly QuizRegion[];
  readonly correctRegionId: string;
  readonly reveal: string;
}) {
  const [solved, setSolved] = useState(false);
  const [missed, setMissed] = useState<readonly string[]>([]);

  // A different question is a different attempt. Carrying a miss across would
  // mark a region the learner never touched.
  const identity = useRef(question);
  useEffect(() => {
    if (identity.current === question) return;
    identity.current = question;
    setSolved(false);
    setMissed([]);
  }, [question]);

  function pick(id: string) {
    if (solved) return;
    if (id === correctRegionId) {
      setSolved(true);
      playSound("answer.correct");
      return;
    }
    playSound("answer.wrong");
    setMissed((current) => (current.includes(id) ? current : [...current, id]));
  }

  const wrong = missed.length > 0;

  return (
    <div className="region-quiz">
      <p className="region-quiz__question">{question}</p>
      <div className="region-quiz__mock">
        {regions.map((region) => {
          const isAnswer = region.id === correctRegionId;
          const isMissed = missed.includes(region.id);
          const classes = [
            "region-quiz__region",
            `region-quiz__region--${region.span ?? "full"}`,
            `region-quiz__region--${region.height ?? "short"}`,
            solved && isAnswer ? "is-answer" : "",
            isMissed ? "is-missed" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={region.id}
              type="button"
              className={classes}
              // Before it is solved, every region has to be indistinguishable
              // to a screen reader too, or the exercise is only hidden from
              // people who can see.
              aria-label={solved || isMissed ? region.label : "这一块是什么？"}
              aria-pressed={isMissed ? true : undefined}
              disabled={solved}
              onClick={() => pick(region.id)}
            >
              {solved || isMissed ? region.label : ""}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {solved ? (
          <GameCallout tone="success" heading="找到了">
            {reveal}
          </GameCallout>
        ) : wrong ? (
          <GameCallout tone="warning">
            那一块是「{regions.find((region) => region.id === missed[missed.length - 1])?.label}」。
            再看一眼，还有哪些块没试过。
          </GameCallout>
        ) : null}
      </div>
    </div>
  );
}
