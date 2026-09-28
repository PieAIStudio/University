import { useEffect, useState, type ReactNode } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { ChestReward } from "@pieai/university-core";

import { useI18n } from "../i18n/index.js";

export type ChestRewardTier = "wood" | "rare" | "epic" | "legendary";

/**
 * Where the chest after a lesson stands (V7 station 4), from the learner's side:
 * `closed` waits for the tap, `opening` plays in the scene (a tap skips to the
 * end), `rewards` lists what the record gained, `throwing` watches the star
 * chase the next monster away, `done` hands back to the map.
 */
export type ChestRewardStage = "closed" | "opening" | "rewards" | "throwing" | "done";

const TIER_NAME = {
  wood: "chest.tier.wood",
  rare: "chest.tier.rare",
  epic: "chest.tier.epic",
  legendary: "chest.tier.legendary",
} as const;

/** Seconds between one reward line and the next; the badge, largest, comes last. */
const REVEAL_SECONDS = 0.45;

/**
 * The DOM half of the chest opening: every word the learner reads while the
 * island plays the chest, the star and the monster. Numbers come from
 * `chestReward` in core, which reads them out of the learning record; a line
 * whose number the record does not support is not shown. Under reduced motion
 * the rewards appear together.
 */
export function ChestRewards({
  stage,
  tier,
  upgraded,
  reward,
  dailyFirst,
  lessonNumber,
  guardName,
  reducedMotion,
  onOpen,
  onSkip,
  onThrow,
  onContinue,
}: {
  readonly stage: ChestRewardStage;
  readonly tier: ChestRewardTier;
  /** Every exercise was right first time, so the chest went up a tier. */
  readonly upgraded: boolean;
  readonly reward: ChestReward;
  /** The day's first lesson: its XP was doubled. */
  readonly dailyFirst: boolean;
  readonly lessonNumber: number;
  /** The monster the knowledge star chases away; absent when nothing stands next. */
  readonly guardName?: string | null;
  readonly reducedMotion: boolean;
  readonly onOpen: () => void;
  readonly onSkip: () => void;
  readonly onThrow: () => void;
  readonly onContinue: () => void;
}): ReactNode {
  const interfaceTranslator = useI18n();
  const t = interfaceTranslator.t;
  const tierName = t(TIER_NAME[tier]);

  const lines: { key: string; text: string; badge?: boolean }[] = [];
  if (reward.xp > 0)
    lines.push({
      key: "xp",
      text: dailyFirst
        ? t("chest.reward.xpDoubled", { xp: reward.xp })
        : t("chest.reward.xp", { xp: reward.xp }),
    });
  if (reward.levelAfter > reward.levelBefore)
    lines.push({ key: "level", text: t("chest.reward.level", { level: reward.levelAfter }) });
  if (reward.reviewCards > 0)
    lines.push({
      key: "review",
      text: t("chest.reward.reviewCards", { count: reward.reviewCards }),
    });
  if (reward.knowledgeCards > 0)
    lines.push({
      key: "knowledge",
      text: t("chest.reward.knowledgeCards", { count: reward.knowledgeCards }),
    });
  if (reward.streakDay > 0)
    lines.push({ key: "streak", text: t("chest.reward.streak", { day: reward.streakDay }) });
  for (const badge of reward.badges)
    lines.push({
      key: `badge:${badge.id}`,
      text: t("chest.reward.badge", { name: badge.name }),
      badge: true,
    });

  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (stage !== "rewards" && stage !== "throwing" && stage !== "done") {
      setShown(0);
      return;
    }
    if (reducedMotion) {
      setShown(lines.length);
      return;
    }
    if (shown >= lines.length) return;
    const timer = window.setTimeout(() => setShown((count) => count + 1), REVEAL_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [stage, shown, lines.length, reducedMotion]);
  const allShown = shown >= lines.length;

  return (
    <section
      className={`chest-rewards chest-rewards--${stage}`}
      data-chest-stage={stage}
      aria-label={t("chest.label", { tier: tierName, number: lessonNumber })}
    >
      <p className="chest-rewards__title">
        {upgraded && stage !== "closed" ? t("chest.upgraded", { tier: tierName }) : tierName}
        {dailyFirst && stage !== "closed" ? (
          <span className="chest-rewards__first">{t("chest.dailyFirst")}</span>
        ) : null}
      </p>

      {stage === "closed" ? (
        <GameButton type="button" variant="primary" onClick={onOpen} data-chest-action="open">
          {t("chest.open")}
        </GameButton>
      ) : null}

      {stage === "opening" ? (
        <GameButton type="button" variant="secondary" onClick={onSkip} data-chest-action="skip">
          {t("chest.skip")}
        </GameButton>
      ) : null}

      {stage === "rewards" || stage === "throwing" || stage === "done" ? (
        <ul className="chest-rewards__list" aria-live="polite">
          {lines.slice(0, shown).map((line) => (
            <li
              key={line.key}
              className={
                line.badge
                  ? "chest-rewards__line chest-rewards__line--badge"
                  : "chest-rewards__line"
              }
            >
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}

      {stage === "rewards" && allShown && guardName ? (
        <>
          <p className="chest-rewards__guard">{t("chest.guard", { name: guardName })}</p>
          <GameButton type="button" variant="primary" onClick={onThrow} data-chest-action="throw">
            {t("chest.throw")}
          </GameButton>
        </>
      ) : null}

      {(stage === "rewards" && allShown && !guardName) || stage === "done" ? (
        <GameButton
          type="button"
          variant="primary"
          onClick={onContinue}
          data-chest-action="continue"
        >
          {t("chest.continue")}
        </GameButton>
      ) : null}
    </section>
  );
}
