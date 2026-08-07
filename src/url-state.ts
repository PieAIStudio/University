/**
 * The address bar as a first-class record of where you are.
 *
 * Every view was previously React state alone, which meant a refresh dropped
 * you back on Today, the browser's back button did nothing, and there was no
 * way to point at a lesson — not to a friend, not to a note, not to your own
 * future self. For a campus whose whole job is "come back tomorrow and
 * continue", losing your place on reload is not a small defect.
 *
 * Deliberately not a router library. Adopting one means restructuring a
 * 2900-line component into route components, and that restructuring is queued
 * as its own behaviour-preserving refactor. Bolting a router onto the component
 * in its current shape would do the risky half of that work with none of the
 * benefit. This layer is ~80 lines, fully testable, and makes the URL correct
 * now; when the component is split, a real router can take over these same
 * parse/format rules.
 */

export type SectionId = "today" | "studies";

export interface LessonAddress {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

export interface AppAddress {
  readonly section: SectionId;
  readonly studyId: string | null;
  readonly lesson: LessonAddress | null;
}

export const HOME: AppAddress = { section: "today", studyId: null, lesson: null };

/**
 * A path segment that could not have come from `formatAddress`.
 *
 * Ids are authored as directory names, so anything with a slash, a dot-dot, or
 * an encoded separator is either a typo or someone probing. Rejecting them here
 * keeps a malformed URL from becoming a filesystem question further down.
 */
function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");
}

export function parseAddress(pathname: string): AppAddress {
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

  if (segments.length === 0 || segments[0] === "today") return HOME;
  if (segments[0] !== "studies") return HOME;

  const [, studyId, courseId, unitId, lessonId] = segments;
  if (studyId === undefined) return { section: "studies", studyId: null, lesson: null };
  if (!isSafeId(studyId)) return HOME;

  if (courseId === undefined || unitId === undefined || lessonId === undefined) {
    return { section: "studies", studyId, lesson: null };
  }
  if (![courseId, unitId, lessonId].every(isSafeId)) {
    return { section: "studies", studyId, lesson: null };
  }
  return {
    section: "studies",
    studyId,
    lesson: { studyId, courseId, unitId, lessonId },
  };
}

export function formatAddress(address: AppAddress): string {
  if (address.section === "today") return "/";
  if (!address.studyId) return "/studies";
  const base = `/studies/${encodeURIComponent(address.studyId)}`;
  const lesson = address.lesson;
  if (!lesson) return base;
  return `${base}/${encodeURIComponent(lesson.courseId)}/${encodeURIComponent(lesson.unitId)}/${encodeURIComponent(lesson.lessonId)}`;
}

/** Two addresses that would produce the same URL. */
export function sameAddress(left: AppAddress, right: AppAddress): boolean {
  return formatAddress(left) === formatAddress(right);
}
