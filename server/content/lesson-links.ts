import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { findProtectedRegions } from "../language/resolve-anchors.js";
import { getStudyPaths } from "../studies/paths.js";

/**
 * Wiki links between lessons, so a course can be linear and associative at once.
 *
 * Courses are a sequence because someone has to decide what comes first.
 * Understanding is not — a lesson that says "the browser reads this" wants to
 * point at the lesson about how a browser reads, and the reader wants to come
 * back afterwards without losing their place.
 *
 * The rule that makes this safe to author: a link that does not resolve is
 * reported, never silently rendered as text. A dead end a learner discovers is
 * worse than a build that complains.
 */

export interface ParsedLessonLink {
  /** Character range of the whole `[[...]]` token. */
  readonly start: number;
  readonly end: number;
  /** Everything between `lesson:` and `|`, untrimmed of meaning. */
  readonly rawTarget: string;
  readonly label: string | null;
}

export interface LessonLinkTarget {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly title: string;
}

export type LinkResolution =
  | {
      readonly kind: "resolved";
      readonly link: ParsedLessonLink;
      readonly target: LessonLinkTarget;
    }
  | {
      readonly kind: "broken";
      readonly link: ParsedLessonLink;
      readonly reason: "not-found" | "ambiguous" | "malformed" | "self";
    };

/** `[[kind:target]]` or `[[kind:target|label]]`. */
const LINK_PATTERN = /\[\[([^\]\n|]*)(?:\|([^\]\n]*))?\]\]/g;

/**
 * Finds link tokens in prose.
 *
 * Code is skipped using the same region finder the language layer uses, so
 * `[[x]]` inside a fence stays literal text — a lesson that *shows* this syntax
 * while teaching it must not have its example turned into a link.
 */
export function parseLessonLinks(content: string): readonly ParsedLessonLink[] {
  const protectedRegions = findProtectedRegions(content);
  const links: ParsedLessonLink[] = [];
  for (const match of content.matchAll(LINK_PATTERN)) {
    if (match.index === undefined) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (protectedRegions.some((region) => start < region.end && region.start < end)) continue;
    links.push({
      start,
      end,
      rawTarget: (match[1] ?? "").trim(),
      label: match[2] === undefined ? null : match[2].trim(),
    });
  }
  return links;
}

export interface LessonIndexEntry extends LessonLinkTarget {
  /** Lessons this one links to, resolved. Populated by `buildLessonIndex`. */
  readonly outgoing: readonly LessonLinkTarget[];
}

export interface LessonIndex {
  /** `courseId/unitId/lessonId` → entry. */
  readonly byPath: ReadonlyMap<string, LessonIndexEntry>;
  /** `courseId` → `lessonId` → entries, for resolving a bare id within a course. */
  readonly byCourseAndLesson: ReadonlyMap<string, ReadonlyMap<string, readonly LessonIndexEntry[]>>;
}

function pathKey(route: {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}): string {
  return `${route.courseId}/${route.unitId}/${route.lessonId}`;
}

/**
 * Resolves link tokens against an index.
 *
 * Takes the index rather than reading disk, so the policy is testable and the
 * caller decides how long an index lives. Never throws: a broken link is data
 * the caller reports, not an exception that takes a lesson down with it.
 */
export function resolveLessonLinks(
  links: readonly ParsedLessonLink[],
  index: LessonIndex,
  from: { readonly courseId: string; readonly unitId: string; readonly lessonId: string },
): readonly LinkResolution[] {
  return links.map((link): LinkResolution => {
    const [kind, ...rest] = link.rawTarget.split(":");
    const target = rest.join(":").trim();
    if (kind !== "lesson" || target === "") return { kind: "broken", link, reason: "malformed" };

    const segments = target.split("/");
    if (segments.length === 2 || segments.length > 3) {
      return { kind: "broken", link, reason: "malformed" };
    }

    let found: LessonIndexEntry | undefined;
    if (segments.length === 3) {
      found = index.byPath.get(target);
      if (!found) return { kind: "broken", link, reason: "not-found" };
    } else {
      // A bare id means "in this course". Lesson ids are unique per unit, not
      // per course, so two units can legitimately both define one — and then
      // guessing would silently send the reader to the wrong lesson.
      const candidates = index.byCourseAndLesson.get(from.courseId)?.get(target) ?? [];
      if (candidates.length === 0) return { kind: "broken", link, reason: "not-found" };
      if (candidates.length > 1) return { kind: "broken", link, reason: "ambiguous" };
      found = candidates[0]!;
    }

    if (pathKey(found) === pathKey(from)) return { kind: "broken", link, reason: "self" };
    return {
      kind: "resolved",
      link,
      target: {
        courseId: found.courseId,
        unitId: found.unitId,
        lessonId: found.lessonId,
        title: found.title,
      },
    };
  });
}

