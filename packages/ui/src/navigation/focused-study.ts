/**
 * Which series the learner is in, decided once for every screen that asks.
 *
 * Four things need this answer and they must agree: the map places one
 * project's islands, the sky takes that project's colour, the capsule at the
 * top names it, and the back button says which map it goes back to. When they
 * disagree the product is lying about where you are — and it did. The capsule
 * read 「选一个项目」 on every screen but the map in the authoring shell, while
 * the map behind it was showing Buzz, because the shell handed the control its
 * raw `selectedStudyId` state and resolved the fallback separately, deeper in,
 * where only the map could see it.
 *
 * So the rule is not "remember to resolve before passing". The resolution is
 * one function, both shells call it, and `StudySwitcher` takes a plain `string`
 * so handing it unresolved state does not compile.
 *
 * `chosen` is checked against the catalogue rather than trusted. A path someone
 * bookmarked outlives the study it names, and an id that no longer resolves
 * should land you somewhere real rather than on a screen that cannot say where
 * it is.
 */
export function focusedStudyId(
  studyIds: readonly string[],
  chosen: string | null | undefined,
  /** Today's lesson's series — the best guess when nobody has chosen. */
  today?: string | null | undefined,
): string | null {
  if (chosen && studyIds.includes(chosen)) return chosen;
  if (today && studyIds.includes(today)) return today;
  return studyIds[0] ?? null;
}
