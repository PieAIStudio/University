#!/usr/bin/env node
/**
 * Bring published courses into this product, and take them apart on the way in.
 *
 * A recovery package is self-contained on purpose: one JSON file holds a whole
 * course, its cards, its exercises, its evidence and its screenshots, so it can
 * be handed over without a second channel. That is exactly right for transport
 * and wrong for a runtime. One package here is 6.8 MB, of which 6.1 MB is four
 * base64 screenshots, and a learner on a phone must never parse that to read
 * one lesson.
 *
 * So import splits it: lesson text and structure into a small per-course file,
 * every asset out into its own content-addressed file that loads only when the
 * lesson that needs it is open. Cited source ranges get the same treatment:
 * read from `studies/<id>/source/repository.git` and written beside the course
 * as content-addressed JSON. A machine with no checkout bakes none of them
 * and still exits 0 — being unable to see a sibling repository is a normal
 * state, not a broken build.
 *
 * What lands in `content/` is ignored by git — it quotes private repositories
 * verbatim. What is tracked is `content/manifest.json`: study and course ids,
 * package hashes, counts. The generated `content/shelf.json` is the small
 * delivery projection beside those packages; it carries structure and derived
 * path facts, never lesson prose or answer material. The manifest satisfies the
 * parity contract's requirement that an import be reproducible from a tracked
 * record without the bytes themselves being tracked, and it is also the file a
 * review gate will one day sign.
 *
 * Direction is one-way. This reads a UniversityLocal checkout and never writes
 * to it; with no checkout it reports that and exits 0.
 *
 * Usage:
 *   node scripts/import-courses.mjs [--study <id>]
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";

import { compileAnswerKey } from "@pieai/university-core";
import {
  evidenceCount,
  evidenceLocatorsIn,
  unlockEntryCount,
} from "@pieai/university-core/marks/path-stats.js";
import { join, resolve } from "node:path";

import { bakeLessonEvidence, hasAnyStudyRepository } from "./bake-evidence.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const contentRoot = join(projectRoot, "content");
// The authoring shell is a sibling package now, not a repository somewhere
// else on the machine. That is worth more than a shorter path: the exports
// this reads and the courses they came from move together in one commit, so
// "the export was stale and nothing reported it" stops being possible by
// construction rather than by a checker noticing afterwards.
const upstream = resolve(
  projectRoot,
  process.env["UNIVERSITY_UPSTREAM_RECOVERY"] ?? "../local/course-proposals/recovery",
);

if (!existsSync(upstream)) {
  console.log(`import-courses: no upstream configured at ${upstream}, nothing to import.`);
  process.exit(0);
}

const onlyStudy = (() => {
  const at = process.argv.indexOf("--study");
  return at === -1 ? null : process.argv[at + 1];
})();

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** `data:image/png;base64,...` or a bare base64 blob, either way to bytes. */
function decodeAsset(dataBase64) {
  const comma = dataBase64.indexOf(",");
  const head = comma === -1 ? "" : dataBase64.slice(0, comma);
  const body = comma === -1 ? dataBase64 : dataBase64.slice(comma + 1);
  const type = /data:([^;,]+)/.exec(head)?.[1] ?? "application/octet-stream";
  return { bytes: Buffer.from(body, "base64"), type };
}

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

rmSync(contentRoot, { recursive: true, force: true });
mkdirSync(join(contentRoot, "assets"), { recursive: true });

let keysCompiled = 0;
/** Keys with nothing left to compare, reported at the end rather than shipped. */
const unusableKeys = [];
const manifest = { importedAt: new Date().toISOString().slice(0, 10), studies: [] };
const shelf = { studies: [] };
let assetCount = 0;
let assetBytes = 0;
let inlineBytes = 0;
const studiesRoot = resolve(
  projectRoot,
  process.env["UNIVERSITY_STUDIES_ROOT"] ?? "../local/studies",
);
let snippetBaked = 0;
let snippetSkipped = 0;
let snippetBytes = 0;
let snippetFiles = 0;
let snippetEvidence = 0;

