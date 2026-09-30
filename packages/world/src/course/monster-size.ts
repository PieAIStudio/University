import {
  BOSS_HEIGHT,
  MONSTER_HEIGHT,
  MONSTER_ROLE_HEIGHT,
  type CourseMonster,
} from "./chests-and-monsters.js";

/** One height for the drawn creature, crown chip and star target. Preserve the
 * existing per-species proportions and the weekly boss's 20% size increase;
 * its small landing footprint is not a scale limit for a flying body. */
export function monsterWorldHeight(monster: CourseMonster): number {
  return (
    (monster.boss ? BOSS_HEIGHT : MONSTER_HEIGHT) *
    MONSTER_ROLE_HEIGHT[monster.role] *
    (monster.size ?? 1)
  );
}
