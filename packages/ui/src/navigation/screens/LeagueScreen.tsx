import { translate } from "../../i18n/index.js";
import { GameAssetIcon, GameBadge, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import {
  LEAGUE_TIERS,
  LONG_TERM_STABILITY_DAYS,
  leagueStanding,
  type ProgressDocument,
} from "@pieai/university-core";

/**
 * 排行榜 — your own standing, and no invented strangers.
 *
 * The tier is cut on cards you can still recall after three weeks, which is
 * the one number nobody can move by working harder today. Ranking against real
 * people arrives with accounts; until then this screen says so, because a
 * leaderboard the learner later finds out was fictional discredits every real
 * number sitting next to it.
 */
export const LEAGUE_TITLE = translate("product.growth.title");

export function LeagueScreen({
  document: progress,
  now = Date.now(),
}: {
  readonly document: ProgressDocument;
  readonly now?: number;
  readonly signedIn?: boolean;
}) {
  const standing = leagueStanding(progress, now);

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{LEAGUE_TITLE}</h1>
        <p className="shell-screen__lede">{translate("product.growth.intro")}</p>
      </header>

      <GamePanel tone="strong">
        <div className="league-standing">
          <div className="league-standing__tier">
            <GameAssetIcon icon="medal" size="lg" />
            <span className="league-standing__name">{standing.tier.name}</span>
            <GameBadge tone="success">
              {standing.cards} {translate("ui.navigation.screens.leagueScreen.copy.张记牢了")}
            </GameBadge>
          </div>
          <GameProgress
            label={
              standing.next
                ? translate("ui.navigation.screens.leagueScreen.copy.到value0", {
                    value0: standing.next.name,
                  })
                : translate("ui.navigation.screens.leagueScreen.copy.已在顶阶")
            }
            value={standing.progress}
            max={1}
            tone="success"
            valueLabel={
              standing.next ? `${standing.cards} / ${standing.next.at}` : `${standing.cards}`
            }
          />
          <p className="league-standing__note">
            {translate("product.growth.week", { count: standing.lessonsThisWeek })}
          </p>
        </div>
      </GamePanel>

      <details className="product-details" data-growth-details>
        <summary>{translate("product.growth.details")}</summary>
        <p>{translate("product.growth.rule", { days: LONG_TERM_STABILITY_DAYS })}</p>
        <ol className="league-ladder">
          {LEAGUE_TIERS.map((tier) => (
            <li
              key={tier.id}
              className={`league-rung${tier.id === standing.tier.id ? " league-rung--here" : ""}`}
              aria-current={tier.id === standing.tier.id ? "true" : undefined}
            >
              <span className="league-rung__name">{tier.name}</span>
              <span className="league-rung__at">
                {tier.at} {translate("ui.navigation.screens.leagueScreen.copy.张")}
              </span>
            </li>
          ))}
        </ol>
      </details>
      <a className="linkish" href="/practice">
        {translate("product.growth.action")}
      </a>
    </section>
  );
}
