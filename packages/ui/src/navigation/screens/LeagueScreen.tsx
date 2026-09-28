import type { ReactNode } from "react";
import { interfaceTranslator, useI18n } from "../../i18n/index.js";
import { GameAssetIcon, GameBadge, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import { leagueTierName } from "../league-tier-name.js";
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
export const LEAGUE_TITLE = interfaceTranslator.t("product.growth.title");

export function LeagueScreen({
  document: progress,
  now = Date.now(),
  emblem,
}: {
  readonly document: ProgressDocument;
  readonly now?: number;
  readonly signedIn?: boolean;
  /** A rank's picture by tier id: the app passes V7's 3D emblem; this package stays free of three. */
  readonly emblem?: (tierId: string) => ReactNode;
}) {
  const interfaceTranslator = useI18n();
  const standing = leagueStanding(progress, now);

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{LEAGUE_TITLE}</h1>
        <p className="shell-screen__lede">{interfaceTranslator.t("product.growth.intro")}</p>
      </header>

      <GamePanel tone="strong">
        <div className="league-standing">
          <div className="league-standing__tier">
            {emblem ? (
              <span className="league-standing__emblem" aria-hidden="true">
                {emblem(standing.tier.id)}
              </span>
            ) : (
              <GameAssetIcon icon="medal" size="lg" />
            )}
            <span className="league-standing__name">{leagueTierName(standing.tier)}</span>
            <GameBadge tone="success">
              {standing.cards}{" "}
              {interfaceTranslator.t("ui.navigation.screens.leagueScreen.copy.张记牢了")}
            </GameBadge>
          </div>
          <GameProgress
            label={
              standing.next
                ? interfaceTranslator.t("ui.navigation.screens.leagueScreen.copy.到value0", {
                    value0: standing.next.name,
                  })
                : interfaceTranslator.t("ui.navigation.screens.leagueScreen.copy.已在顶阶")
            }
            value={standing.progress}
            max={1}
            tone="success"
            valueLabel={
              standing.next ? `${standing.cards} / ${standing.next.at}` : `${standing.cards}`
            }
          />
          <p className="league-standing__note">
            {interfaceTranslator.t("product.growth.week", { count: standing.lessonsThisWeek })}
          </p>
        </div>
      </GamePanel>

      <details className="product-details" data-growth-details>
        <summary>{interfaceTranslator.t("product.growth.details")}</summary>
        <p>{interfaceTranslator.t("product.growth.rule", { days: LONG_TERM_STABILITY_DAYS })}</p>
        <ol className="league-ladder">
          {LEAGUE_TIERS.map((tier) => (
            <li
              key={tier.id}
              className={`league-rung${tier.id === standing.tier.id ? " league-rung--here" : ""}`}
              aria-current={tier.id === standing.tier.id ? "true" : undefined}
            >
              {emblem ? (
                <span className="league-rung__emblem" aria-hidden="true">
                  {emblem(tier.id)}
                </span>
              ) : null}
              <span className="league-rung__name">{leagueTierName(tier)}</span>
              <span className="league-rung__at">
                {tier.at} {interfaceTranslator.t("ui.navigation.screens.leagueScreen.copy.张")}
              </span>
            </li>
          ))}
        </ol>
      </details>
      <a className="linkish" href="/practice">
        {interfaceTranslator.t("product.growth.action")}
      </a>
    </section>
  );
}
