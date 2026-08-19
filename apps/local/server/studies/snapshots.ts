import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";

import {
  SnapshotManifestSchema,
  type SnapshotManifest,
} from "@pieai/university-core/domain/schemas.js";
import { inspectImportPathRisk, type ImportGateFinding } from "../airlock/import-gate.js";
import { assertSafeGitArgument, gitBuffer, gitText } from "../git/run.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { getSnapshotPaths, getStudyPaths } from "./paths.js";
import { readSourceRegistration } from "./repository.js";

const SNAPSHOT_TOOL_VERSION = "2.0.0";
const GIT_LFS_POINTER_HEADER = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\n/;

interface RepositoryRefresh {
  readonly repository: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
}

interface TreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly objectId: string;
  readonly size: number | null;
  readonly path: string;
}

function safePathForError(path: string): string {
  return [...path]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? `\\u${code.toString(16).padStart(4, "0")}` : character;
    })
    .join("");
}

function describeSnapshotImportRefusal(findings: readonly ImportGateFinding[]): string {
  const shown = findings.slice(0, 10);
  const lines = shown.map(
    (finding) => `  - ${safePathForError(finding.path)} —— ${finding.reason}`,
  );
  if (findings.length > shown.length) {
    lines.push(`  - …还有 ${findings.length - shown.length} 个`);
  }
  return [
    "这次 clean snapshot 被拒绝：目标提交的 Git tracked tree 包含不应进入学习的路径。",
    "安全检查只读取 Git 路径名，不会读取或输出这些文件的具体内容。",
    ...lines,
    "",
    "这些路径已经被 Git 跟踪，`.gitignore` 对它们无效。请先把它们从跟踪中移除",
    "（`git rm --cached <路径>` 并提交），再重新创建 snapshot。",
  ].join("\n");
}

function readManifest(path: string): SnapshotManifest {
  return SnapshotManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

function parseTree(output: Buffer): readonly TreeEntry[] {
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      if (tab < 0) throw new Error("Git returned an invalid tree entry");
      const header = record.slice(0, tab).match(/^(\d+) (blob|tree|commit) ([a-f0-9]+)\s+(-|\d+)$/);
      const path = record.slice(tab + 1);
      if (!header || !path) {
        throw new Error("Git returned an incomplete tree entry");
      }
      const [, mode, type, objectId, rawSize] = header;
      return { mode, type, objectId, size: rawSize === "-" ? null : Number(rawSize), path };
    });
}

function listTree(repository: string, sourceCommit: string): readonly TreeEntry[] {
  return parseTree(gitBuffer(["--git-dir", repository, "ls-tree", "-r", "-l", "-z", sourceCommit]));
}

function listSourceTree(sourceRoot: string, sourceCommit: string): readonly TreeEntry[] {
  return parseTree(gitBuffer(["ls-tree", "-r", "-l", "-z", sourceCommit], sourceRoot));
}

function readBlob(repository: string, objectId: string): Buffer {
  return gitBuffer(["--git-dir", repository, "cat-file", "blob", objectId]);
}

function isExternalSymlink(path: string, target: string): boolean {
  if (target.startsWith("/")) return true;
  const resolvedTarget = posix.normalize(posix.join(posix.dirname(path), target));
  return resolvedTarget === ".." || resolvedTarget.startsWith("../");
}

