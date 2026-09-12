import { useMemo, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  ACTIVITY_DIFFICULTIES,
  selectActivityLevel,
  type ActivityDifficulty,
  type ActivityLevels,
  type ActivityKind,
  type ActivityResult,
} from "@pieai/university-core";
import { getExampleFamily } from "./difficulty-examples.js";
import { translate as t, useI18n } from "../i18n/index.js";
import { SoundToggle } from "../sound/index.js";
import { LearningActivity } from "./LearningActivity.js";
import { getBaseExamples } from "./base-examples.js";
import { extraExamples } from "./extra-examples.js";
import { getProgramExamples } from "./program-examples.js";
import { getSortExamples } from "./sort-examples.js";
import { getContrastExamples } from "./contrast-examples.js";
import { getWeighExamples } from "./weigh-examples.js";
import { PlayIcon } from "./PlayIcon.js";
import { getAIBriefExamples } from "./ai-brief-examples.js";
import { getAIWorkflowExamples } from "./ai-workflow-examples.js";
import { getAIQualityExamples } from "./ai-quality-examples.js";

/*
  The lab's two shelves, exported so a test can hold them against the wire
  enum. `sort` had an engine, a renderer, three lessons using it and a gate
  checking it, and was still absent from this list — so the page that exists to
  let somebody try every game could only offer ten of the eleven, and nothing
  said so. A list of names is exactly the shape that goes stale quietly.
*/
export const FOUNDATION_MODES = [
  "connect",
  "sort",
  "contrast",
  "weigh",
  "tune",
  "hunt",
  "dispatch",
  "program",
] as const satisfies readonly ActivityKind[];

export const AI_MODES = [
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
        : [
            ...getBaseExamples(),
            ...getSortExamples(),
            ...getContrastExamples(),
            ...getWeighExamples(),
            ...extraExamples(),
            ...getProgramExamples(),
          ],
    [locale, collection],
  );
  const [mode, setMode] = useState<ActivityKind>(modes[0]!);
  const [variant, setVariant] = useState(0);
  const [difficulty, setDifficulty] = useState<ActivityDifficulty>("intro");
  const [round, setRound] = useState(0);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(() => new Set());
  const [playlist, setPlaylist] = useState<ActivityResult[] | null>(null);
  const [playlistDone, setPlaylistDone] = useState(false);
  const activityTop = useRef<HTMLDivElement>(null);
  const variants = examples.filter((example) => example.kind === mode);
  const baseActivity = variants[variant] ?? variants[0]!;
  const family = useMemo(() => getExampleFamily(baseActivity), [baseActivity]);
  const activity = selectActivityLevel(family, difficulty);
  /*
    The lab used to own a difficulty row of its own, beside the activity rather
    than on it. Once a lesson could carry its levels, that was two controls
    doing one job — and the lab's copy was the one a learner never sees, so it
    was the one that could drift. The picker now comes from the activity, and
    the lab only listens.
  */
  const levels = useMemo<ActivityLevels>(
    () => ({ id: family.id, levels: family.levels }),
    [family],
  );
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
      setCompleted(
        (previous) => new Set([...previous, `${result.kind}:${result.difficulty ?? "practice"}`]),
      );
    setPlaylist((previous) =>
      previous === null
        ? null
        : [...previous.filter((entry) => entry.kind !== result.kind), result],
    );
  };
  return (
    <div className="learning-play-lab">
      <h1 className="play-visually-hidden">
        {t(collection === "ai" ? "play.ai.title" : "play.lab.title")}
      </h1>
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
            </span>
            {completed.has(`${kind}:${difficulty}`) ? (
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
          <div className="learning-play-lab__options">
            <div className="learning-play-lab__variant">
              <span>
                {playlist !== null
                  ? `${t("play.lab.mixing")} · ${modes.indexOf(mode) + 1} / ${modes.length}`
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
          </div>
          <div ref={activityTop} tabIndex={-1} className="learning-play-lab__activity">
            <LearningActivity
              key={`${family.id}:${round}`}
              activity={activity}
              levels={levels}
              initialDifficulty={difficulty}
              onLevelChange={(level) => {
                setDifficulty(level);
                setPlaylistDone(false);
              }}
              occurrenceId={`${family.id}:${difficulty}:${round}`}
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
      <header className="learning-play-lab__intro">
        <div>
          <p className="learning-play-lab__closing-title">
            {t(collection === "ai" ? "play.ai.title" : "play.lab.title")}
          </p>
        </div>
        <div className="learning-play-lab__session">
          <span>
            {/*
              Both numbers come from the shelf being shown. The total used to be
              the character 五 baked into three sentences and a `/ 5` in the
              progress line, which was correct for exactly as long as there were
              five games — and `sort` was the sixth.
            */}
            {t("play.lab.session", {
              count: modes.filter((kind) =>
                ACTIVITY_DIFFICULTIES.some((level) => completed.has(`${kind}:${level}`)),
              ).length,
              total: modes.length,
            })}
          </span>
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
            {playlist !== null && !playlistDone
              ? t("play.lab.cancelMix")
              : t("play.lab.mix", { total: modes.length })}
          </GameButton>
        </div>
      </header>
      <p className="play-muted">{t("play.difficulty.change")}</p>
      <p className="learning-play-lab__intro-detail">
        {t(collection === "ai" ? "play.ai.intro" : "play.lab.intro")}
      </p>
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
