#!/usr/bin/env node
/**
 * The release boundary for a delivery artifact.
 *
 * This module has no build side effects. It validates the two things that a
 * release must be able to answer later: exactly which authoring inputs were
 * consumed, and exactly which bytes were handed to the static host.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { checkShelfData } from "./check-shelf.mjs";

export const RELEASE_SCHEMA_VERSION = 1;
export const RELEASE_ARTIFACT_KIND = "university-delivery";
export const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

const RECOVERY_PACKAGE_KIND = "university-local-course-recovery";
const DIGEST = /^sha256:([a-f0-9]{64})$/i;
const VERSION = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMMIT = /^[a-f0-9]{40}$/i;

/** These keys are authoring transport, never learner DTO, fields. */
export const AUTHOR_ONLY_KEYS = Object.freeze([
  "schemaVersion",
  "packageKind",
  "evidenceMode",
  "droppedUaBindingCount",
  "currency",
  "captureRecipe",
  "dataBase64",
  "snapshotId",
  "nodeIds",
  "path",
  "sha256",
  "bytes",
  "source",
  "sourceRoot",
]);

const AUTHOR_ONLY_KEY_SET = new Set(AUTHOR_ONLY_KEYS);
const ANSWER_KEY_PATTERN = /answer|solution|rubric/i;
const AUTHOR_ONLY_VALUE_PATTERNS = [/^file-manager:/i];

function fail(message) {
  throw new Error(`delivery artifact: ${message}`);
}

function posixPath(path) {
  return path.split(sep).join("/");
}

function digestHex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256(value) {
  return `sha256:${digestHex(value)}`;
}

function rawDigest(value, label) {
  if (typeof value !== "string") fail(`${label} must be a sha256:<64 hex> digest`);
  const match = DIGEST.exec(value);
  if (!match) fail(`${label} must be a sha256:<64 hex> digest`);
  return match[1].toLowerCase();
}

function relativeRecords(records) {
  return records
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((record) => `${record.path}\0${rawDigest(record.sha256, record.path)}\n`)
    .join("");
}

function isInside(path, root) {
  const child = relative(root, path);
  return child === "" || (!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child));
}

function safeRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(`${label} is not a safe relative POSIX path`);
  }
  return value;
}

function safeSegment(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    /[\\/\0]/.test(value)
  ) {
    fail(`${label} is not a safe path segment`);
  }
  return value;
}

function regularFile(path, label) {
  if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  const info = lstatSync(path);
  if (info.isSymbolicLink()) fail(`${label} must not be a symlink: ${path}`);
  if (!info.isFile()) fail(`${label} must be a regular file: ${path}`);
  return info;
}

function directory(path, label) {
  if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  const info = lstatSync(path);
  if (info.isSymbolicLink()) fail(`${label} must not be a symlink: ${path}`);
  if (!info.isDirectory()) fail(`${label} must be a directory: ${path}`);
  return info;
}

/** Enumerate every regular file and reject symlinks before a release can copy them. */
export function listFiles(root) {
  directory(root, "file root");
  const files = [];
  const walk = (at) => {
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) fail(`artifact tree contains a symlink: ${path}`);
      if (info.isDirectory()) {
        walk(path);
        continue;
      }
      if (!info.isFile()) fail(`artifact tree contains a non-file: ${path}`);
      files.push(path);
    }
  };
  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

export function isStudiesPath(path, { projectRoot = PROJECT_ROOT } = {}) {
  const candidate = resolve(path);
  const studiesRoot = resolve(projectRoot, "apps/local/studies");
  if (isInside(candidate, studiesRoot)) return true;
  try {
    return isInside(realpathSync.native(candidate), realpathSync.native(studiesRoot));
  } catch {
    return false;
  }
}

function fileRecords(root) {
  return listFiles(root).map((path) => ({
    path: posixPath(relative(root, path)),
    bytes: regularFile(path, "input file").size,
    sha256: sha256(readFileSync(path)),
  }));
}

export function inputFingerprint(root, { projectRoot = PROJECT_ROOT } = {}) {
  const resolvedRoot = resolve(root);
  if (isStudiesPath(resolvedRoot, { projectRoot })) {
    fail(`apps/local/studies is not a release input: ${resolvedRoot}`);
  }
  const files = fileRecords(resolvedRoot);
  return {
    sha256: `sha256:${digestHex(relativeRecords(files))}`,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    entries: files,
  };
}

