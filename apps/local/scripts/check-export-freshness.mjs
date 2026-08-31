#!/usr/bin/env node
/**
 * Does the shipped export still say what the courses say?
 *
 * There are two freshness questions in this project and only one of them had
 * an answer. The first — has the studied repository moved underneath a lesson
 * — is covered by the freshness records and the audit. The second — has a
 * lesson moved underneath the export — had nothing watching it, and on
 * 2026-08-18 it went wrong for real: a 41-lesson rewrite finished at 13:59
 * while `course-proposals/recovery/` still held the previous afternoon's
 * bytes. Nothing failed. Nothing warned. A consumer reading the export would
 * have served the old wording and had no way to know.
 *
 * That gap matters more here than it would in most projects, because lesson
 * prose lives under an ignored `studies/`. The export is not a convenience
 * copy of the content; between commits it is the *only* version-controlled
 * copy of it.
 *
 * The check re-exports each study into a temporary directory and compares the
 * resulting `index.json` with the committed one. It deliberately does not
 * re-implement serialisation or hashing: a checker with its own copy of those
 * rules is a second thing that can drift, and then two things are wrong
 * instead of one. Asking the real exporter "would running you change
 * anything?" cannot drift by construction.
 *
 * Exit codes: 0 fresh (or nothing to check), 1 stale, 2 could not run.
 *
 * Usage:
 *   node scripts/check-export-freshness.mjs [--study <study-id>]
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const exportRoot = join(projectRoot, "course-proposals", "recovery");
const buildRoot = join(projectRoot, ".university-local-build", "server");

const onlyStudy = (() => {
  const at = process.argv.indexOf("--study");
  return at === -1 ? null : process.argv[at + 1];
})();

async function loadCompiled(relativePath, name) {
  const compiled = join(buildRoot, relativePath);
  if (!existsSync(compiled)) {
    console.error(
      `check-export-freshness: ${relativePath} is not compiled. Run \`pnpm build\` first.`,
    );
    process.exit(2);
  }
  const module = await import(pathToFileURL(compiled).href);
  return module[name];
}

function directoriesIn(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((entry) => statSync(join(root, entry)).isDirectory())
    .sort();
}

const loadUniversityLocalConfig = await loadCompiled(
  "config/load-config.js",
  "loadUniversityLocalConfig",
);
const exportCourseRecovery = await loadCompiled(
  "recovery/course-recovery.js",
  "exportCourseRecovery",
);

let studiesRoot;
try {
  ({ studiesRoot } = loadUniversityLocalConfig({ projectRoot }));
} catch (reason) {
  console.error(`check-export-freshness: cannot resolve studiesRoot — ${reason.message}`);
  process.exit(2);
}

// A fresh clone and CI both have no campus on disk. That is the normal state
// for anyone who is not the one person this workbench belongs to, and it must
// not fail their build — there is simply nothing to compare against.
if (!existsSync(studiesRoot)) {
  console.log("check-export-freshness: no studies root on this machine, nothing to compare.");
  process.exit(0);
}

// The repository keeps a README and .gitignore at apps/local/studies so a
// fresh worktree has the directory, but it does not have the owner's private
// study checkouts. Treat that skeleton like a missing root; otherwise every
// committed recovery export looks stale merely because there is no source to
// compare with.
const initializedStudies = directoriesIn(studiesRoot).filter((study) =>
  existsSync(join(studiesRoot, study, "study.json")),
);
if (initializedStudies.length === 0) {
  console.log(
    "check-export-freshness: no initialized studies on this machine. " +
      "SOURCE FRESHNESS IS NOT PROVEN HERE — this run cannot tell whether the " +
      "committed recovery still matches the author's course source.",
  );
  process.exit(0);
}

const exported = directoriesIn(exportRoot).filter((study) =>
  existsSync(join(exportRoot, study, "index.json")),
);
const initializedStudyIds = new Set(initializedStudies);
const studies = (onlyStudy ? exported.filter((study) => study === onlyStudy) : exported).filter(
  (study) => initializedStudyIds.has(study),
);

if (onlyStudy && !exported.includes(onlyStudy)) {
  console.error(`check-export-freshness: no export directory for study ${onlyStudy}`);
  process.exit(2);
}
if (studies.length === 0) {
  const missingSources = (
    onlyStudy ? exported.filter((study) => study === onlyStudy) : exported
  ).filter((study) => !initializedStudyIds.has(study));
  if (missingSources.length > 0) {
    console.log(
      "check-export-freshness: no initialized local source for " +
        `${missingSources.join(", ")}; nothing to compare.`,
    );
  } else {
    console.log("check-export-freshness: no exports to check.");
  }
  process.exit(0);
}

/*
  Skipping a study whose source is not on this machine is right — you cannot
  compare an export against a checkout you do not have. Saying so quietly is
  not. The all-skipped path above shouts SOURCE FRESHNESS IS NOT PROVEN HERE;
  the partial-skip path printed a confident "N export(s) match their courses"
  and said nothing about the one it did not look at.

  That difference is not cosmetic. On 2026-08-31 a broken worktree symlink hid
  turing-pact from this checker, the run went green, and the branch reported a
  passing verify while main was failing on that exact study. A gate that gets
  quieter as its coverage shrinks trains you to stop reading it.
*/
const skipped = exported.filter((study) => !initializedStudyIds.has(study));

