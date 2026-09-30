import { useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { DAILY_LESSON_GOALS, dailyLessonGoal, type ProgressPort } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";

export function DailyGoalControl({ progress }: { readonly progress: ProgressPort }) {
  const t = useI18n();
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const owner = progress.syncState().userId;
  const selected = dailyLessonGoal(document.account.preferences.dailyLessonGoal);
  return (
    <section className="settings-screen__block" data-daily-goal={selected}>
      <h2>{t.t("doors.settings.learning")}</h2>
      <div role="group" aria-label={t.t("doors.goal.label")} className="learner-destinations">
        {DAILY_LESSON_GOALS.map((goal) => (
          <GameButton
            key={goal}
            variant={selected === goal ? "primary" : "secondary"}
            static
            aria-pressed={selected === goal}
            onClick={() => {
              if (progress.syncState().userId !== owner) return;
              progress.setAccountPreferences({
                ...progress.accountData().preferences,
                dailyLessonGoal: goal,
              });
            }}
          >
            {t.t("doors.goal.count", { count: goal })}
          </GameButton>
        ))}
      </div>
      <p>{t.t("doors.goal.boundary")}</p>
      {progress.localSaveState?.() === "failed" ? (
        <p role="alert">{t.t("doors.practice.saveFailed")}</p>
      ) : null}
    </section>
  );
}
