#!/usr/bin/env node
/**
 * Check whether `[[lesson:...]]` tokens in the current UniversityLocal course
 * sources resolve to valid lessons.
 *
 * The source of truth is the latest revision on the UniversityLocal studies
 * shelf. The delivery packages and `imported.json` are downstream generated
 * material: checking either one can bless a stale import while the source has
 * already changed.
 *
 * Courses are written with wiki-style lesson links:
 * - Bare ID: `[[lesson:intro]]` resolves within the same course.
 * - Full path: `[[lesson:courseId/unitId/lessonId]]` resolves across courses in
 *   the same study.
 * - Section target: `[[lesson:target#sectionId]]` checks that the section exists.
 *
 * Exit codes:
 * - 0: PASS;
 * - 1: FAIL, content has broken links or ambiguous IDs;
 * - 2: ERROR, the check has no source or could not inspect its configured source.
 *
 * Usage:
 *   node apps/local/scripts/check-lesson-links.mjs [study]
 *   node apps/local/scripts/check-lesson-links.mjs --studies-root <path> [study]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "../../..");
const APP_ROOT = join(ROOT, "apps", "local");

function parseArguments(argv) {
  let study;
  let studiesRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--studies-root") {
      studiesRoot = argv[index + 1];
      if (!studiesRoot) throw new Error("--studies-root needs a path");
      index += 1;
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    } else if (study === undefined) {
      study = value;
    } else {
      throw new Error("Only one study may be selected");
    }
  }
  return { study, studiesRoot };
}

function readConfiguredStudiesRoot() {
  const override = process.env["UNIVERSITY_LOCAL_STUDIES_ROOT"];
  let candidate = override;
  if (!candidate) {
    for (const name of ["university-local.config.local.json", "university-local.config.json"]) {
      const path = join(APP_ROOT, name);
      if (!existsSync(path)) continue;
      const config = JSON.parse(readFileSync(path, "utf8"));
      if (typeof config.studiesRoot === "string") {
        candidate = config.studiesRoot;
        break;
      }
    }
  }
  const configured = candidate ?? "./studies";
  const absolute = resolve(APP_ROOT, configured);
  return resolveStudiesRoot(absolute);
}

function containsStudyManifest(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return false;
  return readdirSync(root, { withFileTypes: true }).some(
    (entry) => !entry.name.startsWith(".") && existsSync(join(root, entry.name, "study.json")),
  );
}

function resolveStudiesRoot(candidate) {
  const canonical = existsSync(candidate) ? realpathSync.native(candidate) : candidate;
  if (containsStudyManifest(canonical)) return canonical;

  // Worktrees made by this repository keep a real outer `studies` directory
  // and put the private source shelf behind its `studies` symlink. Follow that
  // documented layout without ever falling back to generated delivery files.
  const nested = join(canonical, "studies");
  if (containsStudyManifest(nested)) {
    return existsSync(nested) ? realpathSync.native(nested) : nested;
  }
  return canonical;
}

function directoriesIn(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${label} at ${path}: ${detail}`);
  }
}

function latestLesson(studiesRoot, studyId, courseId, unitId, lessonId) {
  const lessonRoot = join(
    studiesRoot,
    studyId,
    "courses",
    courseId,
    "units",
    unitId,
    "lessons",
    lessonId,
  );
  const latest = readJson(join(lessonRoot, "latest.json"), "latest lesson pointer");
  if (!Number.isInteger(latest.contentRevision) || latest.contentRevision < 1) {
    throw new Error(`Invalid contentRevision for ${studyId}/${courseId}/${unitId}/${lessonId}`);
  }
  const revisionRoot = join(lessonRoot, "revisions", String(latest.contentRevision));
  const manifest = readJson(join(revisionRoot, "manifest.json"), "lesson manifest");
  return {
    studyId,
    courseId,
    unitId,
    lessonId,
    title: typeof manifest.title === "string" ? manifest.title : "",
    content: readFileSync(join(revisionRoot, "content.md"), "utf8"),
    sections: Array.isArray(manifest.sections) ? manifest.sections : [],
  };
}

function readStudyLessons(studiesRoot, studyId) {
  const studyRoot = join(studiesRoot, studyId);
  const coursesRoot = join(studyRoot, "courses");
  if (!existsSync(join(studyRoot, "study.json"))) {
    throw new Error(`Study manifest not found at ${join(studyRoot, "study.json")}`);
  }
  const lessons = [];
  for (const courseId of directoriesIn(coursesRoot)) {
    const courseRoot = join(coursesRoot, courseId);
    if (!existsSync(join(courseRoot, "course.json"))) continue;
    for (const unitId of directoriesIn(join(courseRoot, "units"))) {
      const unitRoot = join(courseRoot, "units", unitId);
      if (!existsSync(join(unitRoot, "unit.json"))) continue;
      for (const lessonId of directoriesIn(join(unitRoot, "lessons"))) {
        if (!existsSync(join(unitRoot, "lessons", lessonId, "latest.json"))) continue;
        lessons.push(latestLesson(studiesRoot, studyId, courseId, unitId, lessonId));
      }
    }
  }
  return lessons;
}

function sourcePath(lesson) {
  return `${lesson.courseId}/${lesson.unitId}/${lesson.lessonId}`;
}

function ensureCoreBuild() {
  const resolverPath = join(ROOT, "packages", "core", "dist", "marks", "references.js");
  if (existsSync(resolverPath)) return resolverPath;
  const result = spawnSync("pnpm", ["--filter", "@pieai/university-core", "build"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("The shared lesson-link resolver could not be built");
  }
  return resolverPath;
}

async function loadResolver() {
  const resolverPath = ensureCoreBuild();
  return import(pathToFileURL(resolverPath).href);
}

function scanStudy(lessons, resolver) {
  const index = resolver.assembleLessonIndex(lessons);
  const brokenLinks = [];
  let linkCount = 0;
  const duplicateOwners = new Map();

  for (const lesson of lessons) {
    const key = `${lesson.courseId}/${lesson.lessonId}`;
    const owners = duplicateOwners.get(key) ?? [];
    owners.push(lesson);
    duplicateOwners.set(key, owners);

    const links = resolver
      .parseLessonLinks(lesson.content)
      .filter((link) => resolver.tokenKind(link) === "lesson");
    linkCount += links.length;
    for (const result of resolver.resolveLessonLinks(links, index, lesson)) {
      if (result.kind === "resolved") continue;
      const rawTarget = result.link.rawTarget;
      const target = rawTarget.startsWith("lesson:")
        ? rawTarget.slice("lesson:".length).trim()
        : rawTarget;
      brokenLinks.push({
        source: sourcePath(lesson),
        target: target || rawTarget,
        reason: result.reason,
      });
    }
  }

  return {
    brokenLinks,
    duplicateIds: [...duplicateOwners.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([id, owners]) => ({ id, owners })),
    linkCount,
  };
}

function repeatedIdsAcrossCourses(lessons) {
  const owners = new Map();
  for (const lesson of lessons) {
    const entries = owners.get(lesson.lessonId) ?? [];
    entries.push(lesson);
    owners.set(lesson.lessonId, entries);
  }
  return [...owners.entries()]
    .filter(
      ([, entries]) =>
        new Set(entries.map((entry) => `${entry.studyId}/${entry.courseId}`)).size > 1,
    )
    .map(([id, entries]) => ({ id, owners: entries }));
}

function printReport({
  studiesRoot,
  studies,
  lessons,
  linkCount,
  brokenLinks,
  duplicateIds,
  repeatedIds,
}) {
  console.log("=== Lesson Link Resolution Report ===");
  console.log(`Source studies root: ${studiesRoot}`);
  console.log(`Studies scanned: ${studies.join(", ")}`);
  console.log(`Total lessons: ${lessons.length}`);
  console.log(`Total [[lesson:]] links parsed: ${linkCount}`);
  console.log("");

  if (brokenLinks.length === 0) {
    console.log("No dangling / broken [[lesson:]] links.");
  } else {
    console.log(`Found ${brokenLinks.length} dangling / broken [[lesson:]] link(s):`);
    for (const broken of brokenLinks) {
      console.log(`  ${broken.source} → ${broken.target} [${broken.reason}]`);
    }
  }

  console.log("");
  if (duplicateIds.length === 0) {
    console.log("No ambiguous duplicate lesson ids within a study/course.");
  } else {
    console.log(`Found ${duplicateIds.length} ambiguous duplicated lesson id(s):`);
    for (const duplicate of duplicateIds) {
      console.log(`  ${duplicate.id} — claimed by ${duplicate.owners.length}:`);
      for (const owner of duplicate.owners) {
        console.log(`      ${owner.studyId}/${owner.courseId}/${owner.unitId} 「${owner.title}」`);
      }
    }
  }

  if (repeatedIds.length > 0) {
    console.log("");
    console.log(
      `Informational: ${repeatedIds.length} lesson id(s) repeat across different courses; ` +
        "the resolver keeps those scopes separate:",
    );
    for (const repeated of repeatedIds) {
      console.log(
        `  ${repeated.id} — ${repeated.owners
          .map((owner) => `${owner.studyId}/${owner.courseId}`)
          .join(", ")}`,
      );
    }
  }

  console.log("");
  if (brokenLinks.length === 0 && duplicateIds.length === 0) {
    console.log("PASS: lesson links and resolver-scoped lesson ids are valid.");
    return 0;
  }
  console.error(
    `FAIL: ${brokenLinks.length} broken link(s), ${duplicateIds.length} ambiguous duplicate id group(s).`,
  );
  return 1;
}

async function main() {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const studiesRoot = args.studiesRoot
    ? resolveStudiesRoot(resolve(args.studiesRoot))
    : readConfiguredStudiesRoot();
  if (!existsSync(studiesRoot)) {
    console.error(`ERROR: no course source at ${studiesRoot}; cannot scan.`);
    return 2;
  }

  const studies = args.study
    ? [args.study]
    : directoriesIn(studiesRoot).filter((studyId) =>
        existsSync(join(studiesRoot, studyId, "study.json")),
      );
  if (studies.length === 0) {
    console.error(`ERROR: no study manifests under ${studiesRoot}; cannot scan.`);
    return 2;
  }
  if (args.study && !existsSync(join(studiesRoot, args.study, "study.json"))) {
    console.error(
      `ERROR: study manifest not found at ${join(studiesRoot, args.study, "study.json")}`,
    );
    return 2;
  }

  try {
    const resolver = await loadResolver();
    const allLessons = [];
    const allBrokenLinks = [];
    const allDuplicateIds = [];
    let linkCount = 0;
    for (const study of studies) {
      const lessons = readStudyLessons(studiesRoot, study);
      const result = scanStudy(lessons, resolver);
      allLessons.push(...lessons);
      allBrokenLinks.push(...result.brokenLinks);
      allDuplicateIds.push(
        ...result.duplicateIds.map((duplicate) => ({
          ...duplicate,
          owners: duplicate.owners.map((owner) => ({ ...owner, studyId: study })),
        })),
      );
      linkCount += result.linkCount;
    }
    return printReport({
      studiesRoot,
      studies,
      lessons: allLessons,
      linkCount,
      brokenLinks: allBrokenLinks,
      duplicateIds: allDuplicateIds,
      repeatedIds: repeatedIdsAcrossCourses(allLessons),
    });
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

process.exitCode = await main();
