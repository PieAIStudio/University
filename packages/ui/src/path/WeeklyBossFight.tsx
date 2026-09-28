import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  answerWeeklyBoss,
  startWeeklyBossRound,
  weeklyBossDaysLeft,
  weeklyBossFlawless,
  weeklyBossHeartsLeft,
  weeklyBossRoundOver,
  weeklyBossRoundWon,
  WEEKLY_BOSS_HEARTS,
  WEEKLY_BOSS_HIT_XP,
  type WeeklyBoss,
  type WeeklyBossRound,
} from "@pieai/university-core";

import { useI18n } from "../i18n/index.js";
import { QuestionStep } from "./QuestionStep.js";

/** What one answer did, for the island (a star, a head shake) and the record (a heart). */
export interface WeeklyBossStrike {
  readonly verdict: "correct" | "wrong";
  /** The XP event for the heart this answer took; null on a miss. */
  readonly hitEventId: string | null;
  /** The last heart fell: the boss runs and leaves its chest. */
  readonly won: boolean;
  readonly flawless: boolean;
}

type Sitting =
  | { readonly kind: "intro" }
  | {
      readonly kind: "asking";
      readonly round: WeeklyBossRound;
      readonly answer: string;
      readonly blank: boolean;
      /** The last answer's result, shown until the learner moves on. */
      readonly last: { readonly verdict: "correct" | "wrong"; readonly lessonKey: string } | null;
    };

/**
 * The weekly boss's fight, from the learner's side (V7 mechanic 8; rules in
 * PLAN-V7-07 §2a): every word they read while the island plays the stars.
 *
 * One card, low over the island like the chest's, so the boss stays in sight.
 * It asks with the skip test's own question card, counts hearts rather than
 * questions, and never takes anything away: a miss names the lesson the
 * question came from and offers it, and when a round runs out with hearts
 * still standing another starts at once.
 */
