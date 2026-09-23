import type { ReactNode } from "react";
import { GameButton, GameIconButton, GamePanel, GameToast } from "@pieai/swimmer-ui-kit";

import { useI18n } from "../i18n/index.js";
import { BIN_INK, binColour } from "./palette.js";

/**
 * One box for a whole 3D learning game (ADR-0011, frame layer).
 *
 * The canvas fills the box; hearts, progress, score and pause sit over its top
 * edge; the round's question hangs below them; the answer buttons are the
 * box's last row; panels (briefing, upgrade, pause, result) cover the stage.
 * Nothing about the game lives outside this box. Everything here is DOM — the
 * readable text of a 3D game is never geometry — and nothing here imports
 * `three`.
 */
export function GameFrame({
  label,
  phase,
  stage,
  top,
  banner,
  notice,
  overlay,
  panel,
  actions,
  live,
  className = "",
}: {
  label: string;
  phase: string;
  stage: ReactNode;
  top?: ReactNode;
  banner?: ReactNode;
  notice?: ReactNode;
  /** Large, card-less, over the stage: a countdown. */
  overlay?: ReactNode;
  panel?: ReactNode;
  actions?: ReactNode;
  /** Announced to screen readers: a new mover, a verdict. */
  live?: string;
  className?: string;
}) {
  return (
    <section
      className={`game-frame ${className}`.trim()}
      aria-label={label}
      data-phase={phase}
      data-testid="game-frame"
    >
      <div className="game-frame__stage">
        <div className="game-frame__canvas">{stage}</div>
        {notice ? <div className="game-frame__notice">{notice}</div> : null}
        {overlay ? <div className="game-frame__overlay">{overlay}</div> : null}
      </div>
      {top ? <div className="game-frame__top">{top}</div> : null}
      {banner ? <div className="game-frame__banner">{banner}</div> : null}
      {panel ? (
        <div className="game-frame__panel" data-testid="game-frame-panel">
          <GamePanel className="game-frame__panel-card">{panel}</GamePanel>
        </div>
      ) : null}
      <div className="game-frame__actions">{actions}</div>
      <p className="game-frame__live" role="status" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

export function HeartsMeter({
  hearts,
  max,
  shield,
}: {
  hearts: number;
  max: number;
  shield: boolean;
}) {
  const { t } = useI18n();
  return (
    <span
      className="game-frame__chip game-frame__hearts"
      role="img"
      aria-label={t(shield ? "gameKit.heartsShield" : "gameKit.hearts", { count: hearts })}
      data-hearts={hearts}
    >
      {Array.from({ length: Math.max(max, hearts) }, (_, i) => (
        <span key={i} className={i < hearts ? "is-full" : "is-empty"} aria-hidden="true">
          {i < hearts ? "♥" : "♡"}
        </span>
      ))}
      {shield ? (
        <span className="game-frame__shield" aria-hidden="true">
          ◆
        </span>
      ) : null}
    </span>
  );
}

export function ScoreChip({ score, combo }: { score: number; combo: number }) {
  const { t } = useI18n();
  return (
    <span className="game-frame__chip game-frame__score" data-score={score}>
      <b>{t("gameKit.score", { score })}</b>
      {combo >= 2 ? <small>{t("gameKit.combo", { combo })}</small> : null}
    </span>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="game-frame__chips">{children}</div>;
}

export interface AnswerBin {
  readonly id: string;
  readonly label: string;
}

/** One big button per bin, in the bin's colour, numbered for the keyboard. */
export function AnswerButtons({
  bins,
  disabled,
  onAnswer,
}: {
  bins: readonly AnswerBin[];
  disabled: boolean;
  onAnswer: (binId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="game-frame__answers" data-count={bins.length}>
      {bins.map((bin, index) => (
        <GameButton
          key={bin.id}
          static
          sound={false}
          fullWidth
          className="game-frame__answer"
          style={{ background: binColour(index), color: BIN_INK }}
          disabled={disabled}
          aria-label={t("gameKit.throw", { bin: bin.label })}
          aria-keyshortcuts={String(index + 1)}
          data-testid={`game-answer-${index}`}
          onClick={() => onAnswer(bin.id)}
        >
          <kbd aria-hidden="true">{index + 1}</kbd>
          <span>{bin.label}</span>
        </GameButton>
      ))}
    </div>
  );
}

export function PanelActions({ children }: { children: ReactNode }) {
  return <div className="game-frame__panel-actions">{children}</div>;
}

export function PauseButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <GameIconButton
      className="game-frame__pause"
      label={t(paused ? "gameKit.resume" : "gameKit.pause")}
      data-testid="game-pause"
      onClick={onToggle}
    >
      <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span>
    </GameIconButton>
  );
}

/** A short verdict over the stage: the lesson's reason, never new words. */
export function GameNotice({
  tone,
  title,
  reason,
}: {
  tone: "success" | "danger" | "info";
  title: string;
  reason?: string;
}) {
  // The kit's tones are tints; over a moving scene they need a solid ground.
  return (
    <div className="game-frame__notice-ground">
      <GameToast tone={tone}>
        <b>{title}</b>
        {reason ? <span> {reason}</span> : null}
      </GameToast>
    </div>
  );
}
