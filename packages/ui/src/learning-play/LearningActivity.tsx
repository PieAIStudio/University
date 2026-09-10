import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { formatLineRange } from "@pieai/university-core";
import type { ActivityResult, LearningActivitySpec } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import { ConnectGame } from "./ConnectGame.js";
import { SortGame } from "./SortGame.js";
import { ContrastGame } from "./ContrastGame.js";
import { WeighGame } from "./WeighGame.js";
import { TuneGame } from "./TuneGame.js";
import { HuntGame } from "./HuntGame.js";
import { DispatchGame } from "./DispatchGame.js";
import { ProgramGame } from "./ProgramGame.js";
import { BriefGame } from "./BriefGame.js";
import { ContextGame } from "./ContextGame.js";
import { AgentGame } from "./AgentGame.js";
import { EvalGame } from "./EvalGame.js";
import { RepairGame } from "./RepairGame.js";
import { PlayIcon } from "./PlayIcon.js";

export interface LearningActivityProps {
  readonly activity: LearningActivitySpec;
  /** A lesson occurrence is distinct from a reusable activity definition. */
  readonly occurrenceId?: string;
  readonly initialGuidance?: "guided" | "free";
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
      key={`${props.occurrenceId ?? props.activity.id}:${props.activity.id}:${props.activity.difficulty ?? "practice"}:${round}`}
      {...props}
      onRestart={() => setRound((value) => value + 1)}
    />
  );
}

function ActivityRound({
  activity,
  occurrenceId,
  initialGuidance = "guided",
  onResult,
  onNext,
  nextLabel,
  onRestart,
}: LearningActivityProps & { readonly onRestart: () => void }) {
  const [hintOpen, setHintOpen] = useState(false);
  const [guided, setGuided] = useState(initialGuidance === "guided");
  const guidanceUsed = useRef(initialGuidance === "guided");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [feedback, setFeedback] = useState<{ passed: boolean; message: string } | null>(null);
  const [outcome, setOutcome] = useState<ActivityResult | null>(null);
  const feedbackElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((activity.kind === "ai-brief" || activity.kind === "ai-context") && feedback)
      feedbackElement.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [activity.kind, feedback]);
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
          difficulty: activity.difficulty ?? "practice",
          occurrenceId,
          guidanceUsed: guidanceUsed.current,
          status: "completed",
          attempts: count.current,
          hintsUsed: hintsUsed.current,
          submission,
        };
        setOutcome(result);
        resultCallback.current?.(result);
      }
    },
    [activity.id, activity.kind, activity.difficulty, occurrenceId],
  );
  const controls = { disabled: outcome !== null, onAttempt, guided };
  const skip = () => {
    if (reported.current) return;
    reported.current = true;
    const result: ActivityResult = {
      activityId: activity.id,
      kind: activity.kind,
      difficulty: activity.difficulty ?? "practice",
      occurrenceId,
      guidanceUsed: guidanceUsed.current,
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
      data-guided={guided}
      data-difficulty={activity.difficulty ?? "practice"}
    >
      <header className="learning-activity__head">
        <div className="learning-activity__symbol">
          <PlayIcon name={activity.kind} />
        </div>
        <div>
          <h2>{activity.title}</h2>
        </div>
      </header>
      <div className="learning-activity__orientation">
        <details className="learning-activity__background">
          <summary>
            {activity.difficulty ? `${t(`play.difficulty.${activity.difficulty}`)} · ` : ""}
            {t("play.usability.goal")}
          </summary>
          <p>{activity.brief}</p>
          <p className="learning-activity__goal">{activity.goal}</p>
        </details>
        {!outcome ? (
          <GameButton
            variant="ghost"
            onClick={() => {
              if (!guided) guidanceUsed.current = true;
              setGuided((value) => !value);
            }}
            aria-pressed={!guided}
          >
            {t(guided ? "play.usability.explore" : "play.usability.guide")}
          </GameButton>
        ) : null}
      </div>
      {activity.kind.startsWith("ai-") ? (
        <p className="learning-activity__sandbox">{t("play.ai.sandbox")}</p>
      ) : null}
      {outcome?.status !== "skipped" ? (
        <div className="learning-activity__game">
          {activity.kind === "connect" ? <ConnectGame activity={activity} {...controls} /> : null}
          {activity.kind === "sort" ? <SortGame activity={activity} {...controls} /> : null}
          {activity.kind === "contrast" ? <ContrastGame activity={activity} {...controls} /> : null}
          {activity.kind === "weigh" ? <WeighGame activity={activity} {...controls} /> : null}
          {activity.kind === "tune" ? <TuneGame activity={activity} {...controls} /> : null}
          {activity.kind === "hunt" ? <HuntGame activity={activity} {...controls} /> : null}
          {activity.kind === "dispatch" ? <DispatchGame activity={activity} {...controls} /> : null}
          {activity.kind === "program" ? <ProgramGame activity={activity} {...controls} /> : null}
          {activity.kind === "ai-brief" ? <BriefGame activity={activity} {...controls} /> : null}
          {activity.kind === "ai-context" ? (
            <ContextGame activity={activity} {...controls} />
          ) : null}
          {activity.kind === "ai-agent" ? <AgentGame activity={activity} {...controls} /> : null}
          {activity.kind === "ai-eval" ? <EvalGame activity={activity} {...controls} /> : null}
          {activity.kind === "ai-repair" ? <RepairGame activity={activity} {...controls} /> : null}
        </div>
      ) : null}
      {feedback ? (
        <div
          ref={feedbackElement}
          className="learning-activity__feedback"
          data-passed={feedback.passed}
          role="status"
        >
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
                {/*
                  A link when the source is a page, the pinned location when it
                  is code. A repository citation is not a worse source, it is a
                  different one — and rendering it as a dead link, or leaving it
                  out, would be the receipt lying about where the facts came
                  from.
                */}
                {"url" in activity.source ? (
                  <a href={activity.source.url} target="_blank" rel="noreferrer">
                    {activity.source.label}
                  </a>
                ) : (
                  <span>
                    {activity.source.label}{" "}
                    <code>
                      {activity.source.path}
                      {activity.source.line
                        ? `:${formatLineRange(activity.source.line, activity.source.lineEnd)}`
                        : ""}
                      {activity.source.commit ? `@${activity.source.commit.slice(0, 8)}` : ""}
                    </code>
                  </span>
                )}
              </div>
            </>
          ) : null}
          {outcome.status === "completed" && typeof outcome.submission.handoff === "string" ? (
            <details className="learning-activity__handoff">
              <summary>{t("play.ai.handoff")}</summary>
              <p>{t("play.ai.handoffNote")}</p>
              <GameButton
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(outcome.submission.handoff as string);
                    setCopyState("copied");
                  } catch {
                    setCopyState("failed");
                  }
                }}
              >
                {t(copyState === "copied" ? "play.ai.copied" : "play.ai.copy")}
              </GameButton>
              {copyState === "failed" ? <p role="status">{t("play.ai.copyFailed")}</p> : null}
              <pre>{outcome.submission.handoff}</pre>
            </details>
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
