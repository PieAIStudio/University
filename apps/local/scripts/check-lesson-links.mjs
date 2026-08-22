#!/usr/bin/env node
/**
 * Check whether `[[lesson:...]]` tokens in course content resolve to valid lessons.
 *
 * Courses are written with wiki-style lesson links:
 * - Bare ID: `[[lesson:intro]]` resolves within the same course.
 * - Full path: `[[lesson:courseId/unitId/lessonId]]` resolves across the catalog.
 * - Section target: `[[lesson:target#sectionId]]` checks that the section exists.
 *
 * This script scans apps/online/content/<study>/<course>.json, parses all lesson
 * links, and reports any dangling / broken references.
 *
 * Note: Only reports issues without modifying files.
 *
 * Usage:
 *   node apps/local/scripts/check-lesson-links.mjs [study]
 *   node scripts/check-lesson-links.mjs [study]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const [studyArg] = process.argv.slice(2);

// Find repo root from import.meta.dirname
function findRepoRoot() {
  let cur = import.meta.dirname;
  while (cur && cur !== dirname(cur)) {
    if (existsSync(join(cur, "apps", "online", "content"))) {
      return cur;
    }
    cur = dirname(cur);
  }
  return process.cwd();
}

const ROOT = findRepoRoot();
const CONTENT_DIR = join(ROOT, "apps", "online", "content");

if (!existsSync(CONTENT_DIR)) {
  console.error(`Error: Content directory not found at ${CONTENT_DIR}`);
  process.exit(2);
}

/**
 * Identify protected code spans (fenced code, inline backticks) where
 * [[lesson:...]] tokens should be treated as literal prose rather than links.
 */
function findProtectedRegions(content) {
  const regions = [];
  const fenceRe = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
  let m;
  while ((m = fenceRe.exec(content)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length });
  }
  const inlineRe = /`[^`\n]+`/g;
  while ((m = inlineRe.exec(content)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length });
  }
  return regions;
}

const LINK_PATTERN = /\[\[([^\]\n|]*)(?:\|([^\]\n]*))?\]\]/g;

// 1. Gather all lessons across specified or all studies
const studiesToScan = studyArg
  ? [studyArg]
  : readdirSync(CONTENT_DIR).filter((name) => {
      const full = join(CONTENT_DIR, name);
      return (
        statSync(full).isDirectory() &&
        !name.startsWith(".") &&
        name !== "assets" &&
        readdirSync(full).some((f) => f.endsWith(".json"))
      );
    });

const allLessons = [];
const byPath = new Map(); // "courseId/unitId/lessonId" -> lesson
const byCourseAndLesson = new Map(); // courseId -> Map(lessonId -> Lesson[])

for (const study of studiesToScan) {
  const studyDir = join(CONTENT_DIR, study);
  if (!existsSync(studyDir)) {
    console.error(`Study directory not found: ${studyDir}`);
    continue;
  }
  const courseFiles = readdirSync(studyDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("."),
  );

  for (const file of courseFiles) {
    const raw = readFileSync(join(studyDir, file), "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const course = data.course;
    if (!course || !course.units) continue;

    for (const unit of course.units) {
      for (const lesson of unit.lessons ?? []) {
        const item = {
          study,
          courseId: course.id,
          unitId: unit.id,
          lessonId: lesson.id,
          title: lesson.title,
          content: lesson.content ?? "",
          sections: lesson.sections ?? [],
        };
        allLessons.push(item);
        byPath.set(`${course.id}/${unit.id}/${lesson.id}`, item);

        if (!byCourseAndLesson.has(course.id)) {
          byCourseAndLesson.set(course.id, new Map());
        }
        const courseMap = byCourseAndLesson.get(course.id);
        if (!courseMap.has(lesson.id)) {
          courseMap.set(lesson.id, []);
        }
        courseMap.get(lesson.id).push(item);
      }
    }
  }
}

// 2. Scan and validate all [[lesson:...]] tokens
const brokenLinks = [];
let totalTokens = 0;
let threeSegmentLinksCount = 0;
let singleSegmentLinksCount = 0;

for (const lesson of allLessons) {
  const protectedRegions = findProtectedRegions(lesson.content);
  const sourcePath = `${lesson.courseId}/${lesson.unitId}/${lesson.lessonId}`;

  for (const match of lesson.content.matchAll(LINK_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (
      protectedRegions.some(
        (region) => start < region.end && region.start < end,
      )
    ) {
      continue;
    }

    const rawTarget = (match[1] ?? "").trim();
    const [kind, ...rest] = rawTarget.split(":");
    if (kind !== "lesson") continue;

    totalTokens++;
    const target = rest.join(":").trim();
    if (!target) {
      brokenLinks.push({
        source: sourcePath,
        target: rawTarget,
        reason: "malformed (empty target)",
      });
      continue;
    }

    const [pathTarget, targetSectionId] = target.split("#", 2);
    const segments = pathTarget.split("/");

    let found;
    if (segments.length === 3) {
      threeSegmentLinksCount++;
      found = byPath.get(pathTarget);
    } else if (segments.length === 1) {
      singleSegmentLinksCount++;
      const candidates =
        byCourseAndLesson.get(lesson.courseId)?.get(pathTarget) ?? [];
      if (candidates.length === 1) {
        found = candidates[0];
      } else if (candidates.length > 1) {
        brokenLinks.push({
          source: sourcePath,
          target,
          reason: "ambiguous (multiple lessons with same id in course)",
        });
        continue;
      }
    } else {
      brokenLinks.push({
        source: sourcePath,
        target,
        reason: "malformed (must be bare lessonId or course/unit/lesson)",
      });
      continue;
    }

    if (!found) {
      brokenLinks.push({
        source: sourcePath,
        target,
        reason: "not-found (target lesson does not exist)",
      });
      continue;
    }

    if (
      targetSectionId &&
      !found.sections.some((s) => s.id === targetSectionId)
    ) {
      brokenLinks.push({
        source: sourcePath,
        target,
        reason: `section-not-found (section #${targetSectionId} does not exist in target)`,
      });
    }
  }
}

