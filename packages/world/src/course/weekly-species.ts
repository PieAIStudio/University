import { weeklyBossWeekOrdinal } from "@pieai/university-core";
import type { MonsterRole } from "./chests-and-monsters.js";

/** Versioned cadence over shipped, attributed kit assets. The first delivered
 * week stays the original golem; reload, account and time zone cannot reroll it. */
// These four loaded models each bake to one part and have a skeleton. The
// chicken's 55 independent meshes are not promoted to an always-live boss.
export const WEEKLY_BOSS_ROSTER = [
  "boss",
  "frog",
  "crab",
  "yeti",
] as const satisfies readonly MonsterRole[];
const FIRST_WEEK = weeklyBossWeekOrdinal("2026-09-28")!;
export function weeklyBossSpecies(week: string): MonsterRole {
  const ordinal = weeklyBossWeekOrdinal(week);
  if (ordinal === null) return "boss";
  const count = WEEKLY_BOSS_ROSTER.length;
  return WEEKLY_BOSS_ROSTER[(((ordinal - FIRST_WEEK) % count) + count) % count]!;
}
