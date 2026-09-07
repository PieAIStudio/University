import { useMemo, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { ActivityKind, ActivityResult } from "@pieai/university-core";
import { translate as t, useI18n } from "../i18n/index.js";
import { SoundToggle } from "../sound/index.js";
import { LearningActivity } from "./LearningActivity.js";
import { getBaseExamples } from "./base-examples.js";
import { extraExamples } from "./extra-examples.js";
import { getProgramExamples } from "./program-examples.js";
import { PlayIcon } from "./PlayIcon.js";
import { getAIBriefExamples } from "./ai-brief-examples.js";
import { getAIWorkflowExamples } from "./ai-workflow-examples.js";
import { getAIQualityExamples } from "./ai-quality-examples.js";

const FOUNDATION_MODES = [
  "connect",
  "tune",
  "hunt",
  "dispatch",
  "program",
] as const satisfies readonly ActivityKind[];

const AI_MODES = [
  "ai-brief",
  "ai-context",
  "ai-agent",
  "ai-eval",
  "ai-repair",
] as const satisfies readonly ActivityKind[];

/** Demo fixtures live here; the activity renderer has no dependency on this page. */
export function LearningPlayLab({
  collection = "foundations",
}: {
  readonly collection?: "foundations" | "ai";
}) {
  const modes: readonly ActivityKind[] = collection === "ai" ? AI_MODES : FOUNDATION_MODES;
  const { locale } = useI18n();
  const examples = useMemo(
    () =>
      collection === "ai"
        ? [...getAIBriefExamples(), ...getAIWorkflowExamples(), ...getAIQualityExamples()]
        : [...getBaseExamples(), ...extraExamples(), ...getProgramExamples()],
    [locale, collection],
  );
  const [mode, setMode] = useState<ActivityKind>(modes[0]!);
  const [variant, setVariant] = useState(0);
  const [round, setRound] = useState(0);
  const [completed, setCompleted] = useState<ReadonlySet<ActivityKind>>(() => new Set());
  const [playlist, setPlaylist] = useState<ActivityResult[] | null>(null);
  const [playlistDone, setPlaylistDone] = useState(false);
  const activityTop = useRef<HTMLDivElement>(null);
  const variants = examples.filter((example) => example.kind === mode);
  const activity = variants[variant] ?? variants[0]!;
  const advanceFocus = () =>
    requestAnimationFrame(() => {
      activityTop.current?.scrollIntoView({ block: "start", behavior: "instant" });
      activityTop.current?.focus({ preventScroll: true });
    });
  const choose = (next: ActivityKind) => {
    setMode(next);
    setVariant(0);
    setPlaylist(null);
    setPlaylistDone(false);
    setRound((value) => value + 1);
  };
  const next = () => {
    const index = modes.indexOf(mode);
    if (playlist !== null && index === modes.length - 1) {
      setPlaylistDone(true);
      return;
    }
    setMode(modes[(index + 1) % modes.length]!);
    setVariant(0);
    setRound((value) => value + 1);
    advanceFocus();
  };
  const startPlaylist = () => {
    setPlaylist([]);
    setPlaylistDone(false);
    setMode(modes[0]!);
    setVariant(0);
    setRound((value) => value + 1);
    advanceFocus();
  };
  const record = (result: ActivityResult) => {
    if (result.status === "completed")
      setCompleted((previous) => new Set([...previous, result.kind]));
    setPlaylist((previous) =>
      previous === null
        ? null
        : [...previous.filter((entry) => entry.kind !== result.kind), result],
    );
  };
  return (
    <div className="learning-play-lab">
      <div className="learning-play-lab__top">
        <a href="/practice">{t("play.lab.back")}</a>
        <SoundToggle />
      </div>
      <nav className="learning-play-lab__collections" aria-label={t("play.ai.collection")}>
        <a href="/play-lab/ai" aria-current={collection === "ai" ? "page" : undefined}>
          {t("play.ai.collection.ai")}
        </a>
        <a href="/play-lab" aria-current={collection === "foundations" ? "page" : undefined}>
          {t("play.ai.collection.foundations")}
        </a>
      </nav>
      <header className="learning-play-lab__intro">
        <div>
          <h1>{t(collection === "ai" ? "play.ai.title" : "play.lab.title")}</h1>
          <p>{t(collection === "ai" ? "play.ai.intro" : "play.lab.intro")}</p>
        </div>
        <div className="learning-play-lab__session">
          <span>{t("play.lab.session", { count: completed.size })}</span>
          <GameButton
            sound={false}
            type="button"
            variant="secondary"
            onClick={
              playlist !== null && !playlistDone
                ? () => {
                    setPlaylist(null);
                    setPlaylistDone(false);
                  }
                : startPlaylist
            }
          >
            {t(playlist !== null && !playlistDone ? "play.lab.cancelMix" : "play.lab.mix")}
          </GameButton>
        </div>
      </header>
      <nav className="learning-play-lab__modes" aria-label={t("play.lab.select")}>
        {modes.map((kind) => (
          <GameButton
            sound={false}
            static
            variant={mode === kind ? "primary" : "secondary"}
            type="button"
            key={kind}
            className="learning-play-lab__mode"
            aria-current={mode === kind ? "true" : undefined}
            onClick={() => choose(kind)}
          >
            <PlayIcon name={kind} />
            <span>
              <strong>{t(`play.mode.${kind}`)}</strong>
              <small>{t(`play.verb.${kind}`)}</small>
            </span>
            {completed.has(kind) ? (
              <PlayIcon name="check" className="learning-play-lab__mode-check" />
            ) : null}
          </GameButton>
        ))}
      </nav>
      {playlistDone ? (
        <section className="learning-play-lab__finish" aria-live="polite">
          <PlayIcon name="spark" />
          <h2>{t("play.lab.mixDone")}</h2>
          <p>
            {t("play.lab.mixSummary", {
              complete: playlist?.filter((result) => result.status === "completed").length ?? 0,
              skipped: playlist?.filter((result) => result.status === "skipped").length ?? 0,
            })}
          </p>
          <GameButton sound={false} onClick={startPlaylist}>
            {t("play.lab.again")}
          </GameButton>
        </section>
      ) : (
        <>
          <div className="learning-play-lab__variant">
            <span>
              {playlist !== null
                ? `${t("play.lab.mixing")} · ${modes.indexOf(mode) + 1} / 5`
                : t("play.lab.variant", { count: variant + 1 })}
            </span>
            {playlist === null ? (
              <GameButton
                sound={false}
                static
                type="button"
                variant="ghost"
                onClick={() => {
                  setVariant((value) => (value + 1) % variants.length);
                  setRound((value) => value + 1);
                }}
              >
                {t("play.lab.example")}
                <PlayIcon name="arrow" />
              </GameButton>
            ) : null}
          </div>
          <div ref={activityTop} tabIndex={-1} className="learning-play-lab__activity">
            <LearningActivity
              key={`${activity.id}:${round}`}
              activity={activity}
              onResult={record}
              onNext={next}
              nextLabel={
                playlist !== null && mode === modes[modes.length - 1]
                  ? t("play.lab.mixDone")
                  : undefined
              }
            />
          </div>
        </>
      )}
      <p className="learning-play-lab__note">{t("play.lab.note")}</p>
      <details className="play-model-note learning-play-lab__research">
        <summary>{t("play.lab.research")}</summary>
        <p>{t(collection === "ai" ? "play.ai.researchCopy" : "play.lab.researchCopy")}</p>
        <div>
          {collection === "ai" ? (
            <>
              <a
                href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
                target="_blank"
                rel="noreferrer"
              >
                Anthropic · Context engineering
              </a>
              <a
                href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
                target="_blank"
                rel="noreferrer"
              >
                Anthropic · Agent evaluations
              </a>
              <a
                href="https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/"
                target="_blank"
                rel="noreferrer"
              >
                Microsoft · Human–AI interaction
              </a>
            </>
          ) : (
            <>
              <a
                href="https://ies.ed.gov/ncee/wwc/PracticeGuide/1"
                target="_blank"
                rel="noreferrer"
              >
                IES · Learning & instruction
              </a>
              <a href="https://arxiv.org/abs/1306.6544" target="_blank" rel="noreferrer">
                PhET · Implicit scaffolding
              </a>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
