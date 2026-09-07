import { useCallback, useRef, useState } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import type { ActivityResult, LearningActivitySpec } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import { ConnectGame } from "./ConnectGame.js";
import { TuneGame } from "./TuneGame.js";
import { HuntGame } from "./HuntGame.js";
import { DispatchGame } from "./DispatchGame.js";
import { ProgramGame } from "./ProgramGame.js";
import { PlayIcon } from "./PlayIcon.js";

export interface LearningActivityProps {
  readonly activity: LearningActivitySpec;
  /** Completion is evidence, never a request to award course progress or XP. */
  readonly onResult?: (result: ActivityResult) => void;
  readonly onNext?: () => void;
  readonly nextLabel?: string;
}

/** Embeddable in a lesson, a standalone section, or a host-owned playlist. */
export function LearningActivity(props: LearningActivityProps) {
  const [round, setRound] = useState(0);
  return (
    <ActivityRound
      key={`${props.activity.id}:${round}`}
      {...props}
      onRestart={() => setRound((value) => value + 1)}
    />
  );
}

function ActivityRound({
  activity,
  onResult,
  onNext,
  nextLabel,
  onRestart,
}: LearningActivityProps & { readonly onRestart: () => void }) {
  const [hintOpen, setHintOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ passed: boolean; message: string } | null>(null);
  const [outcome, setOutcome] = useState<ActivityResult | null>(null);
  const count = useRef(0);
  const hintsUsed = useRef(0);
  const reported = useRef(false);
  const latestSubmission = useRef<Readonly<Record<string, unknown>>>({});
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const onAttempt = useCallback(
    (passed: boolean, submission: Readonly<Record<string, unknown>>, message: string) => {
      if (reported.current) return;
      count.current += 1;
      latestSubmission.current = submission;
      setFeedback({ passed, message });
      playSound(passed ? "answer.correct" : "answer.wrong");
      if (passed) {
        reported.current = true;
        const result: ActivityResult = {
          activityId: activity.id,
          kind: activity.kind,
          status: "completed",
          attempts: count.current,
          hintsUsed: hintsUsed.current,
          submission,
        };
        setOutcome(result);
        resultCallback.current?.(result);
      }
    },
    [activity.id, activity.kind],
  );
  const controls = { disabled: outcome !== null, onAttempt };
  const skip = () => {
    if (reported.current) return;
    reported.current = true;
    const result: ActivityResult = {
      activityId: activity.id,
      kind: activity.kind,
      status: "skipped",
      attempts: count.current,
      hintsUsed: hintsUsed.current,
      submission: latestSubmission.current,
    };
    setOutcome(result);
    setFeedback(null);
    resultCallback.current?.(result);
  };
  return (
    <GamePanel
      className="learning-activity"
      tone="strong"
      data-activity={activity.kind}
      data-activity-id={activity.id}
    >
      <header className="learning-activity__head">
        <div className="learning-activity__symbol">
          <PlayIcon name={activity.kind} />
        </div>
        <div>
          <h2>{activity.title}</h2>
          <p>{activity.brief}</p>
        </div>
      </header>
      <p className="learning-activity__goal">
        <PlayIcon name="spark" />
        <span>
          <strong>{t("play.host.goal")}</strong>
          {activity.goal}
        </span>
      </p>
      {outcome?.status !== "skipped" ? (
        <div className="learning-activity__game">
          {activity.kind === "connect" ? <ConnectGame activity={activity} {...controls} /> : null}
          {activity.kind === "tune" ? <TuneGame activity={activity} {...controls} /> : null}
          {activity.kind === "hunt" ? <HuntGame activity={activity} {...controls} /> : null}
          {activity.kind === "dispatch" ? <DispatchGame activity={activity} {...controls} /> : null}
          {activity.kind === "program" ? <ProgramGame activity={activity} {...controls} /> : null}
        </div>
      ) : null}
      {feedback ? (
        <div className="learning-activity__feedback" data-passed={feedback.passed} role="status">
          <PlayIcon name={feedback.passed ? "check" : "spark"} />
          <p>{feedback.message}</p>
        </div>
      ) : null}
      {hintOpen && !outcome ? (
        <p className="learning-activity__hint" role="status">
          {activity.hint}
        </p>
      ) : null}
      {outcome ? (
        <section
          className="learning-activity__result"
          aria-live="polite"
          data-result={outcome.status}
        >
          <h3>{t(outcome.status === "completed" ? "play.host.complete" : "play.host.skipped")}</h3>
          {outcome.status === "completed" ? (
            <>
              <p>{activity.takeaway}</p>
              <div className="learning-activity__receipt">
                <span>{t("play.host.attempts", { count: outcome.attempts })}</span>
                <span>{t("play.host.hints", { count: outcome.hintsUsed })}</span>
                <a href={activity.source.url} target="_blank" rel="noreferrer">
                  {activity.source.label}
                </a>
              </div>
            </>
          ) : null}
          <div className="play-action-row">
            {onNext ? (
              <GameButton sound={false} type="button" onClick={onNext}>
                {nextLabel ?? t("play.lab.next")}
                <PlayIcon name="arrow" />
              </GameButton>
            ) : null}
            <GameButton sound={false} type="button" variant="secondary" onClick={onRestart}>
              {t("play.host.retry")}
            </GameButton>
          </div>
        </section>
      ) : (
        <footer className="learning-activity__tools">
          <GameButton
            sound={false}
            type="button"
            variant="ghost"
            static
            aria-expanded={hintOpen}
            onClick={() => {
              if (!hintOpen) hintsUsed.current = 1;
              setHintOpen(!hintOpen);
            }}
          >
            {t(hintOpen ? "play.host.hideHint" : "play.host.hint")}
          </GameButton>
          <div>
            <GameButton sound={false} type="button" variant="ghost" static onClick={onRestart}>
              {t("play.host.retry")}
            </GameButton>
            <GameButton sound={false} type="button" variant="ghost" static onClick={skip}>
              {t("play.host.skip")}
            </GameButton>
          </div>
        </footer>
      )}
    </GamePanel>
  );
}
