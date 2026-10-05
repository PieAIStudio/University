#!/usr/bin/env node
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { importCourseRecovery } from "../apps/authoring-server/.university-authoring-build/server/recovery/course-recovery.js";
import { createSourceSnapshot } from "./fixtures/catalogue/source-snapshot.mjs";
import {
  E2E_FIXTURE_ROOT,
  E2E_RUN_ROOT,
  E2E_PROJECT_ROOT,
  E2E_STUDIES_ROOT,
  E2E_RECOVERY_ROOT,
  E2E_SOURCE_ROOT,
  E2E_COURSE_ROOT,
} from "./catalogue-paths.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const marker = join(E2E_RUN_ROOT, ".test-catalogue-root");
if (existsSync(E2E_RUN_ROOT)) {
  if (
    lstatSync(E2E_RUN_ROOT).isSymbolicLink() ||
    !existsSync(marker) ||
    readFileSync(marker, "utf8") !== "University E2E disposable catalogue\n"
  )
    throw new Error(`Refusing to replace an unowned catalogue root: ${E2E_RUN_ROOT}`);
  rmSync(E2E_RUN_ROOT, { recursive: true });
}
mkdirSync(E2E_PROJECT_ROOT, { recursive: true });
// Authoring and delivery must see the same vocabulary when this disposable
// course root is selected. The fixture is allowed to use the tracked bundle as
// its frozen vocabulary input; neither mode may silently fall back to a
// different root while the lesson body comes from this run.
mkdirSync(join(E2E_COURSE_ROOT, "vocabulary"), { recursive: true });
copyFileSync(
  join(ROOT, "apps/university/src/content/lexicon.json"),
  join(E2E_COURSE_ROOT, "vocabulary/en.json"),
);
writeFileSync(marker, "University E2E disposable catalogue\n");
writeFileSync(
  join(E2E_PROJECT_ROOT, "university-authoring.config.json"),
  JSON.stringify({ schemaVersion: 1, studiesRoot: "./studies" }),
);
const manifest = JSON.parse(readFileSync(join(E2E_FIXTURE_ROOT, "manifest.json"), "utf8"));
function unpack(file) {
  const entry = manifest.artifacts.find((item) => item.file === file);
  if (!entry) throw new Error(`Unregistered frozen input: ${file}`);
  const bytes = readFileSync(join(E2E_FIXTURE_ROOT, file));
  if (
    bytes.length !== entry.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== entry.sha256
  )
    throw new Error(`Frozen input digest mismatch: ${file}`);
  return JSON.parse(gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }).toString("utf8"));
}
const source = unpack("source.json.gz");
const commit = createSourceSnapshot(E2E_SOURCE_ROOT, source.files);
if (commit !== source.sourceCommit || commit !== manifest.source.fixtureCommit)
  throw new Error("Frozen source is not reproducible");
for (const studyId of new Set(manifest.courses.map((course) => course.studyId))) {
  const frozen = unpack(`${studyId}.json.gz`);
  const root = join(E2E_RECOVERY_ROOT, studyId);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.json"), `${JSON.stringify(frozen.index, null, 2)}\n`);
  for (const item of frozen.packages) {
    if (!/^[a-z0-9-]+\.[a-f0-9]{64}\.recovery\.json$/.test(item.entry.file))
      throw new Error("Invalid fixture recovery filename");
    writeFileSync(join(root, item.entry.file), `${JSON.stringify(item.package, null, 2)}\n`);
  }
  const result = importCourseRecovery({
    studiesRoot: E2E_STUDIES_ROOT,
    studyId,
    inputDirectory: root,
    ...(frozen.index.source ? { sourceRoot: E2E_SOURCE_ROOT } : {}),
  });
  console.log(
    `e2e catalogue: ${studyId}: ${result.courses.length} courses restored through the production recovery importer`,
  );
}
console.log(
  `e2e catalogue: ${manifest.courses.length} frozen courses; isolated authoring storage ${E2E_STUDIES_ROOT}`,
);
