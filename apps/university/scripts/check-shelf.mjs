#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const contentRoot = resolve(import.meta.dirname, "../content");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Check the generated shelf against the tracked import manifest.
 *
 * The manifest is the source of truth for which course packages were imported;
 * the shelf is the delivery-time projection. Counts and ids must agree before
 * a build can claim that it is serving the whole catalogue.
 */
export function checkShelfData(manifest, shelf) {
  const errors = [];
  const manifestStudies = Array.isArray(manifest?.studies) ? manifest.studies : [];
  const shelfStudies = Array.isArray(shelf?.studies) ? shelf.studies : [];
  const manifestCourses = manifestStudies.flatMap((study) => study.courses ?? []);
  const shelfCourses = shelfStudies.flatMap((study) => study.courses ?? []);
  const manifestLessons = manifestCourses.reduce((sum, course) => sum + (course.lessons ?? 0), 0);
  const shelfLessons = shelfCourses.reduce(
    (sum, course) =>
      sum +
      (course.units ?? []).reduce((unitSum, unit) => unitSum + (unit.lessons ?? []).length, 0),
    0,
  );

  if (manifestStudies.length !== shelfStudies.length) {
    errors.push(`study count ${shelfStudies.length} != manifest ${manifestStudies.length}`);
  }
  if (manifestCourses.length !== shelfCourses.length) {
    errors.push(`course count ${shelfCourses.length} != manifest ${manifestCourses.length}`);
  }
  if (manifestLessons !== shelfLessons) {
    errors.push(`lesson count ${shelfLessons} != manifest ${manifestLessons}`);
  }

  for (const manifestStudy of manifestStudies) {
    const shelfStudy = shelfStudies.find((candidate) => candidate.id === manifestStudy.studyId);
    if (!shelfStudy) {
      errors.push(`missing study ${manifestStudy.studyId}`);
      continue;
    }
    const expectedCourses = manifestStudy.courses ?? [];
    const actualCourses = shelfStudy.courses ?? [];
    for (const manifestCourse of expectedCourses) {
      const shelfCourse = actualCourses.find(
        (candidate) => candidate.id === manifestCourse.courseId,
      );
      if (!shelfCourse) {
        errors.push(`missing course ${manifestStudy.studyId}/${manifestCourse.courseId}`);
        continue;
      }
      if (shelfCourse.isBeingRewritten !== manifestCourse.isBeingRewritten) {
        errors.push(
          `rewrite fact ${manifestStudy.studyId}/${manifestCourse.courseId}: ` +
            `${String(shelfCourse.isBeingRewritten)} != manifest ${String(manifestCourse.isBeingRewritten)}`,
        );
      }
      const actualLessons = (shelfCourse.units ?? []).reduce(
        (sum, unit) => sum + (unit.lessons ?? []).length,
        0,
      );
      if (actualLessons !== manifestCourse.lessons) {
        errors.push(
          `lesson count ${manifestStudy.studyId}/${manifestCourse.courseId}: ` +
            `${actualLessons} != manifest ${manifestCourse.lessons}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`shelf is stale:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  }

  return {
    studies: shelfStudies.length,
    courses: shelfCourses.length,
    lessons: shelfLessons,
  };
}

export function checkShelfFiles({ manifestPath, shelfPath } = {}) {
  const resolvedManifest = manifestPath ?? resolve(contentRoot, "manifest.json");
  const resolvedShelf = shelfPath ?? resolve(contentRoot, "shelf.json");
  if (!existsSync(resolvedManifest)) throw new Error(`missing ${resolvedManifest}`);
  if (!existsSync(resolvedShelf)) throw new Error(`missing ${resolvedShelf}`);
  return checkShelfData(readJson(resolvedManifest), readJson(resolvedShelf));
}

if (resolve(process.argv[1] ?? "") === resolve(import.meta.filename)) {
  try {
    const result = checkShelfFiles();
    console.log(
      `check-shelf: ${result.studies} studies, ${result.courses} courses, ${result.lessons} lessons match the manifest.`,
    );
  } catch (error) {
    console.error(`check-shelf: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
