import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { availableLevels, defaultActivityLevel, formatLineRange } from "@pieai/university-core";
import type {
  ActivityDifficulty,
  ActivityLevels,
  ActivityResult,
  LearningActivitySpec,
} from "@pieai/university-core";
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
import { PrimmLesson, type PrimmLessonProps } from "./PrimmLesson.js";
import { InteractionPath } from "./InteractionPath.js";
import { PlayIcon } from "./PlayIcon.js";
import type { ActivityControls } from "./controls.js";
import type { LessonAssetView } from "../view/lesson-view.js";

export interface LearningActivityProps extends Omit<PrimmLessonProps, "activity"> {
  readonly activity: LearningActivitySpec;
  /**
   * The other difficulties this activity was authored at.
   *
   * When there is more than one, the header stops being a badge and becomes a
   * control — which is the whole of V5's 「难度逐个组件选择」. Absent, or with
   * one level, nothing changes: the label reads exactly as it did.
   */
  readonly levels?: ActivityLevels;
  /**
   * The host's current level when it swaps the activity payload underneath
   * this component. Standalone lessons omit it and still start at the easiest
   * authored level.
   */
  readonly initialDifficulty?: ActivityDifficulty;
  /** Told when the learner moves to another level, for hosts that track it. */
  readonly onLevelChange?: (level: ActivityDifficulty) => void;
  /** A lesson occurrence is distinct from a reusable activity definition. */
  readonly occurrenceId?: string;
  readonly initialGuidance?: "guided" | "free";
  /** Completion is evidence, never a request to award course progress or XP. */
  readonly onResult?: (result: ActivityResult) => void;
  readonly onNext?: () => void;
  readonly nextLabel?: string;
  readonly reviewContent?: ReactNode;
  readonly assets?: readonly LessonAssetView[];
  readonly onPathProgress?: (completed: number) => void;
}

/** Everything a board needs except the board's own payload. */
type GameControls = Omit<ActivityControls<LearningActivitySpec>, "activity">;

/*
  One board per kind, and the compiler holds the list.

  This was thirteen ternaries in the JSX, which is a lookup table written in
  the one shape that cannot be checked: a kind with no branch rendered an empty
  `learning-activity__game` and nothing anywhere said so. That is not
  hypothetical — `sort` shipped with an engine, a renderer, fixtures and a gate
  while three boundaries silently dropped it, and a blank board is exactly what
  a reader would have seen. A switch with a `never` default turns the same
  omission into a build failure, which is the earliest place it can be caught
  and the only one that does not depend on somebody running the right test.

  `LearningPlayLab.test.tsx` still renders every kind, because this only proves
  a branch exists — it cannot prove the branch draws anything.
*/
function renderGame(activity: LearningActivitySpec, controls: GameControls) {
  switch (activity.kind) {
    case "connect":
      return <ConnectGame activity={activity} {...controls} />;
    case "sort":
      return <SortGame activity={activity} {...controls} />;
    case "contrast":
      return <ContrastGame activity={activity} {...controls} />;
    case "weigh":
      return <WeighGame activity={activity} {...controls} />;
    case "tune":
      return <TuneGame activity={activity} {...controls} />;
    case "hunt":
      return <HuntGame activity={activity} {...controls} />;
    case "dispatch":
      return <DispatchGame activity={activity} {...controls} />;
    case "program":
      return <ProgramGame activity={activity} {...controls} />;
    case "ai-brief":
      return <BriefGame activity={activity} {...controls} />;
    case "ai-context":
      return <ContextGame activity={activity} {...controls} />;
    case "ai-agent":
      return <AgentGame activity={activity} {...controls} />;
    case "ai-eval":
      return <EvalGame activity={activity} {...controls} />;
    case "ai-repair":
      return <RepairGame activity={activity} {...controls} />;
    case "primm":
    case "interaction-path":
      return null; // The path owns one shell for all its rounds, routed below.
    default: {
      // A kind that reaches here has no board. `never` is what makes that a
      // compile error instead of an empty div in front of a reader.
      const unrendered: never = activity;
      return unrendered;
    }
  }
}

