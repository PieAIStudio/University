import { weeklyBossHistory, type ProgressDocument } from "@pieai/university-core";
import { GameIcon, GamePanel } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../../i18n/index.js";

/** The permanent record is text, not an ever-growing WebGL scene. */
export function WeeklyBossRecords({
  document,
  now,
}: {
  readonly document: ProgressDocument;
  readonly now: number;
}) {
  const t = useI18n();
  const history = weeklyBossHistory(document, now);
  return (
    <GamePanel>
      <section
        className="weekly-boss-records"
        aria-labelledby="weekly-boss-records-title"
        data-weekly-wins={history.total}
      >
        <h2 id="weekly-boss-records-title">
          <GameIcon icon="crown" size="sm" /> {t.t("weeklyBoss.history.title")}
        </h2>
        <div className="weekly-boss-records__counts">
          <p>{t.t("weeklyBoss.history.total", { count: history.total })}</p>
          <p>{t.t("weeklyBoss.history.streak", { count: history.currentStreak })}</p>
          <p>{t.t("weeklyBoss.history.longest", { count: history.longestStreak })}</p>
        </div>
        {history.total === 0 ? (
          <p>{t.t("weeklyBoss.history.empty")}</p>
        ) : (
          <details className="product-details">
            <summary>{t.t("weeklyBoss.history.details")}</summary>
            <p>{t.t("weeklyBoss.history.sceneLimit")}</p>
            <ol className="weekly-boss-records__weeks">
              {history.weeks.map((win) => (
                <li key={win.week} data-weekly-win={win.week}>
                  <time dateTime={win.week}>{win.week}</time> ·{" "}
                  {t.t(win.flawless ? "weeklyBoss.history.flawless" : "weeklyBoss.history.won")}
                  {win.location === null ? <small>{t.t("weeklyBoss.history.legacy")}</small> : null}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>
    </GamePanel>
  );
}
