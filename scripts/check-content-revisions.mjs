#!/usr/bin/env node
/**
 * Keep every delivery lesson on the revision its recovery package names.
 *
 * The recovery package is the authoring boundary and the course JSON plus
 * shelf are the delivery inputs. Both delivery representations must preserve
 * the same lesson revision, because the reader opens the course package while
 * Today and the map answer from the shelf.
 *
 * Usage: node scripts/check-content-revisions.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RECOVERY_ROOT = join(ROOT, "apps", "local", "course-proposals", "recovery");
const DELIVERY_ROOT = join(ROOT, "apps", "university", "content");

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${label} at ${path}: ${detail}`);
  }
}

function directoriesIn(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function courseKey(studyId, courseId) {
  return `${studyId}/${courseId}`;
}

function revisionsOf(course, key, errors) {
  const revisions = new Map();
  if (!course || !Array.isArray(course.units)) {
    errors.push(`${key}: course has no units`);
    return revisions;
  }

  for (const unit of course.units) {
    if (!unit || typeof unit.id !== "string" || !Array.isArray(unit.lessons)) {
      errors.push(`${key}: unit has no lesson list`);
      continue;
    }
    for (const lesson of unit.lessons) {
      const lessonKey = `${unit.id}/${lesson?.id}`;
      const label = `${key}/${lessonKey}`;
      if (revisions.has(lessonKey)) {
        errors.push(`${label}: lesson appears more than once`);
        continue;
      }
      if (!Number.isInteger(lesson?.contentRevision) || lesson.contentRevision < 1) {
        errors.push(`${label}: missing or invalid contentRevision`);
        continue;
      }
      revisions.set(lessonKey, lesson.contentRevision);
    }
  }
  return revisions;
}

function entriesByKey(entries, label, errors) {
  const indexed = new Map();
  for (const entry of entries) {
    if (indexed.has(entry.key)) errors.push(`${label}: duplicate course ${entry.key}`);
    indexed.set(entry.key, entry);
  }
  return indexed;
}

function compareRevisionMaps(expected, actual, artifactLabel, key, errors) {
  for (const [lessonKey, revision] of expected) {
    if (!actual.has(lessonKey)) {
      errors.push(`${artifactLabel}: missing lesson ${key}/${lessonKey}`);
      continue;
    }
    const received = actual.get(lessonKey);
    if (received !== revision) {
      errors.push(
        `${artifactLabel}: ${key}/${lessonKey} revision ${received} != source ${revision}`,
      );
    }
  }
  for (const lessonKey of actual.keys()) {
    if (!expected.has(lessonKey)) {
      errors.push(`${artifactLabel}: unexpected lesson ${key}/${lessonKey}`);
    }
  }
}

export function contentRevisionErrors({ sourceCourses, deliveryCourses, shelfCourses }) {
  const errors = [];
  const sourceByKey = entriesByKey(sourceCourses, "recovery source", errors);
  const deliveryByKey = entriesByKey(deliveryCourses, "delivery package", errors);
  const shelfByKey = entriesByKey(shelfCourses, "delivery shelf", errors);

  for (const [key, source] of sourceByKey) {
    const expected = revisionsOf(source.course, key, errors);
    const delivery = deliveryByKey.get(key);
    if (!delivery) {
      errors.push(`delivery package: missing course ${key}`);
    } else {
      compareRevisionMaps(
        expected,
        revisionsOf(delivery.course, key, errors),
        "delivery package",
        key,
        errors,
      );
    }

    const shelf = shelfByKey.get(key);
    if (!shelf) {
      errors.push(`delivery shelf: missing course ${key}`);
    } else {
      compareRevisionMaps(
        expected,
        revisionsOf(shelf.course, key, errors),
        "delivery shelf",
        key,
        errors,
      );
    }
  }

  for (const key of deliveryByKey.keys()) {
    if (!sourceByKey.has(key)) errors.push(`delivery package: unexpected course ${key}`);
  }
  for (const key of shelfByKey.keys()) {
    if (!sourceByKey.has(key)) errors.push(`delivery shelf: unexpected course ${key}`);
  }
  return errors;
}

function loadProductionEntries() {
  if (!existsSync(RECOVERY_ROOT)) {
    throw new Error(`recovery root is missing: ${RECOVERY_ROOT}`);
  }
  if (!existsSync(DELIVERY_ROOT)) {
    throw new Error(`delivery content is missing — run pnpm content first: ${DELIVERY_ROOT}`);
  }

  const shelf = readJson(join(DELIVERY_ROOT, "shelf.json"), "delivery shelf");
  const sourceCourses = [];
  const deliveryCourses = [];
  const shelfCourses = [];

  for (const studyId of directoriesIn(RECOVERY_ROOT)) {
    const studyRoot = join(RECOVERY_ROOT, studyId);
    const index = readJson(join(studyRoot, "index.json"), `${studyId} recovery index`);
    if (!Array.isArray(index.courses)) {
      throw new Error(`${studyId} recovery index has no course list`);
    }
    const shelfStudy = (Array.isArray(shelf.studies) ? shelf.studies : []).find(
      (study) => study.id === studyId,
    );

    for (const entry of index.courses) {
      const key = courseKey(studyId, entry.courseId);
      const sourcePackage = readJson(join(studyRoot, entry.file), `${key} recovery package`);
      sourceCourses.push({ key, course: sourcePackage.course });

      const deliveryPath = join(DELIVERY_ROOT, studyId, `${entry.courseId}.json`);
      if (existsSync(deliveryPath)) {
        const deliveryPackage = readJson(deliveryPath, `${key} delivery package`);
        deliveryCourses.push({ key, course: deliveryPackage.course });
      }

      const shelfCourse = shelfStudy?.courses?.find((course) => course.id === entry.courseId);
      if (shelfCourse) shelfCourses.push({ key, course: shelfCourse });
    }
  }

  return { sourceCourses, deliveryCourses, shelfCourses };
}

export function checkProductionContentRevisions() {
  const entries = loadProductionEntries();
  const errors = contentRevisionErrors(entries);
  const lessons = entries.sourceCourses.reduce(
    (total, entry) =>
      total +
      (Array.isArray(entry.course?.units)
        ? entry.course.units.reduce(
            (unitTotal, unit) =>
              unitTotal + (Array.isArray(unit.lessons) ? unit.lessons.length : 0),
            0,
          )
        : 0),
    0,
  );
  return { ...entries, errors, lessons };
}

function runSelfTests() {
  const base = {
    sourceCourses: [
      {
        key: "study/course",
        course: {
          id: "course",
          units: [{ id: "unit", lessons: [{ id: "lesson", contentRevision: 3 }] }],
        },
      },
    ],
    deliveryCourses: [
      {
        key: "study/course",
        course: {
          id: "course",
          units: [{ id: "unit", lessons: [{ id: "lesson", contentRevision: 3 }] }],
        },
      },
    ],
    shelfCourses: [
      {
        key: "study/course",
        course: {
          id: "course",
          units: [{ id: "unit", lessons: [{ id: "lesson", contentRevision: 3 }] }],
        },
      },
    ],
  };

  assert.deepEqual(contentRevisionErrors(base), []);
  console.log("check-content-revisions self-test:");
  console.log("  matching source, package, and shelf: green");

  const broken = structuredClone(base);
  broken.deliveryCourses[0].course.units[0].lessons[0].contentRevision = 1;
  const red = contentRevisionErrors(broken);
  assert.notEqual(red.length, 0, "injected revision mismatch should fail");
  console.log("  injected delivery revision mismatch: red");
  console.log(`    ${red[0]}`);

  assert.deepEqual(contentRevisionErrors(base), []);
  console.log("  restored source revision: green");
}

if (process.argv.includes("--self-test")) {
  runSelfTests();
} else {
  try {
    const result = checkProductionContentRevisions();
    if (result.errors.length > 0) {
      console.error("check-content-revisions: failed");
      for (const error of result.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `check-content-revisions: ok (${result.lessons} lessons, ` +
          `${result.sourceCourses.length} courses)`,
      );
    }
  } catch (error) {
    console.error(
      `check-content-revisions: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
