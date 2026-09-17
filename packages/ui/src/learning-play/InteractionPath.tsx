import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  emptyPathEvidence,
  evaluateInteractionStep,
  pathFirstAttemptCount,
  recordPathAttempt,
  type ActivityResult,
  type InteractionPathActivity,
  type InteractionStep,
  type PathEvidence,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import type { LessonAssetView } from "../view/lesson-view.js";
import { PathAssembly } from "./PathAssembly.js";
import { PathArtifact } from "./PathArtifact.js";
import { PathExperiment } from "./PathExperiment.js";
import { PathIntroduction, PathMaterials, PathSources } from "./PathMaterials.js";
import { playSound } from "../sound/index.js";

function initialAnswer(step?: InteractionStep): string[] {
  return step?.kind === "assemble"
    ? [...step.initialPieceIds]
    : step?.kind === "experiment"
      ? [...step.initialControlIds]
      : [];
}

export function InteractionPath({
  activity,
  reviewContent,
  onResult,
  onNext,
  occurrenceId,
  assets,
  onPathProgress,
}: {
  readonly activity: InteractionPathActivity;
  readonly reviewContent?: ReactNode;
  readonly onResult?: (result: ActivityResult) => void;
  readonly onNext?: () => void;
  readonly occurrenceId?: string;
  readonly assets?: readonly LessonAssetView[];
  readonly onPathProgress?: (completed: number) => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [evidence, setEvidence] = useState<PathEvidence>(emptyPathEvidence);
  const [answer, setAnswer] = useState<string[]>(() => initialAnswer(activity.steps[0]));
  const [submitted, setSubmitted] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [artifact, setArtifact] = useState("");
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [focusVersion, setFocusVersion] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const response = useRef<HTMLDivElement>(null);
  const pendingPieceFocus = useRef<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const resultSent = useRef(false);
  const progressCallback = useRef(onPathProgress);
  progressCallback.current = onPathProgress;
  const step = activity.steps[index];
  const materialFirst = activity.pedagogyVersion === 2;
  const image = assets?.find(
    (asset) => asset.id === activity.assetId && asset.mime.startsWith("image/"),
  );
  const result = step && submitted ? evaluateInteractionStep(step, answer) : null;
  const source = step && activity.sources.find((item) => item.id === step.sourceId);
  useEffect(() => {
    progressCallback.current?.(index);
  }, [index]);

  useEffect(() => {
    if (focusVersion > 0) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView?.({
        block: materialFirst && index === activity.steps.length ? "start" : "nearest",
        behavior: "instant",
      });
    }
  }, [focusVersion, index, activity.steps.length, materialFirst]);
  useEffect(() => {
    if (submitted) {
      feedback.current?.focus({ preventScroll: true });
      response.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    }
  }, [submitted]);
  useEffect(() => {
    if (!pendingPieceFocus.current) return;
    const target = panel.current?.querySelector<HTMLElement>(pendingPieceFocus.current);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    pendingPieceFocus.current = null;
  }, [answer]);

  function commit() {
    if (!step || submitted) return;
    setEvidence((current) => recordPathAttempt(current, step, answer));
    playSound(evaluateInteractionStep(step, answer).passed ? "answer.correct" : "answer.wrong");
    setSubmitted(true);
  }
  function advance() {
    if (!step || !result?.passed) return;
    if (index === activity.steps.length - 1 && resultSent.current) return;
    const finalStep = index === activity.steps.length - 1;
    // A changed-purpose final decision did not edit the previous artifact.
    // Keep V1's carry-forward contract; V2 must not pass off old work as new.
    const handoff = materialFirst && finalStep ? result.artifact : (result.artifact ?? artifact);
    if (!materialFirst && index === activity.steps.length - 1 && !handoff) return;
    if (materialFirst && finalStep) setArtifact(result.artifact ?? "");
    else if (result.artifact) setArtifact(result.artifact);
    const next = activity.steps[index + 1];
    setIndex(index + 1);
    setAnswer(initialAnswer(next));
    setSubmitted(false);
    setHintOpen(false);
    setFocusVersion((value) => value + 1);
    if (!next) {
      resultSent.current = true;
      onResult?.({
        activityId: activity.id,
        kind: activity.kind,
        occurrenceId,
        difficulty: activity.difficulty ?? "intro",
        guidanceUsed: true,
        status: "completed",
        attempts: evidence.attempts.length,
        hintsUsed: evidence.helpedStepIds.length,
        submission: {
          evidence,
          ...(handoff ? { handoff } : { recap: activity.takeaway }),
          independentMastery: false,
        },
      });
    }
  }
  function restart() {
    resultSent.current = false;
    setEvidence((current) => ({ ...current, resets: current.resets + 1 }));
    setIndex(0);
    setAnswer(initialAnswer(activity.steps[0]));
    setSubmitted(false);
    setHintOpen(false);
    setArtifact("");
    setCopied("idle");
    setFocusVersion((value) => value + 1);
  }
  function move(pieceIndex: number, delta: number) {
    const next = [...answer];
    const target = pieceIndex + delta;
    if (target < 0 || target >= next.length) return;
    [next[pieceIndex], next[target]] = [next[target]!, next[pieceIndex]!];
    pendingPieceFocus.current = `[data-piece-row="${answer[pieceIndex]}"]`;
    setAnswer(next);
  }

  return (
    <div className="interaction-lesson" ref={panel}>
      <GamePanel
        className="interaction-path"
        tone="strong"
        data-activity="interaction-path"
        data-activity-id={activity.id}
        data-step-kind={step?.kind}
        data-step-id={step?.id}
        data-pedagogy-version={activity.pedagogyVersion}
      >
        {step ? (
          <>
            {materialFirst && index === 0 ? (
              <div className={`path-entry${image ? " path-entry--image" : ""}`}>
                <PathIntroduction activity={activity} />
                {image ? (
                  <figure className="interaction-path__image">
                    <img src={image.url} alt={image.alt} />
                    {(image.caption ?? image.attribution) ? (
                      <figcaption>{image.caption ?? image.attribution}</figcaption>
                    ) : null}
                  </figure>
                ) : null}
              </div>
            ) : null}
            <header>
              <p className="interaction-path__position">
                <span>
                  {t(
                    step.kind === "decision"
                      ? "path.decide"
                      : step.kind === "evidence"
                        ? step.task === "unsupported"
                          ? "path.inspectDraft"
                          : "path.locate"
                        : step.kind === "experiment"
                          ? "path.experiment"
                          : "path.make",
                  )}
                </span>
                {t("path.round", { current: index + 1, total: activity.steps.length })}
              </p>
              <h2 ref={heading} tabIndex={-1}>
                {step.question}
              </h2>
              {index === 0 && !materialFirst ? <p>{activity.brief}</p> : null}
              {step.brief ? <p>{step.brief}</p> : null}
            </header>
            <div className={materialFirst ? "interaction-path__workspace" : undefined}>
              {materialFirst && (index > 0 || (step.materialIds?.length ?? 0) > 0) ? (
                <PathMaterials activity={activity} step={step} first={index === 0} />
              ) : null}
              <div className="interaction-path__task">
                {image && index === 0 && !materialFirst ? (
                  <figure className="interaction-path__image">
                    <img src={image.url} alt={image.alt} />
                  </figure>
                ) : null}
                {image && index > 0 ? (
                  <details className="interaction-path__image-review" key={step.id}>
                    <summary>{t("path.viewImage")}</summary>
                    <figure className="interaction-path__image">
                      <img src={image.url} alt={image.alt} loading="lazy" />
                    </figure>
                  </details>
                ) : null}
                {step.kind === "experiment" ? (
                  <PathExperiment
                    step={step}
                    answer={answer}
                    onChange={(selection) => {
                      setAnswer(selection);
                      setSubmitted(false);
                    }}
                  />
                ) : step.kind === "assemble" ? (
                  <PathAssembly
                    key={`assembly:${step.id}`}
                    step={step}
                    answer={answer}
                    submitted={submitted}
                    onAdd={(id) => {
                      setAnswer([...answer, id]);
                    }}
                    onRemove={(id) => {
                      pendingPieceFocus.current = `[data-piece="${id}"]`;
                      setAnswer(answer.filter((value) => value !== id));
                    }}
                    onMove={move}
                  />
                ) : (
                  <>
                    {step.kind === "evidence" ? (
                      <div className="interaction-path__material">
                        {step.material.reference ? (
                          <section className="interaction-path__reference">
                            <h3>{step.material.reference.label}</h3>
                            <blockquote>{step.material.reference.text}</blockquote>
                          </section>
                        ) : null}
                        <p>{step.material.note}</p>
                        {source && "url" in source.reference ? (
                          <a href={source.reference.url} target="_blank" rel="noreferrer">
                            {t("path.openSource")}
                          </a>
                        ) : null}
                        <h3>{step.material.label}</h3>
                      </div>
                    ) : null}
                    <div
                      className="interaction-path__choices"
                      role="group"
                      aria-label={step.question}
                    >
                      {(step.kind === "decision" ? step.options : step.material.sentences).map(
                        (choice) => (
                          <GameButton
                            key={choice.id}
                            data-choice-id={choice.id}
                            data-selected={answer[0] === choice.id}
                            data-outcome={
                              submitted && answer[0] === choice.id
                                ? result?.passed
                                  ? "fits"
                                  : "revise"
                                : undefined
                            }
                            aria-label={choice.label}
                            type="button"
                            variant={
                              answer[0] === choice.id
                                ? "primary"
                                : step.kind === "evidence"
                                  ? "ghost"
                                  : "secondary"
                            }
                            sound={false}
                            static
                            aria-pressed={answer[0] === choice.id}
                            disabled={submitted}
                            onClick={() => setAnswer([choice.id])}
                          >
                            <span className="path-choice__mark" aria-hidden="true">
                              {submitted && answer[0] === choice.id ? (
                                <svg viewBox="0 0 24 24">
                                  <path
                                    d={result?.passed ? "m5 12 4 4L19 6" : "M6 6l12 12M18 6 6 18"}
                                  />
                                </svg>
                              ) : answer[0] === choice.id ? (
                                <span />
                              ) : null}
                            </span>
                            <span>{choice.label}</span>
                          </GameButton>
                        ),
                      )}
                    </div>
                  </>
                )}
                <div className="interaction-path__response" ref={response}>
                  {result ? (
                    <div
                      ref={feedback}
                      className="interaction-path__feedback"
                      tabIndex={-1}
                      role="status"
                      data-passed={result.passed}
                    >
                      <strong className="path-feedback__title">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d={result.passed ? "m5 12 4 4L19 6" : "M12 5v9M12 18v1"} />
                        </svg>
                        {t(result.passed ? "path.fits" : "path.revise")}
                      </strong>
                      {result.feedback.map((message, messageIndex) => (
                        <p key={messageIndex}>{message}</p>
                      ))}
                      <p>{step.explanation}</p>
                    </div>
                  ) : null}
                  <div className="interaction-path__actions">
                    {!submitted ? (
                      <GameButton
                        type="button"
                        variant="primary"
                        surface="liquid"
                        sound={false}
                        disabled={step.kind !== "experiment" && !answer.length}
                        onClick={commit}
                      >
                        {t("path.commit")}
                      </GameButton>
                    ) : result?.passed ? (
                      <GameButton
                        type="button"
                        variant="primary"
                        surface="liquid"
                        sound={false}
                        onClick={advance}
                      >
                        {t(
                          index === activity.steps.length - 1
                            ? result.artifact || (!materialFirst && artifact)
                              ? "path.finish"
                              : "path.finishMethod"
                            : "path.next",
                        )}
                      </GameButton>
                    ) : (
                      <GameButton
                        type="button"
                        variant="primary"
                        surface="liquid"
                        sound={false}
                        onClick={() => {
                          setSubmitted(false);
                          setFocusVersion((value) => value + 1);
                        }}
                      >
                        {t("path.tryAgain")}
                      </GameButton>
                    )}
                    {!submitted ? (
                      <GameButton
                        type="button"
                        variant="ghost"
                        sound={false}
                        static
                        aria-expanded={hintOpen}
                        onClick={() => {
                          setHintOpen(!hintOpen);
                          setEvidence((current) => ({
                            ...current,
                            helpedStepIds: [...new Set([...current.helpedStepIds, step.id])],
                          }));
                        }}
                      >
                        {t(hintOpen ? "path.hideHelp" : "path.help")}
                      </GameButton>
                    ) : null}
                  </div>
                  {hintOpen ? <p role="status">{step.hint}</p> : null}
                </div>
              </div>
            </div>
            <PathSources
              sources={materialFirst ? activity.sources : source ? [source] : []}
              image={image}
              all={materialFirst}
            />
            {onNext ? (
              <GameButton type="button" variant="ghost" sound={false} static onClick={onNext}>
                {t("path.skip")}
              </GameButton>
            ) : null}
          </>
        ) : (
          <section data-result="completed">
            <h2 ref={heading} tabIndex={-1}>
              {activity.finish.title}
            </h2>
            {artifact ? (
              <>
                <PathArtifact title={t("path.finishedArtifact")} image={image} settled>
                  <pre className="interaction-path__artifact">{artifact}</pre>
                </PathArtifact>
                <GameButton
                  type="button"
                  variant="secondary"
                  sound={false}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(artifact);
                      setCopied("copied");
                    } catch {
                      setCopied("failed");
                    }
                  }}
                >
                  {t(copied === "copied" ? "path.copied" : "path.copy")}
                </GameButton>
                {copied === "failed" ? <p role="status">{t("path.copyFailed")}</p> : null}
                <p>{activity.takeaway}</p>
              </>
            ) : (
              <section className="interaction-path__recap">
                <h3>{t("path.methodRecap")}</h3>
                <p>{activity.takeaway}</p>
              </section>
            )}
            <p>{t(artifact ? "path.guided" : "path.guidedMethod")}</p>
            <p>{activity.finish.note}</p>
            {materialFirst ? <PathSources sources={activity.sources} image={image} all /> : null}
            {onNext ? (
              <GameButton
                type="button"
                variant="primary"
                surface="liquid"
                sound={false}
                onClick={onNext}
              >
                {t("path.independent")}
              </GameButton>
            ) : null}
          </section>
        )}
        <details className="interaction-path__receipt">
          <summary>{t("path.record")}</summary>
          <p>
            {t("path.recordSummary", {
              first: pathFirstAttemptCount(evidence),
              attempts: evidence.attempts.length,
              hints: evidence.helpedStepIds.length,
              resets: evidence.resets,
            })}
          </p>
          {evidence.reviewed ? <p>{t("path.reviewed")}</p> : null}
          <ol>
            {evidence.attempts.map((attempt, attemptIndex) => (
              <li key={attemptIndex}>
                {activity.steps.find((item) => item.id === attempt.stepId)?.question} ·{" "}
                {t(attempt.passed ? "path.recordPass" : "path.recordWrong")}
                {attempt.helpUsed || attempt.priorEvidence ? ` · ${t("path.recordAssisted")}` : ""}
              </li>
            ))}
          </ol>
          <GameButton type="button" variant="ghost" sound={false} static onClick={restart}>
            {t("path.restart")}
          </GameButton>
        </details>
      </GamePanel>
      {reviewContent ? (
        <details
          className="interaction-path__review"
          onToggle={(event) => {
            if (event.currentTarget.open)
              setEvidence((current) => ({ ...current, reviewed: true }));
          }}
        >
          <summary>{t("path.fullText")}</summary>
          {reviewContent}
        </details>
      ) : null}
    </div>
  );
}