/** Embeddable in a lesson, a standalone section, or a host-owned playlist. */
export function LearningActivity(props: LearningActivityProps) {
  return props.activity.kind === "primm" ? (
    <PrimmLesson {...props} activity={props.activity} />
  ) : props.activity.kind === "interaction-path" ? (
    <InteractionPath
      key={`${props.occurrenceId ?? "standalone"}:${props.activity.id}`}
      {...props}
      activity={props.activity}
    />
  ) : (
    <LegacyLearningActivity {...props} />
  );
}

function LegacyLearningActivity({
  levels,
  initialDifficulty,
  onLevelChange,
  ...props
}: LearningActivityProps) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<ActivityDifficulty | null>(initialDifficulty ?? null);
  const offered = levels ? availableLevels(levels) : [];
  /*
    V5: 「默认先提供入门」. The start level is the easiest the lesson authored,
    not the level of whichever activity the prose happened to point `::play` at
    — otherwise the default would depend on the author's id choice rather than
    on what the learner needs.
  */
  const difficulty = picked ?? (levels ? defaultActivityLevel(levels) : null);
  const activity = (difficulty ? levels?.levels[difficulty] : undefined) ?? props.activity;
  return (
    <ActivityRound
      key={`${props.occurrenceId ?? activity.id}:${activity.id}:${activity.difficulty ?? "practice"}:${round}`}
      {...props}
      activity={activity}
      levels={offered.length > 1 ? offered : undefined}
      onPickLevel={(level) => {
        setPicked(level);
        onLevelChange?.(level);
      }}
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
  levels,
  onPickLevel,
  onRestart,
}: Omit<LearningActivityProps, "levels"> & {
  readonly levels?: readonly ActivityDifficulty[];
  readonly onPickLevel?: (level: ActivityDifficulty) => void;
  readonly onRestart: () => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const [guided, setGuided] = useState(initialGuidance === "guided");
  const guidanceUsed = useRef(initialGuidance === "guided");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [feedback, setFeedback] = useState<{
    passed: boolean;
    message: string;
  } | null>(null);
  const [outcome, setOutcome] = useState<ActivityResult | null>(null);
  const feedbackElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((activity.kind === "ai-brief" || activity.kind === "ai-context") && feedback)
      feedbackElement.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "instant",
      });
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
        {/*
          The difficulty stops being a label and becomes a control the moment a
          lesson authors more than one level. It was a badge for a year — the
          engine, the three-level family type, the selector and the completion
          record all worked, and the only thing that could reach them was the
          play lab, because a lesson had nowhere to store a second payload.
        */}
        {levels ? (
          <div
            className="learning-activity__levels"
            role="group"
            aria-label={t("play.difficulty.label")}
          >
            {levels.map((level) => (
              <GameButton
                key={level}
                sound={false}
                static
                type="button"
                variant={level === (activity.difficulty ?? "practice") ? "primary" : "ghost"}
                aria-pressed={level === (activity.difficulty ?? "practice")}
                onClick={() => onPickLevel?.(level)}
              >
                {t(`play.difficulty.${level}`)}
              </GameButton>
            ))}
          </div>
        ) : null}
        <details className="learning-activity__background">
          <summary>
            {!levels && activity.difficulty
              ? `${t(`play.difficulty.${activity.difficulty}`)} · `
              : ""}
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
        <div className="learning-activity__game">{renderGame(activity, controls)}</div>
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
            {/*
              The one liquid control every activity kind shares.

              Each board may also give its own completing action the liquid
              surface — connect's 「放出测试信号」 does — but this is the moment
              that exists on all thirteen of them, and it is the one worth
              spending the brand's loudest surface on: the learner has just
              finished, and this is the way forward. Putting it here rather
              than in each game is also what keeps 「one liquid control per
              screen」 true by construction instead of by discipline.
            */}
            {onNext ? (
              <GameButton
                sound={false}
                surface="liquid"
                type="button"
                variant="primary"
                onClick={onNext}
              >
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
