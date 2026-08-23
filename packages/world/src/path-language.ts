/**
 * The path's information system: what a node *is*, and which course it
 * belongs to.
 *
 * Colour is a course, not a state. Duolingo paints a section magenta or
 * orange so you feel the segment change; we cycle a small hue palette by
 * `spineOrder` so an author fixing a typo cannot reshuffle a learner's
 * world. Kind is derived from the lesson's own facts (unit slot, variant,
 * exercise and card counts), never from Math.random.
 */
import { spineOf } from "@pieai/university-core";

import { hash } from "./island";

/**
 * Hue offsets applied to the grass, in turns.
 *
 * Kept small enough that every island is still land, and far enough apart
 * that neighbouring courses on the spine read as different climates rather
 * than as a grading error.
 */
export const COURSE_HUE_SHIFTS = [0, 0.16, -0.14, 0.28, -0.24, 0.4] as const;

export type PathNodeKind = "lesson" | "practice" | "quiz" | "chest" | "review";

/**
 * The mark on a lesson marker.
 *
 * These were emoji — 📖 ✍️ 🎯 🎁 🔁 — and two of them were red. On a green
 * island under a warm sky, a red-and-white dartboard and a red-ribboned present
 * are the two loudest things on screen, and they were landing on whichever
 * lesson happened to be the end of a unit. The map's one job is to say where to
 * go next, and the accent that says it was losing to decoration.
 *
 * So: text-presentation glyphs, no colour of their own. They inherit the CSS
 * colour of the label they sit in, which means locked reads grey and live reads
 * warm without a second palette. U+FE0E on the ones a platform might otherwise
 * promote to emoji — ✎, ★ and ↻ all have colour forms on some systems, and
 * without the selector this fix would quietly undo itself on someone's phone.
 */
export const PATH_KIND_ICON: Record<PathNodeKind, string> = {
  lesson: "\u2630", // ☰ lines of text
  practice: "\u270E\uFE0E", // ✎
  quiz: "\u2605\uFE0E", // ★ the unit's milestone
  chest: "\u25C6", // ◆ a term unlocked
  review: "\u21BB\uFE0E", // ↻
};

export const PATH_KIND_LABEL: Record<PathNodeKind, string> = {
  lesson: "课文",
  practice: "练习",
  quiz: "单元测验",
  chest: "词条宝箱",
  review: "复习",
};

/**
 * One course, one hue, stable across content edits.
 *
 * The spine is an explicit pedagogical order keyed to course ids. A course
 * missing from the spine still hashes its id so the island does not jump
 * when the spine is later extended.
 */
export function hueShiftForCourse(studyId: string, courseId: string): number {
  const spine = spineOf(studyId);
  const index = spine.findIndex((entry) => entry.courseId === courseId);
  const slot = index >= 0 ? index : Math.floor(hash(courseId) * COURSE_HUE_SHIFTS.length);
  return COURSE_HUE_SHIFTS[slot % COURSE_HUE_SHIFTS.length]!;
}

/**
 * Which icon sits on this stone.
 *
 * Last lesson of a multi-lesson unit is the unit test — 93 of 146 units are
 * exactly four lessons, so that mark lands on a rhythm of its own. 术语 is
 * the chest (a term unlock). Two or more exercises is practice. A thicker
 * card stack is review. Everything else is a reading.
 */
export function pathNodeKind(input: {
  readonly variant?: string | null;
  readonly exercises: number;
  readonly cards: number;
  readonly slot: number;
  readonly unitLength: number;
}): PathNodeKind {
  if (input.unitLength >= 2 && input.slot === input.unitLength - 1) return "quiz";
  if (input.variant === "术语") return "chest";
  if (input.exercises >= 2) return "practice";
  if (input.cards >= 3) return "review";
  return "lesson";
}

/** Locked look: keep 15% of saturation, drop lightness by 40%. */
export function lockHsl(saturation: number, lightness: number) {
  return { saturation: saturation * 0.15, lightness: lightness * 0.6 };
}
