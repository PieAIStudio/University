#!/usr/bin/env node
/**
 * Build one reproducible, package-only delivery release.
 *
 * The importer remains the only course producer. This command only validates
 * its already-produced recovery packages, chooses the evidence boundary,
 * invokes the existing app build, and seals the bytes that came out.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  PROJECT_ROOT,
  isStudiesPath,
  validateDeliveryArtifact,
  validateImportDate,
  validateLexiconInput,
  validateRecoveryInput,
  validateReleaseVersion,
  validateSourceCommit,
  writeReleaseMetadata,
} from "./delivery-artifact.mjs";

const APP_ROOT = resolve(import.meta.dirname, "..");
const DELIVERY_DIST = join(APP_ROOT, "dist", "delivery");
const GENERATED_FILES = [
  join(APP_ROOT, "src", "content", "imported.json"),
  join(APP_ROOT, "src", "content", "lexicon.json"),
];

const VALUE_FLAGS = new Set([
  "version",
  "recovery-root",
  "lexicon",
  "evidence",
  "import-date",
  "artifact-root",
]);

function parseArgs(argv) {
  const args = {};
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  for (let index = 0; index < options.length; index += 1) {
    const flag = options[index];
    if (flag === "--help" || flag === "-h") {
      console.log(
        "Usage: pnpm delivery:build -- --version <version> " +
          "--recovery-root <path> --lexicon <path> --evidence none " +
          "[--import-date YYYY-MM-DD] [--artifact-root <path>]",
      );
      process.exit(0);
    }
    if (!flag.startsWith("--") || !VALUE_FLAGS.has(flag.slice(2))) {
      throw new Error(`unknown option ${flag}`);
    }
    const name = flag.slice(2);
    const value = options[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    args[name] = value;
    index += 1;
  }
  for (const name of ["version", "recovery-root", "lexicon", "evidence"]) {
    if (args[name] === undefined) throw new Error(`missing --${name}`);
  }
  return args;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? "a signal"}`);
  }
}

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensureCleanWorktree() {
  const changed = gitOutput(["status", "--porcelain", "--untracked-files=no"]);
  if (changed) {
    throw new Error(
      "release build requires a clean tracked worktree; commit or revert these files first:\n" +
        changed,
    );
  }
}

function workspacePath(value, label) {
  const resolved = resolve(PROJECT_ROOT, value);
  const rel = relative(PROJECT_ROOT, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} must be inside the workspace for a clean-clone release: ${value}`);
  }
  return { absolute: resolved, relative: rel.split(sep).join("/") };
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const info = lstatSync(path);
  if (info.isSymbolicLink()) throw new Error(`generated file must not be a symlink: ${path}`);
  if (!info.isFile()) throw new Error(`generated file must be a regular file: ${path}`);
  return readFileSync(path);
}

function restore(path, bytes) {
  if (bytes === null) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, bytes);
}

function releaseInputMetadata(recoveryPath, recovery, lexiconPath, lexicon) {
  return {
    recovery: {
      path: recoveryPath.relative,
      sha256: recovery.sha256,
      files: recovery.files,
      bytes: recovery.bytes,
      studies: recovery.studies,
      courses: recovery.courses,
      unreferencedFiles: recovery.unreferencedFiles,
    },
    lexicon: {
      path: lexiconPath.relative,
      sha256: lexicon.sha256,
      bytes: lexicon.bytes,
      senses: lexicon.senses,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = validateReleaseVersion(args.version);
  if (args.evidence !== "none") {
    throw new Error("the clean-clone delivery lane currently supports only --evidence none");
  }

  const recoveryPath = workspacePath(args["recovery-root"], "recovery input");
  const lexiconPath = workspacePath(args.lexicon, "lexicon input");
  if (isStudiesPath(recoveryPath.absolute) || isStudiesPath(lexiconPath.absolute)) {
    throw new Error("apps/local/studies is not a delivery input");
  }
  const recovery = validateRecoveryInput(recoveryPath.absolute);
  const lexicon = validateLexiconInput(lexiconPath.absolute);

  ensureCleanWorktree();
  const sourceCommit = validateSourceCommit(gitOutput(["rev-parse", "--verify", "HEAD"]));
  const importDate = validateImportDate(
    args["import-date"] ?? gitOutput(["show", "-s", "--format=%cs", "HEAD"]),
  );

  const artifactRoot = resolve(PROJECT_ROOT, args["artifact-root"] ?? ".artifacts/delivery");
  if (isStudiesPath(artifactRoot)) throw new Error("artifact root cannot be apps/local/studies");
  if (existsSync(artifactRoot) && lstatSync(artifactRoot).isSymbolicLink()) {
    throw new Error(`artifact root must not be a symlink: ${artifactRoot}`);
  }
  const artifactPath = join(artifactRoot, version);
  if (existsSync(artifactPath)) {
    throw new Error(
      `versioned artifact already exists and will not be overwritten: ${artifactPath}`,
    );
  }

  const generated = new Map(GENERATED_FILES.map((path) => [path, snapshot(path)]));
  const inputMetadata = releaseInputMetadata(recoveryPath, recovery, lexiconPath, lexicon);
  const environment = {
    ...process.env,
    UNIVERSITY_UPSTREAM_RECOVERY: recoveryPath.absolute,
    UNIVERSITY_UPSTREAM_LEXICON: lexiconPath.absolute,
    UNIVERSITY_EVIDENCE_MODE: "none",
    UNIVERSITY_IMPORT_DATE: importDate,
  };
  let artifactCreated = false;
  try {
    run("pnpm", ["content"], environment);
    run("pnpm", ["--filter", "@pieai/university-app...", "build"], environment);
    run(process.execPath, ["scripts/check-authoring-excluded.mjs"], environment);
    run(process.execPath, ["scripts/check-delivery-public-config.mjs"], environment);

    writeReleaseMetadata(DELIVERY_DIST, {
      version,
      sourceCommit,
      importDate,
      inputs: inputMetadata,
      evidence: { mode: "none" },
    });
    const built = validateDeliveryArtifact(DELIVERY_DIST, {
      version,
      recoveryRoot: recoveryPath.absolute,
      lexiconPath: lexiconPath.absolute,
    });

    mkdirSync(artifactRoot, { recursive: true });
    mkdirSync(artifactPath);
    artifactCreated = true;
    cpSync(DELIVERY_DIST, artifactPath, { recursive: true, dereference: true });
    const sealed = validateDeliveryArtifact(artifactPath, {
      version,
      recoveryRoot: recoveryPath.absolute,
      lexiconPath: lexiconPath.absolute,
    });
    console.log(
      `delivery: ${sealed.version} sealed at ${relative(PROJECT_ROOT, artifactPath)}; ` +
        `${sealed.studies} studies, ${sealed.courses} courses, ${sealed.lessons} lessons, ` +
        `${sealed.payloadBytes} payload bytes (${built.files} files including metadata).`,
    );
  } catch (error) {
    if (artifactCreated) rmSync(artifactPath, { recursive: true, force: true });
    throw error;
  } finally {
    for (const [path, bytes] of generated) restore(path, bytes);
  }
}

try {
  main();
} catch (error) {
  console.error(`delivery: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
