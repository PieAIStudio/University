import type { LeagueTier } from "@pieai/university-core";

import { interfaceTranslator } from "../i18n/index.js";

const TIER_NAMES = {
  stone: "leagueTier.stone",
  bronze: "leagueTier.bronze",
  silver: "leagueTier.silver",
  gold: "leagueTier.gold",
  obsidian: "leagueTier.obsidian",
} as const;

/**
 * A rank's name in the interface language. Core names the tiers once, in the
 * Chinese they were designed in, because it decides who is where and never
 * shows anything; the words belong to the catalogs like every other label.
 */
export function leagueTierName(tier: LeagueTier): string {
  const key = TIER_NAMES[tier.id as keyof typeof TIER_NAMES];
  return key ? interfaceTranslator.t(key) : tier.name;
}