function inspectUnsupportedEntries(
  repository: string,
  sourceCommit: string,
): {
  readonly excludedPaths: readonly string[];
  readonly submodulePaths: readonly string[];
  readonly lfsPaths: readonly string[];
} {
  const excludedPaths: string[] = [];
  const submodulePaths: string[] = [];
  const lfsPaths: string[] = [];

  for (const entry of listTree(repository, sourceCommit)) {
    if (entry.mode === "160000" || entry.type === "commit") {
      submodulePaths.push(entry.path);
      continue;
    }
    if (entry.mode === "120000") {
      const target = readBlob(repository, entry.objectId).toString("utf8");
      if (isExternalSymlink(entry.path, target)) {
        if (entry.path.includes("\n") || entry.path.includes("\r")) {
          throw new Error(`External symlink path cannot be represented safely: ${entry.path}`);
        }
        excludedPaths.push(entry.path);
      }
      continue;
    }
    if ((entry.mode === "100644" || entry.mode === "100755") && entry.type === "blob") {
      if (entry.size !== null && entry.size <= 1024) {
        const content = readBlob(repository, entry.objectId).toString("utf8");
        if (GIT_LFS_POINTER_HEADER.test(content)) lfsPaths.push(entry.path);
      }
    }
  }

  return {
    excludedPaths: excludedPaths.sort(),
    submodulePaths: submodulePaths.sort(),
    lfsPaths: lfsPaths.sort(),
  };
}

/** Opens UniversityLocal's object repository without contacting the source repository. */
export function openStudyRepository(studiesRoot: string, studyId: string): string {
  const repository = getStudyPaths(studiesRoot, studyId).source.repository;
  if (!existsSync(repository)) {
    throw new Error(`Study repository has not been initialized: ${studyId}`);
  }
  if (gitText(["--git-dir", repository, "rev-parse", "--is-bare-repository"]) !== "true") {
    throw new Error(`Study repository is not bare: ${repository}`);
  }
  return repository;
}

/**
 * Resolves a ref in the registered source, then fetches only that immutable commit.
 * It deliberately creates no mirror and never fetches all branches or tags.
 */
export function refreshStudyRepository(
  studiesRoot: string,
  studyId: string,
  reference: string,
): RepositoryRefresh {
  assertSafeGitArgument(reference, "source reference");
  const registration = readSourceRegistration(studiesRoot, studyId);
  const sourceCommit = gitText(
    ["rev-parse", "--verify", `${reference}^{commit}`],
    registration.sourceRoot,
  );
  const sourceTree = gitText(
    ["rev-parse", "--verify", `${sourceCommit}^{tree}`],
    registration.sourceRoot,
  );
  const repository = getStudyPaths(studiesRoot, studyId).source.repository;

  if (!existsSync(repository)) {
    mkdirSync(dirname(repository), { recursive: true, mode: 0o700 });
    gitText(["init", "--bare", "--quiet", repository]);
  }
  openStudyRepository(studiesRoot, studyId);

  let fetched = false;
  try {
    gitText(["--git-dir", repository, "cat-file", "-e", `${sourceCommit}^{commit}`]);
  } catch {
    gitText([
      "--git-dir",
      repository,
      "fetch",
      "--no-tags",
      "--force",
      "--depth=1",
      registration.sourceRoot,
      sourceCommit,
    ]);
    fetched = true;
  }

  const fetchedCommit = gitText([
    "--git-dir",
    repository,
    "rev-parse",
    "--verify",
    `${sourceCommit}^{commit}`,
  ]);
  const fetchedTree = gitText([
    "--git-dir",
    repository,
    "rev-parse",
    "--verify",
    `${fetchedCommit}^{tree}`,
  ]);
  if (fetchedCommit !== sourceCommit || fetchedTree !== sourceTree) {
    throw new Error("Fetched Git object does not match the requested source commit");
  }

  // Keep the exact commit reachable without importing the source repository's refs.
  gitText([
    "--git-dir",
    repository,
    "update-ref",
    `refs/university-local/commits/${sourceCommit}`,
    sourceCommit,
  ]);
  if (fetched) {
    // Separate shallow fetches can duplicate large blobs across pack files. Repacking keeps the
    // object store compact while preserving each requested commit as an independent shallow root.
    gitText(["--git-dir", repository, "repack", "-ad"]);
  }
  return { repository, sourceCommit, sourceTree };
}

/**
 * Every snapshot a study holds, newest first.
 *
 * Ties on `createdAt` are broken by id so the order is total: two snapshots
 * taken in the same millisecond would otherwise swap places between calls, and
 * callers that ask for "the latest" would get different answers on each read.
 */
