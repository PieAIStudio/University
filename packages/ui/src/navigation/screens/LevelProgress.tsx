import { GameBadge, GameProgress } from "@pieai/swimmer-ui-kit";
import { levelOf } from "@pieai/university-core";

/**
 * The learner's level shown in the shared chrome and on the profile.
 *
 * The kit already owns both visual primitives: the level is a badge and the
 * progress is a linear bar. Keeping this as one small composition means the
 * rail and the profile cannot drift into two different XP readings.
 */
export function LevelProgress({
  totalXp,
  rail = false,
}: {
  readonly totalXp: number;
  readonly rail?: boolean;
}) {
  const level = levelOf(totalXp);

  return (
    <section className={`learner-level${rail ? " learner-level--rail" : ""}`} aria-label="等级进度">
      <div className="learner-level__head">
        <GameBadge>Lv. {level.level}</GameBadge>
      </div>
      <GameProgress
        label="XP"
        value={level.xpIntoLevel}
        max={level.xpForNextLevel}
        tone="accent"
        valueLabel={`${level.xpIntoLevel} / ${level.xpForNextLevel} XP`}
      />
    </section>
  );
}
