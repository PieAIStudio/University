import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadUniversityLocalConfig } from "../.university-authoring-build/server/config/load-config.js";
import {
  executeUniversityLocalCli,
  parseUniversityLocalCli,
} from "../.university-authoring-build/server/cli.js";

const MODULE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(MODULE, "../..");
const MARKER = "primm-unpublished.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const save = (file, data) =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });

export function authoringContext(projectRoot, env = process.env) {
  const root = realpathSync(resolve(projectRoot));
  const effectiveEnv =
    env.UNIVERSITY_COURSE_ROOT || env.UNIVERSITY_LOCAL_STUDIES_ROOT
      ? env
      : { ...env, UNIVERSITY_LOCAL_STUDIES_ROOT: join(root, "studies") };
  const config = loadUniversityLocalConfig({ projectRoot: root, env: effectiveEnv });
  return { projectRoot: root, studiesRoot: config.studiesRoot, env: effectiveEnv };
}

export async function nativeAuthoring(context, argv) {
  const current = authoringContext(context.projectRoot, context.env);
  assert.equal(current.studiesRoot, context.studiesRoot, "Native read/write roots changed");
  return executeUniversityLocalCli({
    projectRoot: context.projectRoot,
    cwd: REPO,
    env: context.env,
    command: parseUniversityLocalCli(argv),
  });
}

/** An isolated native authoring shelf, not a Git branch or another content format.
 * All course bytes are restored by the existing native recovery importer. */
export async function prepareUnpublished({
  projectRoot,
  recoveryRoot,
  studyId,
  courseId,
  env = process.env,
}) {
  const requested = resolve(projectRoot);
  if (existsSync(requested))
    assert.equal(
      readdirSync(requested).length,
      0,
      "The target project already exists with data; never overwrite it",
    );
  else mkdirSync(requested, { recursive: true });
  const context = authoringContext(requested, env);
  assert.notEqual(
    context.projectRoot,
    MODULE,
    "An unpublished draft must not replace the published authoring shelf",
  );
  assert.equal(
    existsSync(context.studiesRoot),
    false,
    "The target studies root already exists; never overwrite an authoring shelf",
  );
  const source = realpathSync(recoveryRoot);
  const index = read(join(source, "index.json"));
  const packages = index.courses.map((entry) => {
    assert.equal(
      basename(entry.file),
      entry.file,
      "Recovery files must stay inside their selected root",
    );
    return { file: entry.file, sha256: sha(readFileSync(join(source, entry.file))) };
  });
  mkdirSync(context.projectRoot, { recursive: true });
  const receipts = [];
  const argv = ["course", "recovery", "import", "--study", studyId, "--input", source];
  receipts.push({
    argv: [...argv, "--dry-run"],
    result: await nativeAuthoring(context, [...argv, "--dry-run"]),
  });
  receipts.push({ argv, result: await nativeAuthoring(context, argv) });
  const open = ["course", "open-for-edit", "--study", studyId, "--course", courseId];
  receipts.push({ argv: open, result: await nativeAuthoring(context, open) });
  const record = {
    schemaVersion: 1,
    purpose: "unpublished-owner-reading",
    createdAt: new Date().toISOString(),
    projectRoot: context.projectRoot,
    studiesRoot: context.studiesRoot,
    studyId,
    courseId,
    sourceRecoveryRoot: source,
    sourceIndexSha256: sha(readFileSync(join(source, "index.json"))),
    packages,
    receipts,
  };
  save(join(context.projectRoot, MARKER), record);
  return record;
}

/** Builds an unpublished projection with the SAME CLI exporter and delivery
 * importer used by the product. It never writes the formal recovery packages. */
export async function prepareUnpublishedPreview({ projectRoot, env = process.env }) {
  const context = authoringContext(projectRoot, env);
  const record = read(join(context.projectRoot, MARKER));
  assert.equal(record.purpose, "unpublished-owner-reading");
  assert.equal(record.studiesRoot, context.studiesRoot);
  assert.equal(record.projectRoot, context.projectRoot);
  const generation = new Date().toISOString().replace(/[:.]/g, "-");
  const previewRoot = join(context.projectRoot, "previews", generation);
  assert.equal(existsSync(previewRoot), false, "Preserve every previous preview generation");
  const { studyId, courseId } = record;
  const receipts = [];
  const active = ["course", "reactivate", "--study", studyId, "--course", courseId];
  receipts.push({ argv: active, result: await nativeAuthoring(context, active) });
  mkdirSync(previewRoot, { recursive: true });
  const recoveryRoot = join(previewRoot, "recovery", studyId);
  const exporting = ["course", "recovery", "export", "--study", studyId, "--out", recoveryRoot];
  receipts.push({ argv: exporting, result: await nativeAuthoring(context, exporting) });
  // A public-source study has no Git repository to bake. Do not invent a
  // checkout merely to preview it; retain the stronger requirement whenever
  // the canonical exporter records a repository source.
  const repositorySource = read(join(recoveryRoot, "index.json")).source;
  const contentRoot = join(previewRoot, "content");
  const manifestPath = join(previewRoot, "imported.json");
  // The lexicon projection is isolated too. It must equal the current common
  // vocabulary; no new draft vocabulary is authorized by this lesson task.
  const lexiconPath = join(REPO, "apps/university/src/content/lexicon.json");
  const lexiconBefore = sha(readFileSync(lexiconPath));
  const output = execFileSync(
    process.execPath,
    [join(REPO, "apps/university/scripts/import-courses.mjs")],
    {
      cwd: REPO,
      encoding: "utf8",
      env: {
        ...env,
        UNIVERSITY_UPSTREAM_RECOVERY: join(previewRoot, "recovery"),
        UNIVERSITY_UPSTREAM_LEXICON: lexiconPath,
        UNIVERSITY_STUDIES_ROOT: context.studiesRoot,
        UNIVERSITY_CONTENT_ROOT: contentRoot,
        UNIVERSITY_IMPORTED_MANIFEST_PATH: manifestPath,
        UNIVERSITY_LEXICON_MANIFEST_PATH: join(previewRoot, "lexicon.json"),
        UNIVERSITY_EVIDENCE_MODE: "auto",
        UNIVERSITY_REQUIRE_BAKED_EVIDENCE: repositorySource ? "1" : "0",
      },
    },
  );
  assert.equal(
    sha(readFileSync(lexiconPath)),
    lexiconBefore,
    "An unpublished preview must not change the shared lexicon",
  );
  assert.equal(
    sha(readFileSync(join(previewRoot, "lexicon.json"))),
    lexiconBefore,
    "The preview must use the same vocabulary",
  );
  writeFileSync(join(previewRoot, "import.log"), output);
  const preview = {
    schemaVersion: 1,
    purpose: record.purpose,
    createdAt: new Date().toISOString(),
    authoringProjectRoot: context.projectRoot,
    studiesRoot: context.studiesRoot,
    studyId,
    courseId,
    contentRoot,
    recoveryRoot,
    manifestPath,
    manifestSha256: sha(readFileSync(manifestPath)),
    receipts,
  };
  save(join(previewRoot, "receipt.json"), preview);
  return preview;
}