/** Which lessons link *to* this one. The reason associative linking is worth it. */
export function backlinksOf(
  index: LessonIndex,
  target: { readonly courseId: string; readonly unitId: string; readonly lessonId: string },
): readonly LessonLinkTarget[] {
  const key = pathKey(target);
  const found: LessonLinkTarget[] = [];
  for (const entry of index.byPath.values()) {
    if (entry.outgoing.some((link) => pathKey(link) === key)) {
      found.push({
        courseId: entry.courseId,
        unitId: entry.unitId,
        lessonId: entry.lessonId,
        title: entry.title,
      });
    }
  }
  return found;
}

interface RawLesson extends LessonLinkTarget {
  readonly content: string;
}

/** The only function here that touches disk. */
export function buildLessonIndex(studiesRoot: string, studyId: string): LessonIndex {
  const raw = readLessons(studiesRoot, studyId);

  // Two passes: the first needs every title before any link can name a target,
  // the second resolves. One pass would make a link's validity depend on
  // directory order.
  const skeleton = new Map<string, LessonIndexEntry>();
  const byCourseAndLesson = new Map<string, Map<string, LessonIndexEntry[]>>();
  for (const lesson of raw) {
    const entry: LessonIndexEntry = { ...lesson, outgoing: [] };
    skeleton.set(pathKey(lesson), entry);
    const course = byCourseAndLesson.get(lesson.courseId) ?? new Map<string, LessonIndexEntry[]>();
    course.set(lesson.lessonId, [...(course.get(lesson.lessonId) ?? []), entry]);
    byCourseAndLesson.set(lesson.courseId, course);
  }
  const staged: LessonIndex = { byPath: skeleton, byCourseAndLesson };

  const byPath = new Map<string, LessonIndexEntry>();
  for (const lesson of raw) {
    const resolutions = resolveLessonLinks(parseLessonLinks(lesson.content), staged, lesson);
    byPath.set(pathKey(lesson), {
      courseId: lesson.courseId,
      unitId: lesson.unitId,
      lessonId: lesson.lessonId,
      title: lesson.title,
      outgoing: resolutions.flatMap((item) => (item.kind === "resolved" ? [item.target] : [])),
    });
  }
  return { byPath, byCourseAndLesson };
}

function readLessons(studiesRoot: string, studyId: string): readonly RawLesson[] {
  const coursesRoot = join(getStudyPaths(studiesRoot, studyId).root, "courses");
  if (!existsSync(coursesRoot)) return [];
  const lessons: RawLesson[] = [];
  for (const courseId of readdirSync(coursesRoot)) {
    const unitsRoot = join(coursesRoot, courseId, "units");
    if (!existsSync(unitsRoot)) continue;
    for (const unitId of readdirSync(unitsRoot)) {
      const lessonsRoot = join(unitsRoot, unitId, "lessons");
      if (!existsSync(lessonsRoot)) continue;
      for (const lessonId of readdirSync(lessonsRoot)) {
        const found = readLatestRevision(join(lessonsRoot, lessonId));
        if (found) lessons.push({ courseId, unitId, lessonId, ...found });
      }
    }
  }
  return lessons;
}

function readLatestRevision(
  lessonRoot: string,
): { readonly title: string; readonly content: string } | null {
  const revisionsRoot = join(lessonRoot, "revisions");
  if (!existsSync(revisionsRoot)) return null;
  const latest = readdirSync(revisionsRoot)
    .map(Number)
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => right - left)[0];
  if (latest === undefined) return null;
  const manifestPath = join(revisionsRoot, String(latest), "manifest.json");
  const contentPath = join(revisionsRoot, String(latest), "content.md");
  if (!existsSync(manifestPath) || !existsSync(contentPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { title?: unknown };
  return {
    title: typeof manifest.title === "string" ? manifest.title : "",
    content: readFileSync(contentPath, "utf8"),
  };
}
