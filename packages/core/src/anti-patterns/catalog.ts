import {
  ANTI_PATTERN_CATEGORY_IDS,
  type AntiPatternCategory,
  type AntiPatternEntry,
} from "../domain/anti-pattern.js";
import { INTERACTION_ANTI_PATTERNS } from "./interaction.js";
import { TEMPLATE_ANTI_PATTERNS } from "./template.js";
import { VERBAL_ANTI_PATTERNS } from "./verbal.js";

/**
 * The F-group catalogue in chip order: verbal, template, interaction.
 *
 * Twenty-five is a count someone can check against the teardown, not a number
 * we are free to round. Adding a twenty-sixth is a new teaching claim.
 */
export const ANTI_PATTERN_ENTRIES: readonly AntiPatternEntry[] = [
  ...VERBAL_ANTI_PATTERNS,
  ...TEMPLATE_ANTI_PATTERNS,
  ...INTERACTION_ANTI_PATTERNS,
];

const BY_ID = new Map(ANTI_PATTERN_ENTRIES.map((entry) => [entry.head.id, entry] as const));

export const ANTI_PATTERN_COUNTS: { readonly [C in AntiPatternCategory]: number } = {
  verbal: VERBAL_ANTI_PATTERNS.length,
  template: TEMPLATE_ANTI_PATTERNS.length,
  interaction: INTERACTION_ANTI_PATTERNS.length,
};

export function getAntiPatternEntry(id: string): AntiPatternEntry | undefined {
  return BY_ID.get(id);
}

export function antiPatternsInCategory(category: AntiPatternCategory): readonly AntiPatternEntry[] {
  return ANTI_PATTERN_ENTRIES.filter((entry) => entry.head.category === category);
}

/** Category order the index chips walk. Keep in lockstep with `ANTI_PATTERN_CATEGORY_IDS`. */
export const ANTI_PATTERN_CHIP_ORDER: readonly AntiPatternCategory[] = ANTI_PATTERN_CATEGORY_IDS;
