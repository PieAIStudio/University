import { GameBadge, GameCallout, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
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
export const LEAGUE_TITLE = "排行榜";

export function LeagueScreen({
  document: progress,
  now = Date.now(),
  signedIn = false,
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
        <p className="shell-screen__lede">
          段位不看你今天学了多少，看你三周之后还记得多少。今天再拼命也涨不了——
          这一格只有等时间过去、而你还答得对，才会动。
        </p>
      </header>

      <GamePanel tone="strong">
        <div className="league-standing">
          <div className="league-standing__tier">
            <span className="league-standing__name">{standing.tier.name}</span>
            <GameBadge tone="success">{standing.cards} 张记牢了</GameBadge>
          </div>
          <GameProgress
            label={standing.next ? `到${standing.next.name}` : "已在顶阶"}
            value={standing.progress}
            max={1}
            tone="success"
            valueLabel={
              standing.next ? `${standing.cards} / ${standing.next.at}` : `${standing.cards}`
            }
          />
          <p className="league-standing__note">
            「记牢了」指记忆间隔已经超过 {LONG_TERM_STABILITY_DAYS} 天的卡片。 本周读了{" "}
            {standing.lessonsThisWeek} 节。
          </p>
        </div>
      </GamePanel>

      <ol className="league-ladder">
        {LEAGUE_TIERS.map((tier) => (
          <li
            key={tier.id}
            className={`league-rung${tier.id === standing.tier.id ? " league-rung--here" : ""}`}
            aria-current={tier.id === standing.tier.id ? "true" : undefined}
          >
            <span className="league-rung__name">{tier.name}</span>
            <span className="league-rung__at">{tier.at} 张</span>
          </li>
        ))}
      </ol>

      {signedIn ? null : (
        <GameCallout tone="info" heading="还没有别人可以比">
          和真人排名要有账号。我们不打算先摆三十个编出来的名字在这儿——
          那样等你发现是假的，旁边那些真数字你也不会再信了。
        </GameCallout>
      )}
    </section>
  );
}
