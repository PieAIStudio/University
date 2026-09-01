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
 * and still exits 0 in the normal authoring/dev lane — being unable to see a
 * sibling repository is a normal state there. The delivery lane can turn that
 * into a fail-closed requirement so a release never silently becomes
 * locator-only.
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
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
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

import {
  bakeLessonEvidence,
  commitDate,
  hasAnyStudyRepository,
  studyRepository,
} from "./bake-evidence.mjs";
import { validateRecoveryInput } from "./delivery-artifact.mjs";
import { requireContentRevision, toPublicPackage } from "./public-course.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const configuredContentRoot = resolve(
  projectRoot,
  process.env["UNIVERSITY_CONTENT_ROOT"] ?? "content",
);
// Worktrees keep this generated directory as a symlink to the main checkout's
// shared content cache: that is the one solution for both Vite and this
// importer. Do not materialise a second `cp -R` entity copy here; it makes
// content look local while silently drifting from the source checkout. Clear
// the resolved target, never the link itself, so an import cannot turn the
// next run into a broken checkout. Release builds normally use a real folder.
const contentRoot =
  existsSync(configuredContentRoot) && lstatSync(configuredContentRoot).isSymbolicLink()
    ? realpathSync(configuredContentRoot)
    : configuredContentRoot;
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
  if (process.env["UNIVERSITY_UPSTREAM_RECOVERY"] !== undefined) {
    throw new Error(`import-courses: explicit recovery input is missing at ${upstream}`);
  }
  console.log(`import-courses: no upstream configured at ${upstream}, nothing to import.`);
  process.exit(0);
}

const recoveryInput = validateRecoveryInput(upstream, {
  projectRoot: resolve(projectRoot, "../.."),
});

const onlyStudy = (() => {
  const at = process.argv.indexOf("--study");
  return at === -1 ? null : process.argv[at + 1];
})();

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

const evidenceMode = process.env["UNIVERSITY_EVIDENCE_MODE"] ?? "auto";
if (evidenceMode !== "auto" && evidenceMode !== "none") {
  throw new Error(
    `import-courses: UNIVERSITY_EVIDENCE_MODE must be auto or none, got ${evidenceMode}`,
  );
}
const requestedImportDate = process.env["UNIVERSITY_IMPORT_DATE"];
if (requestedImportDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(requestedImportDate)) {
  throw new Error(
    `import-courses: UNIVERSITY_IMPORT_DATE must be YYYY-MM-DD, got ${requestedImportDate}`,
  );
}

const requireBakedEvidence = process.env["UNIVERSITY_REQUIRE_BAKED_EVIDENCE"] === "1";
if (requireBakedEvidence && evidenceMode !== "auto") {
  throw new Error(
    `import-courses: baked evidence requirement needs UNIVERSITY_EVIDENCE_MODE=auto, got ${evidenceMode}`,
  );
}

const studiesRoot =
  evidenceMode === "none"
    ? null
    : resolve(projectRoot, process.env["UNIVERSITY_STUDIES_ROOT"] ?? "../local/studies");
