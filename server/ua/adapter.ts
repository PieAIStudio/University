import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  IsoDateTime,
  SnapshotManifestSchema,
  UaAnalysisManifestSchema,
  UaEngineProvenanceSchema,
  type UaAnalysisManifest,
  type UaEngineProvenance,
} from "../../src/domain/schemas.js";
import { writeJsonAtomically, writeTextAtomically } from "../storage/atomic-json.js";
import { getSnapshotPaths, getUaAnalysisPaths } from "../studies/paths.js";
import { openStudyRepository } from "../studies/snapshots.js";

interface UaGraph {
  readonly project?: {
    readonly gitCommitHash?: string;
    readonly analyzedAt?: string;
  };
  readonly nodes?: readonly {
    readonly id?: unknown;
    readonly type?: unknown;
  }[];
  readonly edges?: readonly {
    readonly source?: unknown;
    readonly target?: unknown;
  }[];
  readonly layers?: readonly {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly description?: unknown;
    readonly nodeIds?: unknown;
  }[];
  readonly tour?: readonly {
    readonly order?: unknown;
    readonly title?: unknown;
    readonly description?: unknown;
    readonly nodeIds?: unknown;
  }[];
}

interface UaMeta {
  readonly gitCommitHash?: string;
  readonly lastAnalyzedAt?: string;
}

interface UaFingerprints {
  readonly gitCommitHash?: string;
  readonly generatedAt?: string;
}

export interface PrepareUaAnalysisInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly snapshotId: string;
  readonly analysisId: string;
  readonly engineVersion: string;
  readonly outputLanguage: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly engineProvenance?: UaEngineProvenance;
  readonly now?: Date;
}

export interface UaAnalysisIdentityInput {
  readonly snapshotId: string;
  readonly sourceCommit: string;
  readonly engineVersion: string;
  readonly outputLanguage: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly engineProvenance?: UaEngineProvenance;
}

export interface UaAnalysisIdentity {
  readonly analysisId: string;
  readonly config: unknown;
  readonly configHash: string;
}

export interface UaHostInvocation {
  readonly analysis: UaAnalysisManifest;
  readonly workspace: string;
  readonly dataDirectory: string;
  readonly skill: "understand";
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}

const IGNORE_BLOCK_START = "# UniversityLocal external-symlink exclusions: begin";
const IGNORE_BLOCK_END = "# UniversityLocal external-symlink exclusions: end";

function git(args: readonly string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function semanticHash(value: unknown): string {
  return sha256(JSON.stringify(sortValue(value)));
}

function buildUaConfig(input: UaAnalysisIdentityInput): unknown {
  return sortValue({
    ...input.config,
    outputLanguage: input.outputLanguage,
    autoUpdate: false,
  });
}

function stableToken(value: string, fallback: string): string {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 6)
    .replace(/-+$/g, "");
  return token || fallback;
}

/**
 * Builds the default ID and semantic config binding for a full UA analysis.
 *
 * The readable prefix is diagnostic only. The final digest binds the complete
 * snapshot and commit identity, engine version, output language, full-analysis
 * mode, and semantic config hash. prepareUaAnalysis still compares every
 * immutable manifest field, so even a theoretical truncated-hash collision can
 * never overwrite or resume a different analysis.
 */
