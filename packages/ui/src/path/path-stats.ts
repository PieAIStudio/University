import { parseLessonLinks, tokenKind } from "@pieai/university-core/marks/references.js";

/**
 * The shapes the path cards read. A subset of a delivered lesson/unit: title,
 * prose, exercises, objective. The delivery shell's `Course` type is larger
 * and structurally compatible; the authoring shell can pass the same fields
 * if it ever opens these cards.
 */
export interface PathLesson {
  readonly title: string;
  readonly content: string;
  readonly exercises: readonly unknown[];
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

export function readingMinutes(content: string): number {
  return Math.max(1, Math.round(content.length / READING_CHARS_PER_MINUTE));
}

/** Count of a wiki-token prefix in prose, as written. Fences are not skipped. */
export function tokenPrefixCount(content: string, prefix: string): number {
  if (prefix.length === 0) return 0;
  return content.split(prefix).length - 1;
}

export function evidenceCount(content: string): number {
  return tokenPrefixCount(content, "[[evidence:");
}

export function unlockEntryCount(content: string): number {
  return tokenPrefixCount(content, "[[term:") + tokenPrefixCount(content, "[[concept:");
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
 * printed — "解锁 0 个" would be the product admitting the catalogue is empty.
 */
export function startButtonLabel(unlockCount: number): string {
  return unlockCount > 0 ? `开始 · 学完解锁 ${unlockCount} 个词条` : "开始";
}

export function lessonCostLine(lesson: PathLesson): string {
  return `读 ${readingMinutes(lesson.content)} 分钟 · ${lesson.exercises.length} 道题 · ${evidenceCount(lesson.content)} 条真实代码引用`;
}

/**
 * Coordinates only: `path:start-end`. The cited source is a private
 * repository and must not appear in a card a paying learner can screenshot.
 */
export function evidenceLocatorOf(rawTarget: string): string | null {
  if (!rawTarget.startsWith("evidence:")) return null;
  const rest = rawTarget.slice("evidence:".length).trim();
  return rest.length > 0 ? rest : null;
}

export function unitEvidenceLocators(lessons: readonly PathLesson[]): readonly string[] {
  const seen = new Set<string>();
  const locators: string[] = [];
  for (const lesson of lessons) {
    for (const link of parseLessonLinks(lesson.content)) {
      if (tokenKind(link) !== "evidence") continue;
      const locator = evidenceLocatorOf(link.rawTarget);
      if (!locator || seen.has(locator)) continue;
      seen.add(locator);
      locators.push(locator);
      if (locators.length === 5) return locators;
    }
  }
  return locators;
}

export function unitMinutes(lessons: readonly PathLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + readingMinutes(lesson.content), 0);
}

export function unitMetaLine(lessons: readonly PathLesson[]): string {
  return `${lessons.length} 节 · 约 ${unitMinutes(lessons)} 分钟`;
}