for (const studyId of readdirSync(upstream).sort()) {
  if (onlyStudy && studyId !== onlyStudy) continue;
  const studyDir = join(upstream, studyId);
  if (!statSync(studyDir).isDirectory()) continue;
  const indexPath = join(studyDir, "index.json");
  if (!existsSync(indexPath)) continue;

  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  mkdirSync(join(contentRoot, studyId), { recursive: true });

  const courses = [];
  const shelfCourses = [];
  for (const entry of index.courses) {
    const raw = readFileSync(join(studyDir, entry.file));
    const pkg = JSON.parse(raw.toString("utf8"));
    const course = pkg.course;

    // Assets leave the JSON here. Each becomes its own file named by its hash,
    // so two lessons quoting the same screenshot store it once and a browser
    // can cache it forever.
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        // Delivery packages are frozen at one published revision. Keep the
        // revision on the package itself so shared progress code receives the
        // caller's current version instead of inventing one in core.
        lesson.contentRevision = 1;
        // The answer never leaves the build.
        //
        // `expectedAnswer` was being served inside the lesson JSON, so every
        // answer in the product sat in plain text one network tab away before
        // the learner had typed anything. The authoring shell discloses a
        // reference answer only after repeated attempts or a pass; the shell
        // people pay for was giving it away. What ships now is a fingerprint.
        //
        // The mistake book asked for this back, and the answer is still no. A
        // read model that drops a field does not unsend the bytes: whoever
        // opens a network tab reads all 1,800 answers, and they have attempted
        // none of them. Showing one learner the answer to the one question
        // they just got wrong is a *server* read, and it waits for the server.
        for (const exercise of lesson.exercises ?? []) {
          if (typeof exercise.expectedAnswer === "string") {
            const key = compileAnswerKey(exercise.expectedAnswer);
            exercise.answerKey = key;
            keysCompiled += 1;
            // A key with nothing left to compare cannot decide anything, and
            // before this check it decided everything: the empty fingerprint
            // matched at every position and the exercise passed any answer at
            // all. Reported here because a build is where it can still be
            // fixed, and because six exercises shipped like that unnoticed.
            if (Math.max(key.len, key.symLen ?? 0) === 0) {
              unusableKeys.push(`${studyId}/${course.id}/${lesson.id}`);
            }
          }
          delete exercise.expectedAnswer;
          delete exercise.rubric;
        }
        snippetEvidence += (lesson.evidence ?? []).length;
        const baked = bakeLessonEvidence({
          studiesRoot,
          studyId,
          courseId: course.id,
          evidence: lesson.evidence ?? [],
          contentRoot,
          sha,
        });
        snippetBaked += baked.baked;
        snippetSkipped += baked.skipped;
        snippetBytes += baked.bytes;
        snippetFiles += baked.files;

        lesson.assets = (lesson.assets ?? []).map((asset) => {
          if (!asset.dataBase64) return asset;
          inlineBytes += asset.dataBase64.length;
          const { bytes, type } = decodeAsset(asset.dataBase64);
          // The package stores bare base64 with no `data:` prefix, so the mime
          // the exporter recorded is the authoritative one; sniffing the blob
          // only ever returns application/octet-stream and every screenshot
          // lands on disk as a `.bin` nothing will preview.
          const mime = asset.metadata?.mime ?? type;
          const digest = sha(bytes);
          const name = `${digest}.${EXTENSIONS[mime] ?? "bin"}`;
          const target = join(contentRoot, "assets", name);
          if (!existsSync(target)) {
            writeFileSync(target, bytes);
            assetCount += 1;
            assetBytes += bytes.length;
          }
          // Flatten into the shape the shared reader already speaks.
          //
          // The recovery package nests everything real under `metadata` and
          // puts the pixels beside it as base64. `LessonAssetView` wants those
          // fields at the top level with a `url` instead. Doing that conversion
          // here — once, at the boundary — is what lets the reader be the same
          // component on both sides; doing it in the component would be a
          // second shape with a second set of bugs.
          const meta = asset.metadata ?? {};
          return {
            ...meta,
            url: `/content/assets/${name}`,
            mime,
            alt: meta.alt ?? "",
            bytes: bytes.length,
          };
        });
      }
    }

    const body = Buffer.from(`${JSON.stringify(pkg)}\n`, "utf8");
    writeFileSync(join(contentRoot, studyId, `${course.id}.json`), body);
    shelfCourses.push({
      id: course.id,
      title: course.title,
      description: course.description,
      audience: course.audience,
      objectives: course.objectives,
      status: "active",
      isDefault: course.id === index.study.defaultCourseId,
      prerequisiteCourseIds: course.prerequisiteCourseIds,
      trackId: course.trackId,
      units: course.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        objective: unit.objective,
        status: "active",
        lessons: unit.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          variant: lesson.variant ?? null,
          status: "active",
          contentRevision: 1,
          cardCount: lesson.cards.length,
          exerciseCount: lesson.exercises.length,
          exerciseIds: lesson.exercises.map((exercise) => exercise.id),
          contentChars: lesson.content.length,
          evidenceCount: evidenceCount(lesson.content),
          unlockCount: unlockEntryCount(lesson.content),
          // The unit card de-duplicates in lesson order and returns at five.
          // Each lesson's list is already unique and ordered, so keeping its
          // first five can never remove a locator that the unit card would read.
          evidenceLocators: evidenceLocatorsIn(lesson.content).slice(0, 5),
          progress: null,
        })),
      })),
    });
    courses.push({
      courseId: course.id,
      title: course.title,
      sha256: entry.sha256,
      packageBytes: raw.length,
      servedBytes: body.length,
      lessons: course.units.reduce((sum, unit) => sum + unit.lessons.length, 0),
    });
  }

  manifest.studies.push({
    studyId: index.study.id,
    title: index.study.title,
    defaultCourseId: index.study.defaultCourseId,
    courses,
  });
  shelf.studies.push({
    id: index.study.id,
    title: index.study.title,
    courses: shelfCourses,
  });
}

