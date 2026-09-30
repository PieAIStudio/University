import type { WeeklyBossWin } from "@pieai/university-core";
import type { Vector3 } from "three";
import type { LessonPlacement } from "../Maps.js";
import {
  courseLearningSites,
  courseStandingFootprints,
  learningSiteExclusions,
} from "./learning-sites.js";
import { chestAndMonsterFootprints, courseWeeklyBoss } from "./chests-and-monsters.js";
import {
  COSMETIC_ORNAMENT_RADIUS,
  cosmeticOrnamentPlacement,
  type OrnamentObstacle,
} from "./cosmetic-ornament.js";

export const WEEKLY_CROWN_LIMIT = 8;
export interface WeeklyCrownSpot {
  readonly week: string;
  readonly at: Vector3;
}
const EMPTY: readonly WeeklyCrownSpot[] = [];
// One recent projection per live blueprint, not a history-sized global cache.
const cache = new WeakMap<
  LessonPlacement["blueprint"],
  { key: string; spots: readonly WeeklyCrownSpot[] }
>();

/** A late, bounded presentation pass. Only an explicit recorded arrival may
 * place a crown. It reads the existing field and all already occupied ground,
 * and never moves a route, tree, chest, vignette, ornament or avatar. */
export function weeklyCrownPlacements(
  lessons: readonly LessonPlacement[],
  wins: readonly WeeklyBossWin[],
  additional: readonly OrnamentObstacle[] = [],
): readonly WeeklyCrownSpot[] {
  const first = lessons[0];
  if (!first) return EMPTY;
  const recent = wins
    .filter(
      (win) => win.location?.studyId === first.studyId && win.location.courseId === first.courseId,
    )
    .slice(0, WEEKLY_CROWN_LIMIT)
    .reverse();
  if (recent.length === 0) return EMPTY;
  const key = JSON.stringify([
    recent.map((win) => [win.week, win.location]),
    lessons.map((lesson) => [lesson.lessonId, lesson.unitId, lesson.position.toArray()]),
    additional,
  ]);
  const known = cache.get(first.blueprint);
  if (known?.key === key) return known.spots;
  const sites = courseLearningSites(lessons);
  const obstacles: OrnamentObstacle[] = [
    ...courseStandingFootprints(first.blueprint).map((item) => ({
      x: item.x,
      z: item.z,
      radius: item.r,
    })),
    ...learningSiteExclusions(sites),
    ...chestAndMonsterFootprints(lessons, sites),
    ...lessons.map((lesson) => ({
      x: lesson.position.x,
      z: lesson.position.z,
      radius: first.blueprint.route.nodeRadius + 0.12,
    })),
    ...additional,
  ];
  const placed: WeeklyCrownSpot[] = [];
  for (const win of recent) {
    const home = courseWeeklyBoss(lessons, sites, win.week, win.location!.lessonId);
    if (!home) continue;
    const at = cosmeticOrnamentPlacement(first.blueprint, home.position, obstacles);
    if (!at) continue; // The DOM record survives even when safe ground does not.
    placed.push({ week: win.week, at });
    obstacles.push({ x: at.x, z: at.z, radius: COSMETIC_ORNAMENT_RADIUS });
  }
  cache.set(first.blueprint, { key, spots: placed });
  return placed;
}
