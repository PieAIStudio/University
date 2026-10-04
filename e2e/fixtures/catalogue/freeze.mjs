#!/usr/bin/env node
/** Explicit maintainer operation; never called by tests or a delivery build. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createSourceSnapshot } from "./source-snapshot.mjs";
import { contentPaths } from "../../../scripts/content-root.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const OUTPUT = import.meta.dirname;
const CONTENT = contentPaths({ projectRoot: ROOT });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const selection = {
  "ai-literacy": ["understanding-ai", "ai-for-real-life"],
  "browser-ai": [
    "run-a-real-project-with-ai",
    "make-the-cutout-app-yours",
    "search-your-own-photos",
  ],
};
if (!process.argv.includes("--capture-current"))
  throw new Error("Freeze is explicit: node e2e/fixtures/catalogue/freeze.mjs --capture-current");
const studies = Object.entries(selection).map(([id, courseIds]) => {
  const root = join(CONTENT.recovery, id);
  const index = readJson(join(root, "index.json"));
  const courses = courseIds.map((courseId) => {
    const entry = index.courses.find((item) => item.courseId === courseId);
    if (!entry) throw new Error(`Missing source course: ${id}/${courseId}`);
    const bytes = readFileSync(join(root, entry.file));
    if (`sha256:${sha(bytes)}` !== entry.sha256)
      throw new Error(`Source digest mismatch: ${courseId}`);
    return { entry, originalSha256: entry.sha256, package: JSON.parse(bytes) };
  });
  return { id, index, courses };
});
const references = new Map();
function collect(value) {
  if (!value || typeof value !== "object") return;
  const commit = value.sourceCommit ?? value.commit;
  const path = value.sourcePath ?? value.path;
  if (typeof commit === "string" && /^[a-f0-9]{40}$/.test(commit) && typeof path === "string") {
    if (references.has(path) && references.get(path) !== commit)
      throw new Error(`Two source revisions need separate fixtures: ${path}`);
    references.set(path, commit);
  }
  for (const child of Object.values(value)) collect(child);
}
for (const study of studies) for (const course of study.courses) collect(course.package);
const originalCommits = [...new Set(references.values())];
if (originalCommits.length !== 1)
  throw new Error("This fixture expects one repository source revision");
references.set("LICENSE", originalCommits[0]);
const gitDir = join(CONTENT.studies, "browser-ai/source/repository.git");
const files = Object.fromEntries(
  [...references]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, commit]) => [
      path,
      execFileSync("git", ["--git-dir", gitDir, "show", `${commit}:${path}`], {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
      }),
    ]),
);
const temporary = mkdtempSync(join(tmpdir(), "university-test-source-"));
let sourceCommit;
try {
  sourceCommit = createSourceSnapshot(temporary, files);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
function rewrite(value) {
  if (typeof value === "string") {
    for (const old of originalCommits) {
      if (value === old) return sourceCommit;
      if (value === `git-${old.slice(0, 12)}`) return `git-${sourceCommit.slice(0, 12)}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
  return value;
}
const artifacts = [];
function save(name, value) {
  const bytes = gzipSync(Buffer.from(`${JSON.stringify(value)}\n`), { level: 9 });
  writeFileSync(join(OUTPUT, name), bytes);
  artifacts.push({ file: name, bytes: bytes.length, sha256: sha(bytes) });
}
save("source.json.gz", { originalCommits, sourceCommit, files });
const provenance = [];
for (const study of studies) {
  const packages = study.courses.map((course) => {
    const pkg = rewrite(course.package);
    pkg.course.description += " [UNIVERSITY_E2E_FROZEN_CATALOGUE]";
    const bytes = Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`);
    const digest = sha(bytes);
    provenance.push({
      studyId: study.id,
      courseId: pkg.course.id,
      originalSha256: course.originalSha256,
      fixtureSha256: `sha256:${digest}`,
      lessons: pkg.course.units.reduce((n, unit) => n + unit.lessons.length, 0),
    });
    return {
      entry: {
        ...course.entry,
        file: `${pkg.course.id}.${digest}.recovery.json`,
        sha256: `sha256:${digest}`,
      },
      package: pkg,
    };
  });
  save(`${study.id}.json.gz`, {
    index: { ...study.index, courses: packages.map((item) => item.entry) },
    packages,
  });
}
writeFileSync(
  join(OUTPUT, "manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, frozenAt: "2026-10-02", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(), artifacts, courses: provenance, source: { originalCommits, fixtureCommit: sourceCommit, files: Object.keys(files).length, bytes: Buffer.byteLength(JSON.stringify(files)) } }, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      courses: provenance.length,
      lessons: provenance.reduce((n, item) => n + item.lessons, 0),
      compressedBytes: artifacts.reduce((n, item) => n + item.bytes, 0),
      sourceFiles: Object.keys(files).length,
    },
    null,
    2,
  ),
);
