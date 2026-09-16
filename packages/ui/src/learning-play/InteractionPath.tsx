import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import {
  emptyPathEvidence,
  evaluateInteractionStep,
  formatLineRange,
  pathFirstAttemptCount,
  recordPathAttempt,
  type ActivityResult,
  type InteractionPathActivity,
  type PathEvidence,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import type { LessonAssetView } from "../view/lesson-view.js";

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
  const [answer, setAnswer] = useState<string[]>([]);
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
      heading.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    }
  }, [focusVersion]);
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
    setSubmitted(true);
  }
  function advance() {
    if (!step || !result?.passed) return;
    if (index === activity.steps.length - 1 && resultSent.current) return;
    if (index === activity.steps.length - 1 && !(result.artifact ?? artifact)) return;
    if (result.artifact) setArtifact(result.artifact);
    const next = activity.steps[index + 1];
    setIndex(index + 1);
    setAnswer(next?.kind === "assemble" ? [...next.initialPieceIds] : []);
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
        submission: { evidence, handoff: result.artifact ?? artifact, independentMastery: false },
      });
    }
  }
  function restart() {
    resultSent.current = false;
    setEvidence((current) => ({ ...current, resets: current.resets + 1 }));
    setIndex(0);
    setAnswer([]);
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
      >
        {step ? (
          <>
            <header>
              <p className="interaction-path__position">
                {t("path.round", { current: index + 1, total: activity.steps.length })}
              </p>
              <h2 ref={heading} tabIndex={-1}>
                {step.question}
              </h2>
              {index === 0 ? <p>{activity.brief}</p> : null}
              {step.brief ? <p>{step.brief}</p> : null}
            </header>
            {image && index === 0 ? (
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
            {step.kind === "assemble" ? (
              <>
                <ul className="interaction-path__constraints" aria-label={t("path.constraints")}>
                  {[...new Set(step.constraints.map((rule) => rule.label))].map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                <div
                  className="interaction-path__pieces"
                  role="group"
                  aria-label={t("path.pieces")}
                >
                  {step.pieces
                    .filter((piece) => !answer.includes(piece.id))
                    .map((piece) => (
                      <GameButton
                        key={piece.id}
                        data-piece={piece.id}
                        type="button"
                        variant="secondary"
                        sound={false}
                        static
                        disabled={submitted}
                        onClick={() => {
                          pendingPieceFocus.current = `[data-piece-row="${piece.id}"]`;
                          setAnswer([...answer, piece.id]);
                        }}
                      >
                        {piece.label}
                      </GameButton>
                    ))}
                </div>
                <ol className="interaction-path__assembly" aria-label={t("path.artifact")}>
                  {answer.map((id, pieceIndex) => {
                    const label = step.pieces.find((piece) => piece.id === id)!.label;
                    return (
                      <li key={id}>
                        <span data-piece-row={id} tabIndex={-1}>
                          {label}
                        </span>
                        <div className="interaction-path__piece-actions">
                          <GameButton
                            type="button"
                            variant="ghost"
                            sound={false}
                            static
                            aria-label={t("path.upLabel", { label })}
                            disabled={submitted || pieceIndex === 0}
                            onClick={() => move(pieceIndex, -1)}
                          >
                            {t("path.up")}
                          </GameButton>
                          <GameButton
                            type="button"
                            variant="ghost"
                            sound={false}
                            static
                            aria-label={t("path.downLabel", { label })}
                            disabled={submitted || pieceIndex === answer.length - 1}
                            onClick={() => move(pieceIndex, 1)}
                          >
                            {t("path.down")}
                          </GameButton>
                          <GameButton
                            type="button"
                            variant="ghost"
                            sound={false}
                            static
                            aria-label={t("path.removeLabel", { label })}
                            disabled={submitted}
                            onClick={() => {
                              pendingPieceFocus.current = `[data-piece="${id}"]`;
                              setAnswer(answer.filter((value) => value !== id));
                            }}
                          >
                            {t("path.remove")}
                          </GameButton>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {!answer.length ? (
                  <p className="interaction-path__empty">{t("path.empty")}</p>
                ) : null}
              </>
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
                    <h3>{step.material.label}</h3>
                    <p>{step.material.note}</p>
                    {source && "url" in source.reference ? (
                      <a href={source.reference.url} target="_blank" rel="noreferrer">
                        {t("path.openSource")}
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className="interaction-path__choices" role="group" aria-label={step.question}>
                  {(step.kind === "decision" ? step.options : step.material.sentences).map(
                    (choice) => (
                      <GameButton
                        key={choice.id}
                        data-choice-id={choice.id}
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
                        {choice.label}
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
                  <strong>{t(result.passed ? "path.fits" : "path.revise")}</strong>
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
                    disabled={!answer.length}
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
                    {t(index === activity.steps.length - 1 ? "path.finish" : "path.next")}
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
            {source ? (
              <details className="interaction-path__source">
                <summary>{t("path.source")}</summary>
                {"url" in source.reference ? (
                  <a href={source.reference.url} target="_blank" rel="noreferrer">
                    {source.reference.label}
                  </a>
                ) : (
                  <span>
                    {source.reference.label}{" "}
                    <code>
                      {source.reference.path}
                      {source.reference.line
                        ? `:${formatLineRange(source.reference.line, source.reference.lineEnd)}`
                        : ""}
                      {source.reference.commit ? `@${source.reference.commit.slice(0, 8)}` : ""}
                    </code>
                  </span>
                )}
                <p>{source.note}</p>
                {image ? <p>{image.attribution ?? image.caption}</p> : null}
              </details>
            ) : null}
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
            <pre className="interaction-path__artifact">{artifact}</pre>
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
            <p>{t("path.guided")}</p>
            <p>{activity.finish.note}</p>
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