export function createUaAnalysisIdentity(input: UaAnalysisIdentityInput): UaAnalysisIdentity {
  const engineProvenance = input.engineProvenance
    ? UaEngineProvenanceSchema.parse(input.engineProvenance)
    : undefined;
  const config = buildUaConfig(input);
  const configHash = semanticHash(config);
  const identityHash = semanticHash({
    engine: "understand-anything",
    engineVersion: input.engineVersion,
    snapshotId: input.snapshotId,
    sourceCommit: input.sourceCommit,
    outputLanguage: input.outputLanguage,
    analysisMode: "full",
    configHash,
    engineProvenance: engineProvenance ?? null,
  });
  const engineToken = stableToken(input.engineVersion, "engine");
  const languageToken = stableToken(input.outputLanguage, "lang");
  const configDigest = configHash.slice("sha256:".length, "sha256:".length + 16);
  const identityDigest = identityHash.slice("sha256:".length, "sha256:".length + 12);

  return {
    analysisId: `ua-${input.sourceCommit.slice(0, 8)}-v${engineToken}-${languageToken}-full-${configDigest}-${identityDigest}`,
    config,
    configHash,
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function escapeIgnorePath(path: string): string {
  return `/${path.replace(/[\\*?[\]#!]/g, "\\$&")}`;
}

function injectExternalSymlinkExclusions(
  dataDirectory: string,
  excludedPaths: readonly string[],
): void {
  const ignorePath = join(dataDirectory, ".understandignore");
  const existing = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  const blockPattern = new RegExp(
    `${IGNORE_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${IGNORE_BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "g",
  );
  const unmanaged = existing.replace(blockPattern, "").trimEnd();
  if (excludedPaths.length === 0) {
    if (unmanaged !== existing.trimEnd()) {
      writeTextAtomically(ignorePath, unmanaged.length > 0 ? `${unmanaged}\n` : "");
    }
    return;
  }
  const managed = [
    IGNORE_BLOCK_START,
    "# These tracked symlinks resolve outside the immutable source tree.",
    ...excludedPaths.map(escapeIgnorePath),
    IGNORE_BLOCK_END,
  ].join("\n");
  writeTextAtomically(ignorePath, `${unmanaged.length > 0 ? `${unmanaged}\n\n` : ""}${managed}\n`);
}

function removeExternalSymlinks(workspace: string, excludedPaths: readonly string[]): void {
  const workspaceRoot = resolve(workspace);
  for (const relativePath of excludedPaths) {
    const candidate = resolve(workspaceRoot, relativePath);
    if (!candidate.startsWith(`${workspaceRoot}/`)) {
      throw new Error(`Excluded source path escapes the UA workspace: ${relativePath}`);
    }
    if (!pathExists(candidate)) continue;
    if (!lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`Excluded source path is no longer a symlink: ${relativePath}`);
    }
    rmSync(candidate);
  }
}

function cleanupUaWorkspace(repository: string, workspace: string): void {
  if (pathExists(workspace)) {
    try {
      git(["--git-dir", repository, "worktree", "remove", "--force", workspace]);
    } catch {
      // A crash can leave an unregistered partial checkout. This exact path is analysis-owned cache.
      rmSync(workspace, { recursive: true, force: true });
    }
  }
  git(["--git-dir", repository, "worktree", "prune", "--expire", "now"]);
  if (pathExists(workspace)) throw new Error(`UA workspace cleanup failed: ${workspace}`);
}

function ensureUaWorkspace(
  repository: string,
  workspace: string,
  dataDirectory: string,
  sourceCommit: string,
): void {
  if (pathExists(workspace)) {
    let workspaceCommit: string;
    try {
      workspaceCommit = git(["-C", workspace, "rev-parse", "HEAD"]);
    } catch {
      throw new Error(`UA workspace exists but is not a Git worktree: ${workspace}`);
    }
    if (workspaceCommit !== sourceCommit) {
      throw new Error("Existing UA workspace does not match the analysis source commit");
    }
  } else {
    git(["--git-dir", repository, "worktree", "prune", "--expire", "now"]);
    mkdirSync(dirname(workspace), { recursive: true, mode: 0o700 });
    git(["--git-dir", repository, "worktree", "add", "--detach", workspace, sourceCommit]);
  }

  const uaLink = join(workspace, ".ua");
  const legacyData = join(workspace, ".understand-anything");
  if (pathExists(legacyData)) {
    throw new Error("Snapshot contains a tracked legacy UA data directory and cannot be mapped");
  }
  if (pathExists(uaLink)) {
    const stat = lstatSync(uaLink);
    if (!stat.isSymbolicLink()) {
      throw new Error("Snapshot contains a tracked .ua path and cannot be safely mapped");
    }
    const target = resolve(dirname(uaLink), readlinkSync(uaLink));
    if (target !== resolve(dataDirectory)) {
      throw new Error("Existing UA data mapping points outside this analysis");
    }
  } else {
    symlinkSync(dataDirectory, uaLink, "dir");
  }
}

function buildInvocation(
  analysis: UaAnalysisManifest,
  workspace: string,
  dataDirectory: string,
): UaHostInvocation {
  return {
    analysis,
    workspace,
    dataDirectory,
    skill: "understand",
    arguments: [workspace, "--no-auto-update", "--language", analysis.outputLanguage],
    environment: { UNDERSTAND_NO_WORKTREE_REDIRECT: "1" },
  };
}

function assertSamePreparingAnalysis(
  current: UaAnalysisManifest,
  expected: UaAnalysisManifest,
): void {
  if (current.status !== "preparing") {
    throw new Error(`UA analysis cannot be resumed from status: ${current.status}`);
  }
  for (const key of [
    "id",
    "engine",
    "engineVersion",
    "snapshotId",
    "sourceCommit",
    "outputLanguage",
    "configHash",
  ] as const) {
    if (current[key] !== expected[key]) {
      throw new Error(`UA analysis resume input changed immutable field: ${key}`);
    }
  }
  if (
    semanticHash(current.engineProvenance ?? null) !==
    semanticHash(expected.engineProvenance ?? null)
  ) {
    throw new Error("UA analysis resume input changed immutable field: engineProvenance");
  }
}

function assertOutputTime(
  label: string,
  value: unknown,
  createdAt: string,
  completedAt: Date,
): void {
  const parsed = IsoDateTime.safeParse(value);
  if (!parsed.success) {
    throw new Error(`UA ${label} must be a valid timestamp`);
  }
  const outputTime = Date.parse(parsed.data);
  if (outputTime < Date.parse(createdAt)) {
    throw new Error(`UA ${label} predates this analysis and may be stale`);
  }
  if (outputTime > completedAt.getTime()) {
    throw new Error(`UA ${label} is later than analysis completion`);
  }
}

function assertUaGraphComplete(
  graph: UaGraph,
): asserts graph is UaGraph & Required<Pick<UaGraph, "nodes" | "edges" | "layers" | "tour">> {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("UA knowledge graph must contain nodes and edges arrays");
  }
  if (!Array.isArray(graph.layers) || graph.layers.length === 0) {
    throw new Error("UA knowledge graph must contain at least one architecture layer");
  }
  if (!Array.isArray(graph.tour) || graph.tour.length === 0) {
    throw new Error("UA knowledge graph must contain at least one Tour step");
  }

  const nodeIds = new Set<string>();
  const fileNodeIds = new Set<string>();
  const fileLevelTypes = new Set([
    "file",
    "config",
    "document",
    "service",
    "pipeline",
    "table",
    "schema",
    "resource",
    "endpoint",
  ]);
  for (const node of graph.nodes) {
    if (typeof node.id !== "string" || node.id.length === 0) {
      throw new Error("UA knowledge graph contains a node without an ID");
    }
    if (nodeIds.has(node.id))
      throw new Error(`UA knowledge graph contains duplicate node: ${node.id}`);
    nodeIds.add(node.id);
    if (typeof node.type === "string" && fileLevelTypes.has(node.type)) fileNodeIds.add(node.id);
  }
  for (const edge of graph.edges) {
    if (
      typeof edge.source !== "string" ||
      typeof edge.target !== "string" ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      throw new Error("UA knowledge graph contains a dangling edge");
    }
  }

  const assigned = new Set<string>();
  for (const layer of graph.layers) {
    if (
      typeof layer.id !== "string" ||
      typeof layer.name !== "string" ||
      typeof layer.description !== "string" ||
      !Array.isArray(layer.nodeIds)
    ) {
      throw new Error("UA architecture layer is incomplete");
    }
    for (const nodeId of layer.nodeIds) {
      if (typeof nodeId !== "string" || !nodeIds.has(nodeId)) {
        throw new Error(`UA architecture layer references a missing node: ${String(nodeId)}`);
      }
      if (assigned.has(nodeId)) {
        throw new Error(`UA node appears in multiple architecture layers: ${nodeId}`);
      }
      assigned.add(nodeId);
    }
  }
  for (const nodeId of fileNodeIds) {
    if (!assigned.has(nodeId)) {
      throw new Error(`UA file-level node is missing from architecture layers: ${nodeId}`);
    }
  }

  const orders = new Set<number>();
  for (const step of graph.tour) {
    if (
      !Number.isInteger(step.order) ||
      typeof step.title !== "string" ||
      typeof step.description !== "string" ||
      !Array.isArray(step.nodeIds)
    ) {
      throw new Error("UA Tour step is incomplete");
    }
    const order = step.order as number;
    if (orders.has(order)) throw new Error(`UA Tour contains duplicate order: ${order}`);
    orders.add(order);
    for (const nodeId of step.nodeIds) {
      if (typeof nodeId !== "string" || !nodeIds.has(nodeId)) {
        throw new Error(`UA Tour references a missing node: ${String(nodeId)}`);
      }
    }
  }
}

export function prepareUaAnalysis(input: PrepareUaAnalysisInput): UaHostInvocation {
  const snapshotPath = getSnapshotPaths(input.studiesRoot, input.studyId, input.snapshotId);
  const snapshot = SnapshotManifestSchema.parse(readJson(snapshotPath.manifest));
  if (snapshot.submodulePaths.length > 0 || snapshot.lfsPaths.length > 0) {
    throw new Error("Snapshot contains unsupported source objects and cannot be analyzed");
  }

  const paths = getUaAnalysisPaths(input.studiesRoot, input.studyId, input.analysisId);
  const { config, configHash } = createUaAnalysisIdentity({
    snapshotId: input.snapshotId,
    sourceCommit: snapshot.sourceCommit,
    engineVersion: input.engineVersion,
    outputLanguage: input.outputLanguage,
    config: input.config,
    engineProvenance: input.engineProvenance,
  });
  const engineProvenance = input.engineProvenance
    ? UaEngineProvenanceSchema.parse(input.engineProvenance)
    : undefined;
  const expected = UaAnalysisManifestSchema.parse({
    schemaVersion: 1,
    id: input.analysisId,
    engine: "understand-anything",
    engineVersion: input.engineVersion,
    snapshotId: input.snapshotId,
    sourceCommit: snapshot.sourceCommit,
    outputLanguage: input.outputLanguage,
    configHash,
    ...(engineProvenance ? { engineProvenance } : {}),
    status: "preparing",
    createdAt: (input.now ?? new Date()).toISOString(),
  });
  const repository = openStudyRepository(input.studiesRoot, input.studyId);

  if (existsSync(paths.manifest)) {
    const current = UaAnalysisManifestSchema.parse(readJson(paths.manifest));
    assertSamePreparingAnalysis(current, expected);
    if (!existsSync(paths.data)) mkdirSync(paths.data, { recursive: true, mode: 0o700 });
    const configPath = join(paths.data, "config.json");
    if (!existsSync(configPath)) {
      writeTextAtomically(configPath, `${JSON.stringify(config, null, 2)}\n`);
    } else if (semanticHash(readJson(configPath)) !== current.configHash) {
      throw new Error("UA analysis config changed and cannot be resumed safely");
    }
    injectExternalSymlinkExclusions(paths.data, snapshot.excludedPaths);
    ensureUaWorkspace(repository, paths.workspace, paths.data, snapshot.sourceCommit);
    removeExternalSymlinks(paths.workspace, snapshot.excludedPaths);
    return buildInvocation(current, paths.workspace, paths.data);
  }

  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  writeJsonAtomically(paths.manifest, expected);

  try {
    mkdirSync(paths.data, { recursive: true, mode: 0o700 });
    writeTextAtomically(join(paths.data, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
    injectExternalSymlinkExclusions(paths.data, snapshot.excludedPaths);
    ensureUaWorkspace(repository, paths.workspace, paths.data, snapshot.sourceCommit);
    removeExternalSymlinks(paths.workspace, snapshot.excludedPaths);
  } catch (error) {
    try {
      cleanupUaWorkspace(repository, paths.workspace);
    } catch {
      // Preserve the original preparation failure; the stale cache remains recoverable on resume.
    }
    const failed = UaAnalysisManifestSchema.parse({
      ...expected,
      status: "failed",
      failure: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
    });
    writeJsonAtomically(paths.manifest, failed);
    throw error;
  }

  return buildInvocation(expected, paths.workspace, paths.data);
}

export function finalizeUaAnalysis(
  studiesRoot: string,
  studyId: string,
  analysisId: string,
  now = new Date(),
): UaAnalysisManifest {
  const paths = getUaAnalysisPaths(studiesRoot, studyId, analysisId);
  const current = UaAnalysisManifestSchema.parse(readJson(paths.manifest));
  if (current.status !== "preparing") throw new Error("Only a preparing analysis can be finalized");

  const required = [
    "knowledge-graph.json",
    "meta.json",
    "fingerprints.json",
    "config.json",
  ] as const;
  for (const filename of required) {
    if (!existsSync(join(paths.data, filename))) {
      throw new Error(`UA output is incomplete: missing ${filename}`);
    }
  }

  const graphBuffer = readFileSync(join(paths.data, "knowledge-graph.json"));
  const graph = JSON.parse(graphBuffer.toString("utf8")) as UaGraph;
  assertUaGraphComplete(graph);
  const meta = readJson(join(paths.data, "meta.json")) as UaMeta;
  const fingerprints = readJson(join(paths.data, "fingerprints.json")) as UaFingerprints;
  if (
    graph.project?.gitCommitHash !== current.sourceCommit ||
    meta.gitCommitHash !== current.sourceCommit ||
    fingerprints.gitCommitHash !== current.sourceCommit
  ) {
    throw new Error("UA output commit does not match the analysis snapshot in every artifact");
  }
  if (semanticHash(readJson(join(paths.data, "config.json"))) !== current.configHash) {
    throw new Error("UA config does not match the analysis semantic config hash");
  }
  assertOutputTime("graph analyzedAt", graph.project?.analyzedAt, current.createdAt, now);
  assertOutputTime("meta lastAnalyzedAt", meta.lastAnalyzedAt, current.createdAt, now);
  assertOutputTime("fingerprints generatedAt", fingerprints.generatedAt, current.createdAt, now);

  const repository = openStudyRepository(studiesRoot, studyId);
  cleanupUaWorkspace(repository, paths.workspace);
  const ready = UaAnalysisManifestSchema.parse({
    ...current,
    status: "ready",
    graphHash: sha256(graphBuffer),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    completedAt: now.toISOString(),
  });
  writeJsonAtomically(paths.manifest, ready);
  return ready;
}

export function failUaAnalysis(
  studiesRoot: string,
  studyId: string,
  analysisId: string,
  reason: string,
  now = new Date(),
): UaAnalysisManifest {
  const paths = getUaAnalysisPaths(studiesRoot, studyId, analysisId);
  const current = UaAnalysisManifestSchema.parse(readJson(paths.manifest));
  if (current.status !== "preparing") throw new Error("Only a preparing analysis can be failed");
  const repository = openStudyRepository(studiesRoot, studyId);
  cleanupUaWorkspace(repository, paths.workspace);
  const failed = UaAnalysisManifestSchema.parse({
    ...current,
    status: "failed",
    failure: reason,
    completedAt: now.toISOString(),
  });
  writeJsonAtomically(paths.manifest, failed);
  return failed;
}