// 3. Print Report
/**
 * Two lessons sharing an id is a broken link that resolves.
 *
 * A bare `[[lesson:x]]` is resolved by looking x up, so if two lessons answer
 * to x the token points at whichever the lookup happens to reach — and every
 * store keyed on a lesson id, progress included, has the same ambiguity. It
 * costs nothing to check here and it is invisible everywhere else, because
 * nothing fails: the wrong lesson simply opens.
 */
const idOwners = new Map();
for (const lesson of allLessons) {
  const key = lesson.lessonId;
  if (!idOwners.has(key)) idOwners.set(key, []);
  idOwners.get(key).push(`${lesson.study}/${lesson.courseId}/${lesson.unitId} 「${lesson.title}」`);
}
const duplicateIds = [...idOwners.entries()].filter(([, owners]) => owners.length > 1);

console.log("=== Lesson Link Resolution Report ===");
console.log(`Studies scanned: ${studiesToScan.join(", ")}`);
console.log(`Total lessons: ${allLessons.length}`);
console.log(`Total [[lesson:]] links parsed: ${totalTokens}`);
console.log(`  - Bare ID links (single-segment): ${singleSegmentLinksCount}`);
console.log(`  - Full-path links (3-segment): ${threeSegmentLinksCount}`);
console.log("");

if (brokenLinks.length === 0) {
  console.log("✓ All [[lesson:]] links resolve successfully (0 broken links).");
} else {
  console.log(`Found ${brokenLinks.length} dangling / broken [[lesson:]] link(s):`);
  for (const b of brokenLinks) {
    console.log(`  ${b.source} → ${b.target} [${b.reason}]`);
  }
}

console.log("");
if (duplicateIds.length === 0) {
  console.log("No duplicate lesson ids.");
} else {
  console.log(`Found ${duplicateIds.length} duplicated lesson id(s):`);
  for (const [id, owners] of duplicateIds) {
    console.log(`  ${id} — claimed by ${owners.length}:`);
    for (const owner of owners) console.log(`      ${owner}`);
  }
}
console.log("");
console.log(
  `Unique lesson ids: ${idOwners.size} across ${allLessons.length} lesson entries.`,
);