function readJson(path, label) {
  regularFile(path, label);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Validate the tracked recovery transport before the importer deletes old output. */
export function validateRecoveryInput(root, { projectRoot = PROJECT_ROOT } = {}) {
  const resolvedRoot = resolve(root);
  directory(resolvedRoot, "recovery root");
  if (isStudiesPath(resolvedRoot, { projectRoot })) {
    fail(`apps/local/studies cannot be used as recovery input: ${resolvedRoot}`);
  }

  const referenced = new Set();
  const studies = [];
  for (const studyId of readdirSync(resolvedRoot).sort()) {
    safeSegment(studyId, "study id");
    const studyDir = join(resolvedRoot, studyId);
    directory(studyDir, `study ${studyId}`);
    const indexPath = join(studyDir, "index.json");
    regularFile(indexPath, `study ${studyId} index`);
    referenced.add(posixPath(relative(resolvedRoot, indexPath)));
    const index = readJson(indexPath, `study ${studyId} index`);

    if (index?.schemaVersion !== 1 || index?.packageKind !== RECOVERY_PACKAGE_KIND) {
      fail(`study ${studyId} index has an unsupported recovery schema`);
    }
    if (index?.study?.id !== studyId) {
      fail(`study ${studyId} index does not identify the same study`);
    }
    if (!Array.isArray(index?.courses) || index.courses.length === 0) {
      fail(`study ${studyId} index has no courses`);
    }

    const courses = [];
    const courseFiles = new Set();
    for (const [indexPosition, entry] of index.courses.entries()) {
      const prefix = `study ${studyId} course ${indexPosition}`;
      const courseId = safeSegment(entry?.courseId, `${prefix} id`);
      const fileName = safeRelativePath(entry?.file, `${prefix} file`);
      const packagePath = resolve(studyDir, fileName);
      if (!isInside(packagePath, studyDir)) fail(`${prefix} escapes the study directory`);
      if (courseFiles.has(fileName)) fail(`${prefix} repeats package file ${fileName}`);
      courseFiles.add(fileName);
      regularFile(packagePath, `${prefix} package`);
      const raw = readFileSync(packagePath);
      const expected = rawDigest(entry?.sha256, `${prefix} hash`);
      const actual = digestHex(raw);
      if (actual !== expected) {
        fail(`${prefix} hash mismatch: index ${expected}, file ${actual}`);
      }
      const pkg = readJson(packagePath, `${prefix} package`);
      if (pkg?.packageKind !== RECOVERY_PACKAGE_KIND || pkg?.course?.id !== courseId) {
        fail(`${prefix} package does not match its index entry`);
      }
      referenced.add(posixPath(relative(resolvedRoot, packagePath)));
      courses.push(courseId);
    }

    studies.push({
      studyId,
      title: index.study.title,
      courses,
    });
  }

  if (studies.length === 0) fail("recovery root contains no study indexes");
  const fingerprint = inputFingerprint(resolvedRoot, { projectRoot });
  const unexpected = fingerprint.entries
    .map((entry) => entry.path)
    .filter((path) => !referenced.has(path));
  const unsupported = unexpected.filter((path) => !path.endsWith(".recovery.json"));
  if (unsupported.length > 0) {
    fail(`recovery root contains unrecognized unreferenced files: ${unsupported.join(", ")}`);
  }
  return {
    ...fingerprint,
    studies: studies.length,
    courses: studies.reduce((sum, study) => sum + study.courses.length, 0),
    unreferencedFiles: unexpected,
  };
}

export function validateLexiconInput(path) {
  const resolvedPath = resolve(path);
  const info = regularFile(resolvedPath, "lexicon input");
  const lexicon = readJson(resolvedPath, "lexicon input");
  if (!Array.isArray(lexicon?.entries)) fail("lexicon input has no entries array");
  return {
    path: resolvedPath,
    bytes: info.size,
    sha256: sha256(readFileSync(resolvedPath)),
    senses: lexicon.entries.length,
  };
}

export function validateReleaseVersion(version) {
  if (typeof version !== "string" || !VERSION.test(version)) {
    fail(`version must match major.minor.patch (received ${JSON.stringify(version)})`);
  }
  return version;
}

export function validateImportDate(date) {
  if (typeof date !== "string" || !DATE.test(date)) {
    fail(`import date must be YYYY-MM-DD (received ${JSON.stringify(date)})`);
  }
  return date;
}

export function validateSourceCommit(commit) {
  if (typeof commit !== "string" || !COMMIT.test(commit)) {
    fail("source commit must be a 40-character Git SHA");
  }
  return commit.toLowerCase();
}

/** Shared recursive public DTO gate used by both tests and release checking. */
export function publicDtoViolations(value, path = "package") {
  const found = [];
  const visit = (current, at) => {
    if (typeof current === "string") {
      for (const pattern of AUTHOR_ONLY_VALUE_PATTERNS) {
        if (pattern.test(current)) found.push(`${at}=${JSON.stringify(current)}`);
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (current === null || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      if (key !== "answerKey" && (ANSWER_KEY_PATTERN.test(key) || AUTHOR_ONLY_KEY_SET.has(key))) {
        found.push(`${at}.${key}`);
      }
      visit(child, `${at}.${key}`);
    }
  };
  visit(value, path);
  return found;
}

function artifactRecords(root) {
  return listFiles(root).map((path) => ({
    path: posixPath(relative(root, path)),
    bytes: regularFile(path, "artifact file").size,
    sha256: sha256(readFileSync(path)),
  }));
}

function payloadDigest(records) {
  return `sha256:${digestHex(relativeRecords(records))}`;
}

function readArtifactJson(root, name) {
  safeRelativePath(name, "artifact metadata path");
  return readJson(join(root, ...name.split("/")), name);
}

function compareNames(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((name) => !actualSet.has(name));
  const extra = actual.filter((name) => !expectedSet.has(name));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${label} differs${missing.length > 0 ? `; missing ${missing.join(", ")}` : ""}` +
        `${extra.length > 0 ? `; extra ${extra.join(", ")}` : ""}`,
    );
  }
}

function validateChecksumFile(root, records) {
  const checksumPath = join(root, "SHA256SUMS");
  const body = readFileSync(checksumPath, "utf8");
  const lines = body.trimEnd().split("\n");
  const entries = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    if (!match) fail(`SHA256SUMS has an invalid line: ${line}`);
    const name = safeRelativePath(match[2], "SHA256SUMS path");
    if (name === "SHA256SUMS" || entries.has(name))
      fail(`SHA256SUMS repeats or includes itself: ${name}`);
    entries.set(name, match[1].toLowerCase());
  }
  const payload = records.filter((record) => record.path !== "SHA256SUMS");
  compareNames(
    [...entries.keys()].sort(),
    payload.map((record) => record.path).sort(),
    "SHA256SUMS",
  );
  for (const record of payload) {
    if (entries.get(record.path) !== rawDigest(record.sha256, record.path)) {
      fail(`SHA256SUMS digest mismatch for ${record.path}`);
    }
  }
}

function contentFiles(root, manifest) {
  const contentRoot = join(root, "content");
  directory(contentRoot, "content directory");
  const expectedStudies = new Set();
  const expectedCourses = new Set();
  for (const study of manifest.studies) {
    const studyId = safeSegment(study.studyId, "manifest study id");
    expectedStudies.add(studyId);
    for (const course of study.courses ?? []) {
      const courseId = safeSegment(course.courseId, "manifest course id");
      expectedCourses.add(`${studyId}/${courseId}.json`);
    }
  }

  const actualStudies = readdirSync(contentRoot)
    .filter(
      (name) =>
        name !== "assets" &&
        name !== "manifest.json" &&
        name !== "shelf.json" &&
        !name.startsWith("."),
    )
    .map((name) => {
      const path = join(contentRoot, name);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) fail(`content entry is a symlink: ${name}`);
      if (!info.isDirectory()) fail(`unexpected file at content root: ${name}`);
      return name;
    })
    .sort();
  compareNames(actualStudies, [...expectedStudies].sort(), "content studies");

  for (const study of manifest.studies) {
    const studyId = study.studyId;
    const studyDir = join(contentRoot, studyId);
    const actualCourses = readdirSync(studyDir)
      .map((name) => {
        const path = join(studyDir, name);
        const info = lstatSync(path);
        if (info.isSymbolicLink()) fail(`content course is a symlink: content/${studyId}/${name}`);
        if (!info.isFile()) fail(`unexpected nested content entry: content/${studyId}/${name}`);
        return `${studyId}/${name}`;
      })
      .sort();
    const expectedForStudy = [...expectedCourses]
      .filter((name) => name.startsWith(`${studyId}/`))
      .sort();
    compareNames(actualCourses, expectedForStudy, `content courses for ${studyId}`);
  }

  const packages = [];
  for (const course of expectedCourses) {
    const path = join(contentRoot, ...course.split("/"));
    const info = regularFile(path, `course package ${course}`);
    const body = readFileSync(path);
    const pkg = readJson(path, `course package ${course}`);
    if (pkg?.course?.id !== course.slice(course.indexOf("/") + 1, -5)) {
      fail(`course package ${course} has the wrong course id`);
    }
    const manifestCourse = manifest.studies
      .find((study) => study.studyId === course.slice(0, course.indexOf("/")))
      ?.courses?.find(
        (candidate) => `${candidate.courseId}.json` === course.slice(course.indexOf("/") + 1),
      );
    if (!manifestCourse) fail(`course package ${course} is not in the manifest`);
    if (manifestCourse.servedBytes !== info.size || body.length !== info.size) {
      fail(
        `servedBytes mismatch for ${course}: manifest ${manifestCourse.servedBytes}, file ${info.size}`,
      );
    }
    const violations = publicDtoViolations(pkg, course);
    if (violations.length > 0) {
      fail(`public DTO violation in ${course}: ${violations.slice(0, 12).join(", ")}`);
    }
    packages.push({ path: course, bytes: info.size });
  }
  return packages;
}

function validateReleaseInputs(release) {
  if (release?.schemaVersion !== RELEASE_SCHEMA_VERSION) fail("unsupported release schema");
  if (release?.artifact !== RELEASE_ARTIFACT_KIND) fail("wrong artifact kind");
  validateReleaseVersion(release.version);
  validateSourceCommit(release.sourceCommit);
  validateImportDate(release.importDate);
  if (release?.evidence?.mode !== "none") fail("release evidence mode must be none");
  const recovery = release?.inputs?.recovery;
  const lexicon = release?.inputs?.lexicon;
  if (!recovery || !lexicon) fail("release is missing recovery or lexicon input metadata");
  rawDigest(recovery.sha256, "release recovery input hash");
  rawDigest(lexicon.sha256, "release lexicon input hash");
  if (!Number.isInteger(recovery.files) || recovery.files <= 0)
    fail("release recovery file count is invalid");
  if (!Number.isInteger(recovery.studies) || recovery.studies <= 0)
    fail("release recovery study count is invalid");
  if (!Number.isInteger(recovery.courses) || recovery.courses <= 0)
    fail("release recovery course count is invalid");
  if (!Number.isInteger(lexicon.bytes) || lexicon.bytes <= 0)
    fail("release lexicon byte count is invalid");
  if (!Number.isInteger(lexicon.senses) || lexicon.senses <= 0)
    fail("release lexicon sense count is invalid");
}

function compareInputMetadata(expected, actual, label) {
  if (
    rawDigest(expected.sha256, `${label} recorded hash`) !==
    rawDigest(actual.sha256, `${label} actual hash`)
  ) {
    fail(`${label} hash changed after build`);
  }
  for (const key of ["files", "bytes", "studies", "courses", "senses"]) {
    if (expected[key] !== undefined && expected[key] !== actual[key]) {
      fail(`${label} ${key} changed after build`);
    }
  }
}

export function validateDeliveryArtifact(
  root,
  { version, recoveryRoot, lexiconPath, projectRoot = PROJECT_ROOT } = {},
) {
  const resolvedRoot = resolve(root);
  directory(resolvedRoot, "delivery artifact");
  if (isStudiesPath(resolvedRoot, { projectRoot })) {
    fail(`delivery artifact cannot be apps/local/studies: ${resolvedRoot}`);
  }
  const records = artifactRecords(resolvedRoot);
  const names = records.map((record) => record.path);
  if (!names.includes("release.json")) fail("release.json is missing");
  if (!names.includes("SHA256SUMS")) fail("SHA256SUMS is missing");
  for (const name of names) {
    if (
      name === "apps/local/studies" ||
      name.startsWith("apps/local/studies/") ||
      name.split("/").includes("..") ||
      name.split("/").includes(".git") ||
      name.split("/").includes("node_modules")
    ) {
      fail(`forbidden path in delivery artifact: ${name}`);
    }
  }

  const release = readArtifactJson(resolvedRoot, "release.json");
  validateReleaseInputs(release);
  if (version !== undefined && release.version !== validateReleaseVersion(version)) {
    fail(`artifact version ${release.version} does not match requested ${version}`);
  }

  const payload = records.filter(
    (record) => record.path !== "release.json" && record.path !== "SHA256SUMS",
  );
  const declaredFiles = Array.isArray(release.files) ? release.files : [];
  if (declaredFiles.length === 0) fail("release has no payload file list");
  const declaredNames = declaredFiles.map((file) =>
    safeRelativePath(file?.path, "release file path"),
  );
  compareNames(
    declaredNames.slice().sort(),
    payload.map((record) => record.path).sort(),
    "release payload",
  );
  for (const declared of declaredFiles) {
    const actual = payload.find((record) => record.path === declared.path);
    if (!actual) continue;
    if (
      declared.bytes !== actual.bytes ||
      rawDigest(declared.sha256, declared.path) !== rawDigest(actual.sha256, declared.path)
    ) {
      fail(`release file record mismatch for ${declared.path}`);
    }
  }
  if (
    release.payload?.fileCount !== payload.length ||
    release.payload.bytes !== payload.reduce((sum, file) => sum + file.bytes, 0)
  ) {
    fail("release payload totals do not match the artifact");
  }
  if (
    rawDigest(release.payload?.sha256, "release payload hash") !==
    rawDigest(payloadDigest(payload), "calculated payload hash")
  ) {
    fail("release payload hash does not match the artifact");
  }
  validateChecksumFile(resolvedRoot, records);

  const manifest = readArtifactJson(resolvedRoot, "content/manifest.json");
  const shelf = readArtifactJson(resolvedRoot, "content/shelf.json");
  if (!Array.isArray(manifest?.studies) || manifest.studies.length === 0)
    fail("content manifest has no studies");
  const shelfStats = checkShelfData(manifest, shelf);
  if (shelfStats.courses === 0 || shelfStats.lessons === 0)
    fail("content shelf has no courses or lessons");
  const packages = contentFiles(resolvedRoot, manifest);
  if (
    release.content?.studies !== shelfStats.studies ||
    release.content.courses !== shelfStats.courses ||
    release.content.lessons !== shelfStats.lessons
  ) {
    fail("release content totals do not match the artifact");
  }
  if (release.content?.courseBytes !== packages.reduce((sum, pkg) => sum + pkg.bytes, 0)) {
    fail("release content byte total does not match the artifact");
  }

  if (recoveryRoot) {
    const actual = validateRecoveryInput(recoveryRoot, { projectRoot });
    compareInputMetadata(release.inputs.recovery, actual, "recovery input");
  }
  if (lexiconPath) {
    const actual = validateLexiconInput(lexiconPath);
    compareInputMetadata(release.inputs.lexicon, actual, "lexicon input");
  }

  return {
    version: release.version,
    sourceCommit: release.sourceCommit,
    studies: shelfStats.studies,
    courses: shelfStats.courses,
    lessons: shelfStats.lessons,
    files: records.length,
    bytes: records.reduce((sum, record) => sum + record.bytes, 0),
    payloadBytes: payload.reduce((sum, record) => sum + record.bytes, 0),
  };
}

export function writeReleaseMetadata(root, release) {
  const resolvedRoot = resolve(root);
  directory(resolvedRoot, "delivery dist");
  if (
    existsSync(join(resolvedRoot, "release.json")) ||
    existsSync(join(resolvedRoot, "SHA256SUMS"))
  ) {
    fail("delivery dist already contains release metadata");
  }
  const payload = artifactRecords(resolvedRoot);
  const manifest = readArtifactJson(resolvedRoot, "content/manifest.json");
  const shelf = readArtifactJson(resolvedRoot, "content/shelf.json");
  const shelfStats = checkShelfData(manifest, shelf);
  const courseBytes = (manifest.studies ?? [])
    .flatMap((study) => study.courses ?? [])
    .reduce((sum, course) => sum + course.servedBytes, 0);
  const metadata = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    artifact: RELEASE_ARTIFACT_KIND,
    ...release,
    content: {
      studies: shelfStats.studies,
      courses: shelfStats.courses,
      lessons: shelfStats.lessons,
      courseBytes,
    },
    payload: {
      fileCount: payload.length,
      bytes: payload.reduce((sum, file) => sum + file.bytes, 0),
      sha256: payloadDigest(payload),
    },
    files: payload,
  };
  writeFileSync(join(resolvedRoot, "release.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  const records = artifactRecords(resolvedRoot).filter((record) => record.path !== "SHA256SUMS");
  writeFileSync(
    join(resolvedRoot, "SHA256SUMS"),
    `${records.map((record) => `${rawDigest(record.sha256, record.path)}  ${record.path}`).join("\n")}\n`,
  );
  return metadata;
}
