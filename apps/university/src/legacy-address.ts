/**
 * The address this campus used to carry, translated once into the one it
 * shares with delivery.
 *
 * The authoring shell held two addresses at the same time: a pathname for
 * study + lesson (`/studies/<study>/<course>/<unit>/<lesson>`) and a hash for
 * the rail slot. That is now one hash for both, which is the fix — but a
 * pathname someone bookmarked is a promise this repository made, and the person
 * most likely to have bookmarked one is the person who studies here every day.
 *
 * So this reads the old shape exactly as `parseAddress` did, and hands back the
 * view and the series it named. Nothing else in the app knows the old form
 * exists; `App` rewrites the URL once at start-up and the shape is gone.
 */

import { isSafeId, type View } from "@pieai/university-core";

export interface LegacyAddress {
  /** The series the old path selected, or null when it named none. */
  readonly studyId: string | null;
  /** Where to land, or null to leave whatever the hash already says. */
  readonly view: View | null;
}

/**
 * A legacy pathname, or null when this is not one.
 *
 * `/` and `/today` were the campus home and carry nothing, so they read as
 * "not a legacy address" rather than as an instruction to go home — the hash
 * beside them may well be a real destination.
 */
export function legacyAddressOf(pathname: string): LegacyAddress | null {
  const segments = pathname
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "";
      }
    })
    .filter((part) => part !== "");

  if (segments[0] !== "studies") return null;

  const [, studyId, courseId, unitId, lessonId] = segments;
  // `/studies` on its own was the shelf with nothing chosen.
  if (studyId === undefined) return { studyId: null, view: null };
  // Ids were directory names on the far side of `/api/studies/…`. A segment
  // with `..` or a separator in it is a typo or a probe; it never named a
  // study, so it does not get to name one now either.
  if (!isSafeId(studyId)) return { studyId: null, view: null };

  if (
    courseId === undefined ||
    unitId === undefined ||
    lessonId === undefined ||
    ![courseId, unitId, lessonId].every(isSafeId)
  ) {
    // Half a lesson address is a truncated paste. The series it named is still
    // good information; the map is a recoverable place to read it on.
    return { studyId, view: null };
  }

  return {
    studyId,
    view: { kind: "lesson", studyId, courseId, unitId, lessonId },
  };
}