export function WeeklyBossFight({
  boss,
  now,
  lessonTitle,
  onStrike,
  onOpenLesson,
  onClose,
  pick,
}: {
  readonly boss: WeeklyBoss;
  readonly now: number;
  /** A lesson's title by its document key, `study/course/lesson`. */
  readonly lessonTitle: (lessonKey: string) => string;
  readonly onStrike: (strike: WeeklyBossStrike) => void;
  readonly onOpenLesson: (lessonKey: string) => void;
  readonly onClose: () => void;
  /** Injected by tests so one draw can be replayed; the product draws at random. */
  readonly pick?: (length: number) => number;
}) {
  const interfaceTranslator = useI18n();
  const t = interfaceTranslator.t;
  const [sitting, setSitting] = useState<Sitting>({ kind: "intro" });

  const begin = () =>
    setSitting({
      kind: "asking",
      round: startWeeklyBossRound(boss, pick),
      answer: "",
      blank: false,
      last: null,
    });

  const hearts =
    sitting.kind === "asking" ? weeklyBossHeartsLeft(sitting.round) : Math.max(0, boss.hearts);

  function submit() {
    if (sitting.kind !== "asking") return;
    const question = sitting.round.questions[sitting.round.verdicts.length];
    if (!question) return;
    const step = answerWeeklyBoss(sitting.round, sitting.answer);
    if (step.verdict === "unanswered") {
      setSitting({ ...sitting, blank: true });
      return;
    }
    const won = weeklyBossRoundWon(step.round);
    onStrike({
      verdict: step.verdict,
      hitEventId: step.hitEventId,
      won,
      flawless: weeklyBossFlawless(step.round),
    });
    if (won) return;
    setSitting({
      kind: "asking",
      round: step.round,
      answer: "",
      blank: false,
      last: { verdict: step.verdict, lessonKey: question.lessonId },
    });
  }

  const next = () => sitting.kind === "asking" && setSitting({ ...sitting, last: null });

  return (
    <section
      className="weekly-boss-fight"
      data-weekly-boss-stage={sitting.kind === "intro" ? "intro" : sitting.last ? "result" : "ask"}
      aria-label={t("weeklyBoss.name")}
    >
      <header className="weekly-boss-fight__head">
        <p className="weekly-boss-fight__title">
          <CrownIcon />
          {t("weeklyBoss.name")}
        </p>
        <p className="weekly-boss-fight__days">
          {t("weeklyBoss.daysLeft", { days: weeklyBossDaysLeft(boss, now) })}
        </p>
        <p
          className="weekly-boss-fight__hearts"
          role="img"
          aria-label={t("weeklyBoss.hearts", { hearts })}
          data-hearts={hearts}
        >
          {Array.from({ length: WEEKLY_BOSS_HEARTS }, (_, index) => (
            <HeartIcon key={index} full={index < hearts} />
          ))}
        </p>
      </header>

      {sitting.kind === "intro" ? (
        <>
          <p className="weekly-boss-fight__pitch">{t("weeklyBoss.pitch")}</p>
          <p className="weekly-boss-fight__note">
            {boss.hearts === WEEKLY_BOSS_HEARTS
              ? t("weeklyBoss.flawlessHint")
              : t("weeklyBoss.keepHint")}
          </p>
          <div className="weekly-boss-fight__actions">
            <GameButton variant="primary" onClick={begin} data-weekly-boss-action="fight">
              {t("weeklyBoss.fight")}
            </GameButton>
            <GameButton variant="ghost" onClick={onClose} data-weekly-boss-action="leave">
              {t("weeklyBoss.notNow")}
            </GameButton>
          </div>
        </>
      ) : sitting.last ? (
        <div className="weekly-boss-fight__result" aria-live="polite">
          <p className="weekly-boss-fight__verdict" data-verdict={sitting.last.verdict}>
            {sitting.last.verdict === "correct"
              ? t("weeklyBoss.hit", { xp: WEEKLY_BOSS_HIT_XP })
              : t("weeklyBoss.miss", { lesson: lessonTitle(sitting.last.lessonKey) })}
          </p>
          {weeklyBossRoundOver(sitting.round) ? (
            <>
              <p className="weekly-boss-fight__note">
                {t("weeklyBoss.roundOver", { hearts })} {t("weeklyBoss.keepHint")}
              </p>
              <div className="weekly-boss-fight__actions">
                <GameButton variant="primary" onClick={begin} data-weekly-boss-action="again">
                  {t("weeklyBoss.again")}
                </GameButton>
                <GameButton variant="ghost" onClick={onClose} data-weekly-boss-action="leave">
                  {t("weeklyBoss.leave")}
                </GameButton>
              </div>
            </>
          ) : (
            <div className="weekly-boss-fight__actions">
              <GameButton variant="primary" onClick={next} data-weekly-boss-action="next">
                {t("weeklyBoss.next")}
              </GameButton>
            </div>
          )}
          {sitting.last.verdict === "wrong" ? (
            <button
              type="button"
              className="text-button weekly-boss-fight__reread"
              onClick={() => sitting.last && onOpenLesson(sitting.last.lessonKey)}
            >
              {t("weeklyBoss.reread")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="weekly-boss-fight__question">
          {(() => {
            const question = sitting.round.questions[sitting.round.verdicts.length];
            return question ? (
              <QuestionStep
                question={question}
                answer={sitting.answer}
                blank={sitting.blank}
                inputId="weekly-boss-answer"
                submitLabel={t("weeklyBoss.submit")}
                onAnswer={(answer) => setSitting({ ...sitting, answer, blank: false })}
                onSubmit={submit}
              />
            ) : null;
          })()}
        </div>
      )}
    </section>
  );
}

function HeartIcon({ full }: { readonly full: boolean }) {
  return (
    <svg
      className="weekly-boss-fight__heart"
      data-full={full || undefined}
      viewBox="0 0 16 14"
      aria-hidden="true"
    >
      <path d="M8 13.5 1.6 7.2A3.9 3.9 0 0 1 8 2.4a3.9 3.9 0 0 1 6.4 4.8Z" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg className="weekly-boss-fight__crown" viewBox="0 0 18 14" aria-hidden="true">
      <path d="M1 3.5 5 7l4-6 4 6 4-3.5-1.6 9.5H2.6Z" />
    </svg>
  );
}