writeFileSync(join(contentRoot, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
// The manifest is human-reviewed and stays pretty; shelf is machine-only and
// is kept compact so its projection does not spend bytes on indentation.
writeFileSync(join(contentRoot, "shelf.json"), `${JSON.stringify(shelf)}\n`);
// The manifest is the tracked half of this: it records exactly which package
// hash each course came from, so a fresh clone can reproduce the import and a
// review can be recorded against a version rather than a name.
mkdirSync(join(projectRoot, "src", "content"), { recursive: true });
writeFileSync(
  join(projectRoot, "src", "content", "imported.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// The lexicon is bundled rather than fetched, unlike lesson prose.
//
// Every lesson needs it and it is 90 KB for the whole language, so a per-course
// fetch would pay the request cost repeatedly to deliver bytes the reader
// already had. It is copied rather than imported across the workspace because
// it is authored content that travels with the courses it annotates: a word
// added upstream reaches this shell on the next `pnpm content`, in the same
// commit as the lessons that use it.
const lexiconSource = resolve(
  projectRoot,
  process.env["UNIVERSITY_UPSTREAM_LEXICON"] ?? "../local/data/vocabulary/en.json",
);
let lexiconSenses = 0;
if (existsSync(lexiconSource)) {
  const lexicon = JSON.parse(readFileSync(lexiconSource, "utf8"));
  lexiconSenses = lexicon.entries.length;
  writeFileSync(
    join(projectRoot, "src", "content", "lexicon.json"),
    `${JSON.stringify(lexicon, null, 2)}\n`,
  );
} else {
  // Not fatal: the reader treats an absent lexicon as "no words to annotate",
  // which is the same path a lesson with no matches already takes.
  console.warn(
    `import-courses: no lexicon at ${lexiconSource}, foreign-language mode will be empty.`,
  );
}

const totalCourses = manifest.studies.reduce((sum, study) => sum + study.courses.length, 0);
const totalServed = manifest.studies.reduce(
  (sum, study) => sum + study.courses.reduce((n, course) => n + course.servedBytes, 0),
  0,
);
console.log(
  `import-courses: ${keysCompiled} answer keys compiled (answers stripped), ` +
    `${manifest.studies.length} studies, ${totalCourses} courses, ` +
    `${(totalServed / 1048576).toFixed(1)} MB of lesson JSON, ` +
    `${assetCount} assets lifted out (${(assetBytes / 1048576).toFixed(1)} MB, ` +
    `was ${(inlineBytes / 1048576).toFixed(1)} MB inline), ` +
    `${lexiconSenses} lexicon senses bundled.`,
);

if (snippetBaked === 0) {
  console.log(
    hasAnyStudyRepository(studiesRoot)
      ? `import-courses: baked 0 evidence snippets (${snippetSkipped} cited ranges unreadable).`
      : `import-courses: baked 0 evidence snippets (no checkout at ${studiesRoot}).`,
  );
} else {
  console.log(
    `import-courses: baked ${snippetBaked}/${snippetEvidence} evidence snippets ` +
      `into ${snippetFiles} files (${(snippetBytes / 1048576).toFixed(2)} MB` +
      (snippetSkipped > 0 ? `; ${snippetSkipped} skipped` : "") +
      `).`,
  );
}

if (unusableKeys.length > 0) {
  console.warn(
    `\nimport-courses: ${unusableKeys.length} answer key(s) have nothing left to compare.\n` +
      `These exercises cannot be graded at tier one and will ask tier two instead:\n` +
      unusableKeys.map((where) => `  \u00b7 ${where}`).join("\n") +
      `\nUsually the expected answer is punctuation the normaliser removes. Fix it upstream.\n`,
  );
}
