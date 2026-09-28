import type { LearningSegment, MapLearningKind } from "@pieai/university-core";
import { interfaceTranslator } from "@pieai/university-ui/i18n.js";
import { SPRITE_WINDOW } from "../labels/path-overlay.js";
import type { LessonPlacement, Marker } from "../Maps.js";
import { courseLearningSites, learningSiteLocked } from "./learning-sites.js";
import { courseWeeklyBoss } from "./chests-and-monsters.js";
import { weeklyBossAnchor } from "./weekly-roam.js";

export {
  lessonChestTier,
  monsterAtStop,
  openingGuard,
  type ChestOwner,
  type ChestTier,
  type MonsterRole,
} from "./chests-and-monsters.js";
export { UPGRADE_LEAD, type CourseOpening, type OpeningPhase } from "./ChestOpening.js";
export { openedTier, openingLength } from "./chest-opening.js";
export type { BossStrike, WeeklyBossScene } from "./boss-strike.js";

const symbols = { personal: "✦", challenge: "⚡", checkpoint: "◇" } as const;
/**
 * A node's chip floats over its stone exactly as a lesson's kind icon floats
 * over its own (`courseSprites`): one height for every place the avatar can
 * stand, so the chips read as one row of stops (V5 R59).
 */
const STOP_CHIP_LIFT = 1.05;

/**
 * DOM chips for the learning nodes. Their positions come from the same
 * `courseLearningSites` the 3D stones stand on, so the chip always names the
 * thing under it. Like a lesson's kind icon, a chip sits pinned on its stone;
 * chips beyond the lesson icons' window stay in the DOM, quiet, for keyboards.
 * A node that found no free ground has no stone and no chip: a chip floating
 * over bare grass was a name for nothing. The course's opportunity list still
 * reaches it.
 */
export function learningOpportunityMarkers(
  lessons: readonly LessonPlacement[],
  segments: readonly LearningSegment[],
  onPick: (segment: LearningSegment, kind: MapLearningKind, locked: boolean) => void,
): readonly Marker[] {
  const live = Math.max(
    0,
    lessons.findIndex((lesson) => lesson.state === "live"),
  );
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  return courseLearningSites(lessons).flatMap((site) => {
    // The app's segments carry the real unit titles; the sites carry geometry.
    const segment = byId.get(site.segment.id);
    if (!segment || !site.resolved) return [];
    const locked = learningSiteLocked(site, lessons);
    const position = site.ground.clone();
    position.y += STOP_CHIP_LIFT;
    const inWindow =
      segment.lastIndex >= live - SPRITE_WINDOW && segment.firstIndex <= live + SPRITE_WINDOW;
    const label = `${interfaceTranslator.t(`mapNodes.${site.kind}`)} · ${interfaceTranslator.t("mapNodes.range", { first: segment.firstIndex + 1, last: segment.lastIndex + 1 })}`;
    return [
      {
        id: site.id,
        kind: "icon" as const,
        learningKind: site.kind,
        text: symbols[site.kind],
        label,
        position,
        pinned: true,
        quiet: !inWindow,
        locked,
        activate: () => onPick(segment, site.kind, locked),
      },
    ];
  });
}

/**
 * The weekly boss's chip: a crown over its head, the same DOM label the stones
 * wear, so a keyboard, a screen reader and a thumb can start the fight — picking
 * the boss in the canvas is a mouse-only way in. It stands where the scene puts
 * the boss, from the same `courseWeeklyBoss`.
 */
export function weeklyBossMarker(
  lessons: readonly LessonPlacement[],
  week: string,
  label: string,
  activate: () => void,
): Marker | null {
  const boss = courseWeeklyBoss(lessons, courseLearningSites(lessons), week);
  if (!boss) return null;
  // The same point the scene moves as it roams, so the chip follows it.
  const position = weeklyBossAnchor(boss).chip;
  return {
    id: `weekly-boss:${week}`,
    kind: "icon",
    text: "♛",
    label,
    position,
    pinned: true,
    weight: 2,
    activate,
  };
}

export { learningSiteLocked } from "./learning-sites.js";
