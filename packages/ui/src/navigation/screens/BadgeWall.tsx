import { translate } from "../../i18n/index.js";
import { GameBadge, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import { badgesFor, type Badge, type ProgressDocument } from "@pieai/university-core";

/**
 * 徽章墙 — ten badges, all rules visible, none of them a secret.
 *
 * A hidden badge is a puzzle, and this is not a game about guessing what the
 * game wants. A locked one shows its rule and how far along you are, which
 * makes the wall a list of things worth doing rather than a list of things you
 * have not done.
 */
export const BADGE_WALL_TITLE = translate("ui.navigation.screens.badgeWall.copy.徽章墙");

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <li className={`badge-tile${badge.earned ? " badge-tile--earned" : ""}`}>
      <div className="badge-tile__disc" aria-hidden="true">
        {badge.earned ? "★︎" : "○"}
      </div>
      <div className="badge-tile__body">
        <div className="badge-tile__head">
          <span className="badge-tile__name">{badge.name}</span>
          {badge.earned ? (
            <GameBadge tone="success">
              {translate("ui.navigation.screens.badgeWall.copy.已获得")}
            </GameBadge>
          ) : null}
        </div>
        <p className="badge-tile__how">{badge.how}</p>
        {badge.earned ? null : (
          <GameProgress label={badge.name} value={badge.progress} max={1} tone="accent" showValue />
        )}
      </div>
    </li>
  );
}

export function BadgeWall({
  document: progress,
  coursesFinished = 0,
}: {
  readonly document: ProgressDocument;
  readonly coursesFinished?: number;
}) {
  const badges = badgesFor(progress, coursesFinished);
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{BADGE_WALL_TITLE}</h1>
        <p className="shell-screen__lede">
          {translate(
            "ui.navigation.screens.badgeWall.copy.十枚-其中四枚不是靠量能拿到的-三枚要真的过了那么多天-一枚要排程同意你确实记住了-一下午就能刷完的墙-一周后就",
          )}
        </p>
      </header>

      <GamePanel tone="strong">
        <GameProgress
          label={translate("ui.navigation.screens.badgeWall.copy.已获得")}
          value={earned}
          max={badges.length}
          tone={earned > 0 ? "success" : "accent"}
          valueLabel={`${earned} / ${badges.length}`}
        />
      </GamePanel>

      <ul className="badge-wall">
        {badges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} />
        ))}
      </ul>
    </section>
  );
}
