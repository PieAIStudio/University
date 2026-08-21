import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { LessonSection } from "@pieai/university-core/domain/schemas.js";
import { assembleLessonIndex } from "@pieai/university-core/marks/references.js";
import { getStudyPaths } from "../studies/paths.js";

export type { LessonLinkTarget } from "@pieai/university-core/domain/lesson-marks.js";
export {
  parseLessonLinks,
  tokenKind,
  resolveLessonLinks,
  backlinksOf,
  assembleLessonIndex,
  type ParsedLessonLink,
  type LinkResolution,
  type LessonIndex,
  type LessonIndexEntry,
  type LessonIndexSource,
} from "@pieai/university-core/marks/references.js";

interface RawLesson {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly title: string;
  readonly content: string;
  readonly sections: readonly LessonSection[];
}

/** The only function here that touches disk. */
export function buildLessonIndex(studiesRoot: string, studyId: string) {
  return assembleLessonIndex(readLessons(studiesRoot, studyId));
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

function readLatestRevision(lessonRoot: string): {
  readonly title: string;
  readonly content: string;
  readonly sections: readonly LessonSection[];
} | null {
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
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    title?: unknown;
    sections?: readonly LessonSection[];
  };
  return {
    title: typeof manifest.title === "string" ? manifest.title : "",
    content: readFileSync(contentPath, "utf8"),
    sections: manifest.sections ?? [],
  };
}
