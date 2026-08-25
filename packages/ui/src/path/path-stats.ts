import { parseLessonLinks, tokenKind } from "@pieai/university-core/marks/references.js";

export {
  evidenceCount,
  evidenceLocatorOf,
  evidenceLocatorsIn,
  tokenPrefixCount,
  unlockEntryCount,
} from "@pieai/university-core/marks/path-stats.js";

/**
 * The shapes the path cards read: counts, not prose.
 *
 * They used to take the lesson body and measure it. That worked while only the
 * campus with the whole package in memory opened these cards; the other one
 * synthesised a string of the right length to get the reading time, which also
 * produced 「0 条真实代码引用」 — a number that is wrong rather than absent, on
 * the card a learner reads before deciding to spend twenty minutes.
 *
 * So the counts are what crosses the boundary, and the two that a shelf may not
 * know are nullable. A build whose content source cannot count citations says
 * nothing about them; it does not say zero.
 */
export interface PathLesson {
  readonly title: string;
  /** Prose length in characters. Sets the reading time, and nothing else. */
  readonly contentChars: number;
  readonly exerciseCount: number;
  /** Pinned-source citations in the prose, or null where the shelf cannot say. */
  readonly evidenceCount: number | null;
  /** Entries this lesson unlocks, or null where the shelf cannot say. */
  readonly unlockCount: number | null;
  /** `path:start-end` coordinates for the unit card, where the shelf has them. */
  readonly evidenceLocators?: readonly string[];
}

export interface PathUnit {
  readonly title: string;
  readonly objective: string;
  readonly lessons: readonly PathLesson[];
}

/** Chinese prose on this product sits around this pace. Never below 1. */
export const READING_CHARS_PER_MINUTE = 400;

export const UNIT_ABILITY_LABEL = "学完这一单元，你能——";
export const PREVIEW_UNIT_LABEL = "先看这一单元讲什么";
export const START_UNIT_LABEL = "从第 1 节开始";
export const UNIT_EVIDENCE_HEADING = "这一单元会带你读的真实代码";

export function readingMinutes(contentChars: number): number {
  return Math.max(1, Math.round(contentChars / READING_CHARS_PER_MINUTE));
}

/**
 * Concept ids this lesson actually names, in order, unique.
 *
 * Settlement shows a card only for an id that also exists in the catalogue.
 * Resolving that second half is the caller's job: a missing catalogue entry
 * is not a reward, and this function does not invent one.
 */
export function unlockedConceptIds(content: string): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const link of parseLessonLinks(content)) {
    if (tokenKind(link) !== "concept") continue;
    const id = link.rawTarget.slice("concept:".length).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * The start button prints the reward. Zero is not a reward, so it is not
 * printed — "解锁 0 个" would be the product admitting the catalogue is empty —
 * and neither is a count the shelf could not take.
 */
export function startButtonLabel(unlockCount: number | null): string {
  return unlockCount !== null && unlockCount > 0 ? `开始 · 学完解锁 ${unlockCount} 个词条` : "开始";
}

/**
 * What this lesson costs, and only what is known.
 *
 * The citation clause is dropped rather than printed as zero where the shelf
 * cannot count them — a wrong number on the card that sells the lesson is worse
 * than a shorter card.
 */
export function lessonCostLine(lesson: PathLesson): string {
  const parts = [`读 ${readingMinutes(lesson.contentChars)} 分钟`, `${lesson.exerciseCount} 道题`];
  if (lesson.evidenceCount !== null) parts.push(`${lesson.evidenceCount} 条真实代码引用`);
  return parts.join(" · ");
}

/** Unique coordinates across the lessons in one unit, capped for the card. */
export function unitEvidenceLocators(lessons: readonly PathLesson[]): readonly string[] {
  const seen = new Set<string>();
  const locators: string[] = [];
  for (const lesson of lessons) {
    for (const locator of lesson.evidenceLocators ?? []) {
      if (seen.has(locator)) continue;
      seen.add(locator);
      locators.push(locator);
      if (locators.length === 5) return locators;
    }
  }
  return locators;
}

export function unitMinutes(lessons: readonly PathLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + readingMinutes(lesson.contentChars), 0);
}

export function unitMetaLine(lessons: readonly PathLesson[]): string {
  return `${lessons.length} 节 · 约 ${unitMinutes(lessons)} 分钟`;
}
