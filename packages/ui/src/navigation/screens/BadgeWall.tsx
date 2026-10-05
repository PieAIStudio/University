import type { ReactNode } from "react";
import { interfaceTranslator, useI18n } from "../../i18n/index.js";
import { GameBadge, GamePanel, GameProgress } from "@pieai/swimmer-ui-kit";
import { badgesFor, type Badge, type ProgressDocument } from "@pieai/university-core";
import { badgeCopy } from "../badge-copy.js";

/**
 * 徽章墙 — seventeen badges, all rules visible, none of them a secret.
 *
 * A hidden badge is a puzzle, and this is not a game about guessing what the
 * game wants. A locked one shows its rule and how far along you are, which
 * makes the wall a list of things worth doing rather than a list of things you
 * have not done.
 */
export const BADGE_WALL_TITLE = interfaceTranslator.t(
  "ui.navigation.screens.badgeWall.copy.徽章墙",
);

/** The picture on a badge's disc: the app passes V7's 3D emblem; this package stays free of three. */
export type BadgeEmblem = (badge: Badge) => ReactNode;

function BadgeTile({ badge: source, emblem }: { badge: Badge; emblem?: BadgeEmblem | undefined }) {
  const interfaceTranslator = useI18n();
  const badge = badgeCopy(source, interfaceTranslator);
  return (
    <li className={`badge-tile${badge.earned ? " badge-tile--earned" : ""}`}>
      <div
        className={emblem ? "badge-tile__disc badge-tile__disc--emblem" : "badge-tile__disc"}
        aria-hidden="true"
      >
        {emblem ? emblem(badge) : badge.earned ? "★︎" : "○"}
      </div>
      <div className="badge-tile__body">
        <div className="badge-tile__head">
          <span className="badge-tile__name">{badge.name}</span>
          {badge.earned ? (
            <GameBadge tone="success">
              {interfaceTranslator.t("ui.navigation.screens.badgeWall.copy.已获得")}
            </GameBadge>
          ) : null}
        </div>
        <p className="badge-tile__how">{badge.how}</p>
        {badge.earned ? null : (
          <GameProgress label={badge.name} value={badge.progress} max={1} showValue />
        )}
      </div>
    </li>
  );
}

export function BadgeWall({
  document: progress,
  coursesFinished = 0,
  pathsFinished = 0,
  embedded = false,
  emblem,
}: {
  readonly document: ProgressDocument;
  readonly coursesFinished?: number;
  readonly pathsFinished?: number;
  readonly embedded?: boolean;
  readonly emblem?: BadgeEmblem;
}) {
  const interfaceTranslator = useI18n();
  const badges = badgesFor(progress, coursesFinished, pathsFinished);
  const earned = badges.filter((badge) => badge.earned).length;
  const Heading = embedded ? "h2" : "h1";

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <Heading>{BADGE_WALL_TITLE}</Heading>
        <p className="shell-screen__lede">
          {interfaceTranslator.t("album.badge.wall", { count: badges.length })}
        </p>
      </header>

      <GamePanel tone="strong">
        <GameProgress
          label={interfaceTranslator.t("ui.navigation.screens.badgeWall.copy.已获得")}
          value={earned}
          max={badges.length}
          valueLabel={`${earned} / ${badges.length}`}
        />
      </GamePanel>

      <ul className="badge-wall">
        {badges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} emblem={emblem} />
        ))}
      </ul>
    </section>
  );
}
