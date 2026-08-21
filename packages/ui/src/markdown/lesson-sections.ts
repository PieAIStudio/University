/**
 * The pedagogical role of a lesson section, read off its heading.
 *
 * Lessons are not free-form prose. `write-lesson` builds every one of them from
 * a fixed spine — guess, then answer, then explain, then check yourself, then
 * the one line worth keeping — and that spine is what makes the lesson teach
 * rather than merely inform. Across the 1297 lesson revisions on disk the same
 * headings recur thousands of times: `自检` in 1285 of them, `先猜一下` and
 * `答案` in 816 each.
 *
 * All of which the reader could not see. Every one of those headings rendered
 * at the same size, weight and colour, so a section that asks you to commit to
 * an answer looked exactly like a section that hands you one — and a reader who
 * cannot tell them apart just reads straight through, which is the one way to
 * get none of the benefit. Naming the role here is what lets the stylesheet say
 * out loud what the content already knows.
 *
 * Headings outside this vocabulary — variant-specific ones like `逐条对照`, and
 * the couple of dozen one-offs — get no role and keep the plain treatment.
 */
type LessonSectionRole =
  /** The reader is asked to produce something before reading on. A full stop. */
  | "ask"
  /** The resolution of the `ask` directly above it. Reads as its other half. */
  | "reveal"
  /** The compressed thing to carry away. */
  | "takeaway";

const ROLE_BY_HEADING = new Map<string, LessonSectionRole>([
  ["先猜一下", "ask"],
  ["自检", "ask"],
  ["答案", "reveal"],
  ["一句话", "takeaway"],
  ["先给结论", "takeaway"],
  ["重点", "takeaway"],
]);

/** The role for a heading, or undefined when the heading is not part of the spine. */
export function lessonSectionRole(heading: string): LessonSectionRole | undefined {
  return ROLE_BY_HEADING.get(heading.trim());
}
