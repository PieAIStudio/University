import { GameButton } from "@pieai/swimmer-ui-kit";

import { useI18n } from "../i18n/index.js";
import { BIN_INK, binColour } from "./palette.js";

/**
 * The panels a round-based learning game shows between its tense parts
 * (ADR-0011 rule 4: reading is calm, answering is tense). Each is plain DOM
 * inside `GameFrame`'s panel slot.
 */
export interface BriefingBin {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
}

export function BriefingPanel({
  eyebrow,
  question,
  bins,
  source,
  onReady,
}: {
  eyebrow: string;
  question: string;
  bins: readonly BriefingBin[];
  source: string;
  onReady: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="game-frame__briefing" data-testid="game-briefing">
      <p className="game-frame__eyebrow">{eyebrow}</p>
      <h3>{question}</h3>
      <ul className="game-frame__bins">
        {bins.map((bin, index) => (
          <li key={bin.id}>
            <span
              className="game-frame__bin-swatch"
              style={{ background: binColour(index), color: BIN_INK }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span>
              <b>{bin.label}</b>
              {bin.note ? <small>{bin.note}</small> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="game-frame__source">{source}</p>
      <GameButton static sound={false} onClick={onReady} data-testid="game-ready">
        {t("gameKit.ready")}
      </GameButton>
    </div>
  );
}

export function Countdown({ value }: { value: number }) {
  return (
    <span className="game-frame__countdown" aria-hidden="true" key={value}>
      {value}
    </span>
  );
}

export interface UpgradeOption {
  readonly id: string;
  readonly title: string;
  readonly note: string;
}

export function UpgradePanel({
  title,
  options,
  onChoose,
}: {
  title: string;
  options: readonly UpgradeOption[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="game-frame__upgrade" data-testid="game-upgrade">
      <h3>{title}</h3>
      <div className="game-frame__upgrade-options">
        {options.map((option) => (
          <GameButton
            key={option.id}
            static
            sound={false}
            variant="secondary"
            onClick={() => onChoose(option.id)}
            data-testid={`game-upgrade-${option.id}`}
          >
            <b>{option.title}</b>
            <small>{option.note}</small>
          </GameButton>
        ))}
      </div>
    </div>
  );
}

export function PausePanel({ onResume, onQuit }: { onResume: () => void; onQuit?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="game-frame__pause-panel" data-testid="game-paused">
      <h3>{t("gameKit.paused")}</h3>
      <div className="game-frame__panel-actions">
        <GameButton static sound={false} onClick={onResume} data-testid="game-resume">
          {t("gameKit.resume")}
        </GameButton>
        {onQuit ? (
          <GameButton static sound={false} variant="ghost" onClick={onQuit}>
            {t("gameKit.quit")}
          </GameButton>
        ) : null}
      </div>
    </div>
  );
}

export interface ResultLine {
  readonly key: string;
  readonly text: string;
  readonly bin: string;
  readonly binIndex: number;
  readonly why: string;
  readonly outcome: "first" | "corrected" | "missed";
  readonly lessonId: string;
  readonly lessonTitle: string;
}

export function ResultPanel({
  won,
  score,
  best,
  lines,
  onAgain,
  onOpenLesson,
  onClose,
}: {
  won: boolean;
  score: number;
  best: number;
  lines: readonly ResultLine[];
  onAgain: () => void;
  onOpenLesson?: (lessonId: string) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const count = (outcome: ResultLine["outcome"]) =>
    lines.filter((line) => line.outcome === outcome).length;
  const order = { missed: 0, corrected: 1, first: 2 } as const;
  const sorted = [...lines].sort((a, b) => order[a.outcome] - order[b.outcome]);
  return (
    <div className="game-frame__result" data-testid="game-result" data-won={won}>
      <h3>{t(won ? "gameKit.result.won" : "gameKit.result.lost")}</h3>
      <strong className="game-frame__final-score">{t("gameKit.score", { score })}</strong>
      <p>
        {t("gameKit.result.stats", {
          first: count("first"),
          corrected: count("corrected"),
          missed: count("missed"),
        })}
        {best >= 2 ? ` · ${t("gameKit.result.best", { best })}` : ""}
      </p>
      <div className="game-frame__panel-actions">
        <GameButton static sound={false} onClick={onAgain} data-testid="game-again">
          {t("gameKit.result.again")}
        </GameButton>
        {onClose ? (
          <GameButton static sound={false} variant="ghost" onClick={onClose}>
            {t("gameKit.result.close")}
          </GameButton>
        ) : null}
      </div>
      {sorted.length ? (
        <details className="game-frame__review" open={!won || count("missed") > 0}>
          <summary>{t("gameKit.result.review")}</summary>
          <ul>
            {sorted.map((line) => (
              <li key={line.key} data-outcome={line.outcome}>
                <p>
                  <b>{line.text}</b>
                  <span
                    className="game-frame__bin-tag"
                    style={{ background: binColour(line.binIndex), color: BIN_INK }}
                  >
                    {line.bin}
                  </span>
                </p>
                <p>{line.why}</p>
                <small>
                  {t(`gameKit.outcome.${line.outcome}`)}
                  {onOpenLesson ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="game-frame__lesson-link"
                        onClick={() => onOpenLesson(line.lessonId)}
                      >
                        {t("gameKit.result.openLesson", { lesson: line.lessonTitle })}
                      </button>
                    </>
                  ) : null}
                </small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="game-frame__boundary">{t("gameKit.result.boundary")}</p>
    </div>
  );
}