if (requireBakedEvidence && !hasAnyStudyRepository(studiesRoot)) {
  throw new Error(
    `import-courses: baked evidence requested but no readable study repository was found at ${studiesRoot}; refusing locator-only output`,
  );
}

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
const manifest = {
  importedAt: requestedImportDate ?? new Date().toISOString().slice(0, 10),
  // Which boundary produced these numbers. The shrink guard below compares
  // like with like, and cannot without this.
  evidenceMode,
  studies: [],
};
const shelf = { studies: [] };
let assetCount = 0;
let assetBytes = 0;
let inlineBytes = 0;
let snippetBaked = 0;
let snippetSkipped = 0;
let snippetDisabled = 0;
let snippetBytes = 0;
let snippetFiles = 0;
let snippetEvidence = 0;
let snippetRepoEvidence = 0;
let pinnedDated = 0;
const pinnedUnresolved = new Map();

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
    const deliveryUnits = [];

    // Assets leave the JSON here. Each becomes its own file named by its hash,
    // so two lessons quoting the same screenshot store it once and a browser
    // can cache it forever.
    for (const unit of course.units) {
      const deliveryLessons = [];
      for (const lesson of unit.lessons) {
        // A delivery package is frozen, but its lesson revision is not always
        // one: it identifies the source version whose read confirmation is
        // still valid. Missing it must stop the import rather than resurrect
        // the old default and silently preserve stale learner progress.
        const contentRevision = requireContentRevision(
          lesson.contentRevision,
          `Recovery lesson ${studyId}/${course.id}/${unit.id}/${lesson.id}`,
        );
        const deliveryExercises = [];
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
          let answerKey;
          if (typeof exercise.expectedAnswer === "string") {
            const key = compileAnswerKey(exercise.expectedAnswer);
            answerKey = key;
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
          deliveryExercises.push({
            ...exercise,
            evidence: (exercise.evidence ?? []).map((item) => ({ ...item })),
            ...(answerKey ? { answerKey } : {}),
          });
        }
        const deliveryEvidence = (lesson.evidence ?? []).map((item) => ({ ...item }));
        const deliveryCards = (lesson.cards ?? []).map((card) => ({
          ...card,
          evidence: (card.evidence ?? []).map((item) => ({ ...item })),
        }));
        const evidence = [
          ...deliveryEvidence,
          ...deliveryCards.flatMap((card) => card.evidence ?? []),
          ...deliveryExercises.flatMap((exercise) => exercise.evidence ?? []),
        ];
        snippetEvidence += evidence.length;
        snippetRepoEvidence += evidence.filter(
          (item) => typeof item.sourcePath === "string",
        ).length;
        if (evidenceMode === "none") {
          snippetDisabled += evidence.length;
        } else {
          const baked = bakeLessonEvidence({
            studiesRoot,
            studyId,
            courseId: course.id,
            evidence,
            contentRoot,
            sha,
          });
          snippetBaked += baked.baked;
          snippetSkipped += baked.skipped;
          snippetBytes += baked.bytes;
          snippetFiles += baked.files;
        }

        const deliveryAssets = (lesson.assets ?? []).map((asset) => {
          if (!asset.dataBase64) {
            throw new Error(
              `Recovery asset ${asset.metadata?.id ?? "unknown"} is missing dataBase64`,
            );
          }
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
        /*
          The header says which version this lesson is pinned to. Until now it
          could only say it in hex, because nothing ever supplied a date — the
          component has had a dated branch since it was written and that branch
          has never once run in production. A reader who has never opened a
          terminal cannot do anything with forty hex characters, so the date is
          the claim and the hash is the receipt behind it.

          Resolving the date also asks the mirror whether the commit is there at
          all, which is the only question that matters for a pin. Under
          `--evidence baked` an unresolvable commit fails the build below.
        */
        const pinnedDate = commitDate(studyRepository(studiesRoot, studyId), lesson.sourceCommit);
        if (pinnedDate) pinnedDated += 1;
        else if (lesson.sourceCommit) {
          const seen = pinnedUnresolved.get(lesson.sourceCommit) ?? 0;
          pinnedUnresolved.set(lesson.sourceCommit, seen + 1);
        }
        deliveryLessons.push({
          ...lesson,
          contentRevision,
          ...(pinnedDate ? { sourceCommitDate: pinnedDate } : {}),
          evidence: deliveryEvidence,
          assets: deliveryAssets,
          cards: deliveryCards,
          exercises: deliveryExercises,
        });
      }
      deliveryUnits.push({ ...unit, lessons: deliveryLessons });
    }

    const publicPackage = toPublicPackage({ course: { ...course, units: deliveryUnits } });
    const body = Buffer.from(`${JSON.stringify(publicPackage)}\n`, "utf8");
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
          contentRevision: lesson.contentRevision,
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
/*
 * Refuse to silently downgrade the tracked manifest.
 *
 * Running with no `studies/` checkout is a supported state — a fresh clone has
 * none, bakes no evidence, and must still exit 0. What is not supported is
 * that same run *overwriting* a manifest that was built with a checkout: every
 * course's `servedBytes` shrinks by the evidence that could not be read, while
 * `sha256` and `packageBytes` stay put, so nothing downstream notices and
 * `pnpm verify` stays green. That has now happened three times, each time in a
 * git worktree, because `apps/local/studies/*` is gitignored and a worktree
 * therefore starts without it.
 *
 * So the rule is about the write, not about the checkout: a run may produce a
 * smaller manifest, but it may not replace a larger tracked one by accident.
 * `--allow-shrink` is the deliberate escape hatch for a real content removal.
 */
const trackedManifestPath = resolve(
  projectRoot,
  process.env["UNIVERSITY_IMPORTED_MANIFEST_PATH"] ?? "src/content/imported.json",
);
/*
 * ...and only against a manifest built at the same evidence boundary.
 *
 * The delivery lane builds with `--evidence baked`: cited source ranges belong
 * in the sealed static release. Authoring/dev may still use `none`, so a
 * manifest comparison only makes sense when both runs used the same boundary;
 * comparing different modes would turn a legitimate mode change into a false
 * shrink alarm.
 */
const trackedMode = existsSync(trackedManifestPath)
  ? (() => {
      try {
        return JSON.parse(readFileSync(trackedManifestPath, "utf8")).evidenceMode ?? null;
      } catch {
        return null;
      }
    })()
  : null;
const comparable = trackedMode === null || trackedMode === evidenceMode;
if (!process.argv.includes("--allow-shrink") && comparable && existsSync(trackedManifestPath)) {
  const servedOf = (doc) =>
    (doc.studies ?? []).reduce(
      (sum, study) =>
        sum + (study.courses ?? []).reduce((n, course) => n + (course.servedBytes ?? 0), 0),
      0,
    );
  let trackedServed = 0;
  try {
    trackedServed = servedOf(JSON.parse(readFileSync(trackedManifestPath, "utf8")));
  } catch {
    trackedServed = 0;
  }
  const freshServed = servedOf(manifest);
  if (trackedServed > freshServed) {
    const lost = trackedServed - freshServed;
    throw new Error(
      `import-courses: refusing to shrink the tracked manifest by ${(lost / 1024).toFixed(0)} KB ` +
        `(${trackedServed} -> ${freshServed} servedBytes).\n` +
        `  Evidence could not be read, most likely because this checkout has no studies at\n` +
        `  ${studiesRoot}\n` +
        `  In a git worktree that is expected: apps/local/studies/* is gitignored. Either run\n` +
        `  this from the main checkout, or symlink the studies you need, or pass --allow-shrink\n` +
        `  if the content really did get smaller.`,
    );
  }
}
writeFileSync(trackedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

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
  if (process.env["UNIVERSITY_UPSTREAM_LEXICON"] !== undefined) {
    throw new Error(`import-courses: explicit lexicon input is missing at ${lexiconSource}`);
  }
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

if (evidenceMode === "none") {
  console.log(
    `import-courses: evidence mode none; ${snippetDisabled} cited ranges intentionally not baked.`,
  );
} else if (snippetBaked === 0) {
  console.log(
    hasAnyStudyRepository(studiesRoot)
      ? `import-courses: baked 0 evidence snippets (${snippetSkipped} cited ranges unreadable).`
      : `import-courses: baked 0 evidence snippets (no checkout at ${studiesRoot}).`,
  );
} else {
  console.log(
    `import-courses: dated ${pinnedDated} pinned lesson(s)` +
      (pinnedUnresolved.size > 0 ? `; ${pinnedUnresolved.size} commit(s) unresolved` : "") +
      `.`,
  );
  console.log(
    `import-courses: baked ${snippetBaked}/${snippetRepoEvidence} repository evidence snippets ` +
      `into ${snippetFiles} files (${(snippetBytes / 1048576).toFixed(2)} MB` +
      (snippetSkipped > 0 ? `; ${snippetSkipped} skipped` : "") +
      `).`,
  );
}

/*
  A pin nobody can resolve is not a pin. These commits are cited by lessons and
  absent from the mirror the citations are read from, so every claim resting on
  them is unverifiable — including the one the header makes out loud.

  Read what this proves narrowly: it resolves against the study's own mirror at
  studies/<id>/source/repository.git, which is not the repository a learner can
  open. On 2026-09-01 the most-cited pin resolved here to 2026-07-22 and came
  back 422 from the public repo, so a green run here does not mean a reader
  could look the hash up. That gap is ledger finding 7eb9e5c567f6 and it is
  still open; closing it needs the published history to carry these commits, not
  a stricter check on this side.
*/
if (requireBakedEvidence && pinnedUnresolved.size > 0) {
  const named = [...pinnedUnresolved.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sha, lessons]) => `    ${sha} — ${lessons} lesson(s)`)
    .join("\n");
  throw new Error(
    `import-courses: ${pinnedUnresolved.size} pinned commit(s) do not resolve in the study mirrors, ` +
      `so the version those lessons name cannot be confirmed:\n${named}`,
  );
}

if (requireBakedEvidence && snippetBaked !== snippetRepoEvidence) {
  throw new Error(
    `import-courses: baked evidence requested but baked ${snippetBaked}/${snippetRepoEvidence} repository evidence snippets from ${snippetEvidence} total evidence records; refusing locator-only output`,
  );
}

if (recoveryInput.courses !== totalCourses) {
  throw new Error(
    `import-courses: recovery input changed while importing (${recoveryInput.courses} != ${totalCourses} courses)`,
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
