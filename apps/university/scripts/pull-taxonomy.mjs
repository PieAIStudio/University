#!/usr/bin/env node
/**
 * Read the shape of the exported courses, and nothing else.
 *
 * The journey V2 designs are drawn against the real library rather than a
 * sketch, because a sketch cannot tell you that one course holds 41 lessons
 * and another holds 1, that one study has no ordering at all while another is
 * a chain 14 deep, or that a lesson averages 2,363 characters of Chinese with
 * code blocks in it. Every one of those changed a design decision.
 *
 * So this pulls a *taxonomy digest*: ids, titles, counts, prerequisites. It
 * deliberately carries no lesson prose, no code, and no evidence paths. That
 * is not tidiness. Recovery packages quote private repositories verbatim —
 * 968 fenced code blocks across the library — and a design document that can
 * be opened, screenshotted and forwarded is the wrong container for them. The
 * digest is safe to track; the prose is not, and is fetched separately into an
 * ignored file when a wireframe genuinely needs a real lesson to render.
 *
 * Direction is one-way. This reads a UniversityLocal checkout and never writes
 * to it. When there is no checkout — a fresh clone, CI, anyone who is not the
 * author — it reports that and exits 0, because being unable to see a sibling
 * repository is a normal state and not a broken build.
 *
 * Usage:
 *   node scripts/pull-taxonomy.mjs [--sample <study>/<course>/<lesson>]
 *
 * Override the upstream with UNIVERSITY_UPSTREAM_RECOVERY.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
// Governed docs live at the repository root, not inside this app. Left as
// `projectRoot` after the monorepo move, this wrote a fresh `apps/online/docs/`
// nobody reads while the real taxonomy quietly went stale.
const outRoot = resolve(
  projectRoot,
  "../../docs",
  "reference",
  "player-journey",
  "v2",
  "data",
);

const upstream = resolve(
  projectRoot,
  process.env["UNIVERSITY_UPSTREAM_RECOVERY"] ?? "../local/course-proposals/recovery",
);

if (!existsSync(upstream)) {
  console.log(`pull-taxonomy: no upstream configured at ${upstream}, nothing to pull.`);
  process.exit(0);
}

const sampleRoute = (() => {
  const at = process.argv.indexOf("--sample");
  return at === -1 ? null : process.argv[at + 1];
})();

/** Fenced blocks, counted in pairs. Used to size the reader, not to read it. */
function countCodeBlocks(markdown) {
  return Math.floor((markdown.match(/^```/gm) ?? []).length / 2);
}

const studies = [];
const sampleWanted = sampleRoute ? sampleRoute.split("/") : null;
let sample = null;

for (const studyId of readdirSync(upstream).sort()) {
  const studyDir = join(upstream, studyId);
  if (!statSync(studyDir).isDirectory()) continue;
  const indexPath = join(studyDir, "index.json");
  if (!existsSync(indexPath)) continue;

  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  const courses = [];

  for (const entry of index.courses) {
    const pkg = JSON.parse(readFileSync(join(studyDir, entry.file), "utf8"));
    const course = pkg.course;
    const units = course.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      objective: unit.objective,
      lessons: unit.lessons.map((lesson) => {
        const markdown = lesson.content ?? "";
        if (
          sampleWanted &&
          sampleWanted[0] === studyId &&
          sampleWanted[1] === course.id &&
          sampleWanted[2] === lesson.id
        ) {
          sample = {
            studyId,
            courseId: course.id,
            courseTitle: course.title,
            unitId: unit.id,
            unitTitle: unit.title,
            lesson,
          };
        }
        return {
          id: lesson.id,
          title: lesson.title,
          variant: lesson.variant ?? null,
          chars: markdown.length,
          codeBlocks: countCodeBlocks(markdown),
          evidence: (lesson.evidence ?? []).length,
          cards: (lesson.cards ?? []).length,
          exercises: (lesson.exercises ?? []).length,
          // Sized, never carried: a 2.86 MB screenshot is a delivery fact the
          // map has to know about and a payload a design page must not hold.
          assetBytes: (lesson.assets ?? []).reduce(
            (total, asset) => total + (asset.dataBase64?.length ?? 0),
            0,
          ),
        };
      }),
    }));

    courses.push({
      id: course.id,
      title: course.title,
      description: course.description ?? "",
      audience: course.audience ?? "",
      objectives: course.objectives ?? [],
      currency: course.currency ?? "follow-ref",
      prerequisiteCourseIds: course.prerequisiteCourseIds ?? [],
      // The named path this course is on, when its author put it on one.
      // Before this field existed, a consumer that needed "the nine
      // foundations courses" had to match on an id prefix — which is this
      // repository holding a second, unwritten copy of the course structure.
      trackId: course.trackId ?? null,
      sha256: entry.sha256,
      packageBytes: statSync(join(studyDir, entry.file)).size,
      units,
    });
  }

  studies.push({
    id: index.study.id,
    title: index.study.title,
    description: index.study.description ?? "",
    goals: index.study.goals ?? [],
    defaultCourseId: index.study.defaultCourseId ?? null,
    courses,
  });
}

/**
 * How far a course sits from a root, following prerequisites.
 *
 * The map needs it and the package does not carry it, because depth is a
 * property of the set rather than of any one course: adding one prerequisite
 * upstream moves everything behind it. Computing it here — rather than storing
 * it — is what keeps this repository from owning a second copy of the course
 * structure.
 */
function assignDepth(courses) {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const depths = new Map();
  const visiting = new Set();
  const walk = (id) => {
    if (depths.has(id)) return depths.get(id);
    const course = byId.get(id);
    // A prerequisite outside this study cannot be expressed by the schema, so
    // an unresolvable id is treated as a root rather than as an error.
    if (!course || visiting.has(id)) return 0;
    visiting.add(id);
    const depth = course.prerequisiteCourseIds.length
      ? Math.max(...course.prerequisiteCourseIds.map(walk)) + 1
      : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const course of courses) course.depth = walk(course.id);
}

for (const study of studies) assignDepth(study.courses);

const totals = studies.reduce(
  (sum, study) => {
    for (const course of study.courses) {
      sum.courses += 1;
      for (const unit of course.units) {
        sum.units += 1;
        for (const lesson of unit.lessons) {
          sum.lessons += 1;
          sum.chars += lesson.chars;
          sum.codeBlocks += lesson.codeBlocks;
          sum.cards += lesson.cards;
          sum.exercises += lesson.exercises;
          sum.evidence += lesson.evidence;
          sum.assetBytes += lesson.assetBytes;
        }
      }
    }
    return sum;
  },
  {
    studies: studies.length,
    courses: 0,
    units: 0,
    lessons: 0,
    chars: 0,
    codeBlocks: 0,
    cards: 0,
    exercises: 0,
    evidence: 0,
    assetBytes: 0,
  },
);

mkdirSync(outRoot, { recursive: true });
const digest = { generatedAt: new Date().toISOString().slice(0, 10), totals, studies };
writeFileSync(join(outRoot, "taxonomy.json"), `${JSON.stringify(digest, null, 1)}\n`);
console.log(
  `pull-taxonomy: ${totals.studies} studies, ${totals.courses} courses, ${totals.units} units, ${totals.lessons} lessons.`,
);

if (sampleWanted) {
  if (!sample) {
    console.error(`pull-taxonomy: no lesson at ${sampleRoute}`);
    process.exit(1);
  }
  const samplePath = join(outRoot, "sample-lesson.json");
  mkdirSync(dirname(samplePath), { recursive: true });
  writeFileSync(samplePath, `${JSON.stringify(sample, null, 1)}\n`);
  console.log(
    `pull-taxonomy: sample lesson written to ${samplePath} — untracked on purpose, it quotes source.`,
  );
}