export function listSnapshots(studiesRoot: string, studyId: string): readonly SnapshotManifest[] {
  const directory = getStudyPaths(studiesRoot, studyId).source.snapshots;
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) =>
      SnapshotManifestSchema.parse(JSON.parse(readFileSync(join(directory, entry.name), "utf8"))),
    )
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
    );
}

export function createCleanSnapshot(
  studiesRoot: string,
  studyId: string,
  reference?: string,
  now = new Date(),
): SnapshotManifest {
  const registration = readSourceRegistration(studiesRoot, studyId);
  const requestedReference = reference ?? registration.defaultRef;
  assertSafeGitArgument(requestedReference, "source reference");

  // Resolve and inspect the exact source commit before refreshStudyRepository
  // is allowed to fetch it into UniversityLocal's bare mirror. A path-only
  // check after fetch would already have copied a tracked credential into the
  // mirror, which is too late even when the snapshot is then refused.
  const preflightCommit = gitText(
    ["rev-parse", "--verify", `${requestedReference}^{commit}`],
    registration.sourceRoot,
  );
  const preflightTree = gitText(
    ["rev-parse", "--verify", `${preflightCommit}^{tree}`],
    registration.sourceRoot,
  );
  const preflightPathRisk = inspectImportPathRisk(
    listSourceTree(registration.sourceRoot, preflightCommit),
  );
  if (preflightPathRisk.length > 0) {
    throw new Error(describeSnapshotImportRefusal(preflightPathRisk));
  }

  // Pass the resolved commit, rather than the moving branch/tag name, so the
  // commit we checked is the commit that gets fetched even if the source ref
  // moves between preflight and refresh.
  const refreshed = refreshStudyRepository(studiesRoot, studyId, preflightCommit);
  const { repository, sourceCommit, sourceTree } = refreshed;
  if (sourceCommit !== preflightCommit || sourceTree !== preflightTree) {
    throw new Error("Fetched Git object does not match the preflight source commit");
  }
  const snapshotId = `git-${sourceCommit.slice(0, 12)}`;
  const paths = getSnapshotPaths(studiesRoot, studyId, snapshotId);

  // Reuse the airlock's path deny rules, but not its 5MB blob limit. A clean
  // snapshot points at an exact Git tree and can legitimately study large
  // committed media such as GLB files or textures.
  const pathRisk = inspectImportPathRisk(listTree(repository, sourceCommit));
  if (pathRisk.length > 0) throw new Error(describeSnapshotImportRefusal(pathRisk));

  if (existsSync(paths.manifest)) {
    const existing = readManifest(paths.manifest);
    if (existing.sourceCommit !== sourceCommit || existing.sourceTree !== sourceTree) {
      throw new Error(`Snapshot id collision: ${snapshotId}`);
    }
    return existing;
  }

  const inspection = inspectUnsupportedEntries(repository, sourceCommit);
  if (inspection.submodulePaths.length > 0) {
    throw new Error(
      `Snapshot contains unsupported Git submodules: ${inspection.submodulePaths.join(", ")}`,
    );
  }
  if (inspection.lfsPaths.length > 0) {
    throw new Error(
      `Snapshot contains unsupported Git LFS pointers: ${inspection.lfsPaths.join(", ")}`,
    );
  }

  const manifest = SnapshotManifestSchema.parse({
    schemaVersion: 1,
    id: snapshotId,
    mode: "clean",
    sourceCommit,
    sourceTree,
    createdAt: now.toISOString(),
    status: "ready",
    toolVersion: SNAPSHOT_TOOL_VERSION,
    excludedPaths: inspection.excludedPaths,
    submodulePaths: inspection.submodulePaths,
    lfsPaths: inspection.lfsPaths,
  });
  mkdirSync(dirname(paths.manifest), { recursive: true, mode: 0o700 });
  writeJsonAtomically(paths.manifest, manifest);
  return manifest;
}