const stale = [];
const scratch = mkdtempSync(join(tmpdir(), "university-local-export-check-"));
try {
  for (const study of studies) {
    const committed = JSON.parse(readFileSync(join(exportRoot, study, "index.json"), "utf8"));
    const out = join(scratch, study);
    let rebuilt;
    try {
      exportCourseRecovery({ studiesRoot, studyId: study, outDirectory: out });
      rebuilt = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
    } catch (reason) {
      stale.push({ study, reason: `re-export failed: ${reason.message}`, courses: [] });
      continue;
    }

    const committedByCourse = new Map(committed.courses.map((entry) => [entry.courseId, entry]));
    const rebuiltByCourse = new Map(rebuilt.courses.map((entry) => [entry.courseId, entry]));
    const courses = [];
    for (const [courseId, entry] of rebuiltByCourse) {
      const previous = committedByCourse.get(courseId);
      if (!previous) courses.push(`${courseId}: not in the export`);
      else if (previous.sha256 !== entry.sha256) courses.push(`${courseId}: content changed`);
    }
    for (const courseId of committedByCourse.keys()) {
      if (!rebuiltByCourse.has(courseId)) courses.push(`${courseId}: no longer active`);
    }

    // Study title, goals and default course live in the index too, so compare
    // the whole document rather than only the course list.
    const metadataChanged = JSON.stringify(committed.study) !== JSON.stringify(rebuilt.study);
    if (courses.length > 0 || metadataChanged) {
      stale.push({
        study,
        reason: metadataChanged && courses.length === 0 ? "study metadata changed" : "",
        courses,
      });
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const unexported = directoriesIn(studiesRoot).filter(
  (study) => !exported.includes(study) && existsSync(join(studiesRoot, study, "study.json")),
);
for (const study of unexported) {
  console.log(`check-export-freshness: note — study ${study} has never been exported.`);
}

if (stale.length === 0) {
  console.log(
  `check-export-freshness: ${studies.length} export(s) match their courses` +
    (skipped.length > 0
      ? `; ${skipped.length} NOT CHECKED (no local source for ${skipped.join(", ")}) — ` +
        "freshness is unproven for those"
      : "") +
    ".",
);
  process.exit(0);
}

console.error("check-export-freshness: the export no longer matches the courses.\n");
for (const entry of stale) {
  console.error(`  ${entry.study}${entry.reason ? ` — ${entry.reason}` : ""}`);
  for (const course of entry.courses) console.error(`    - ${course}`);
  console.error(
    `    fix: node scripts/university-local.mjs course recovery export --study ${entry.study} --out course-proposals/recovery/${entry.study}`,
  );
  console.error("");
}
console.error(
  "Exporting never deletes, so remove any object the new index.json no longer references.",
);
process.exit(1);
