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
 * lesson that needs it is open. Same bytes, different shape, chosen by whoever
 * has to serve them.
 *
 * What lands in `content/` is ignored by git — it quotes private repositories
 * verbatim. What is tracked is `content/manifest.json`: study and course ids,
 * package hashes, counts. That satisfies the parity contract's requirement
 * that an import be reproducible from a tracked manifest without the bytes
 * themselves being tracked, and it is also the file a review gate will one day
 * sign.
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
import { join, resolve } from "node:path";

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
const manifest = { importedAt: new Date().toISOString().slice(0, 10), studies: [] };
let assetCount = 0;
let assetBytes = 0;
let inlineBytes = 0;

for (const studyId of readdirSync(upstream).sort()) {
  if (onlyStudy && studyId !== onlyStudy) continue;
  const studyDir = join(upstream, studyId);
  if (!statSync(studyDir).isDirectory()) continue;
  const indexPath = join(studyDir, "index.json");
  if (!existsSync(indexPath)) continue;

  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  mkdirSync(join(contentRoot, studyId), { recursive: true });

  const courses = [];
  for (const entry of index.courses) {
    const raw = readFileSync(join(studyDir, entry.file));
    const pkg = JSON.parse(raw.toString("utf8"));
    const course = pkg.course;

    // Assets leave the JSON here. Each becomes its own file named by its hash,
    // so two lessons quoting the same screenshot store it once and a browser
    // can cache it forever.
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        // The answer never leaves the build.
        //
        // `expectedAnswer` was being served inside the lesson JSON, so every
        // answer in the product sat in plain text one network tab away before
        // the learner had typed anything. The authoring shell discloses a
        // reference answer only after repeated attempts or a pass; the shell
        // people pay for was giving it away. What ships now is a fingerprint.
        for (const exercise of lesson.exercises ?? []) {
          if (typeof exercise.expectedAnswer === "string") {
            exercise.answerKey = compileAnswerKey(exercise.expectedAnswer);
            keysCompiled += 1;
          }
          delete exercise.expectedAnswer;
          delete exercise.rubric;
        }
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
}

writeFileSync(join(contentRoot, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
// The manifest is the tracked half of this: it records exactly which package
// hash each course came from, so a fresh clone can reproduce the import and a
// review can be recorded against a version rather than a name.
mkdirSync(join(projectRoot, "src", "content"), { recursive: true });
writeFileSync(
  join(projectRoot, "src", "content", "imported.json"),
  `${JSON.stringify(manifest, null, 1)}\n`,
);

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
    `was ${(inlineBytes / 1048576).toFixed(1)} MB inline).`,
);
