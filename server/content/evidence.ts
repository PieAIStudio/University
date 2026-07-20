import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  EvidenceReferenceSchema,
  SnapshotManifestSchema,
  UaAnalysisManifestSchema,
  type EvidenceReference,
} from "../../src/domain/schemas.js";
import { getSnapshotPaths, getUaAnalysisPaths } from "../studies/paths.js";
import { openStudyRepository } from "../studies/snapshots.js";

interface GraphNode {
  readonly id?: string;
  readonly [key: string]: unknown;
}

interface KnowledgeGraph {
  readonly nodes?: readonly GraphNode[];
}

interface GitTreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly objectId: string;
  readonly path: string;
}

export const EVIDENCE_SNIPPET_LIMITS = Object.freeze({
  maxSourceBytes: 2 * 1024 * 1024,
  maxReturnedBytes: 64 * 1024,
  maxContextLines: 20,
  defaultContextLines: 5,
  maxHighlightedLines: 120,
  maxReturnedLines: 160,
});

export interface EvidenceFreshness {
  readonly status: "fresh" | "stale";
  readonly reasons: readonly string[];
}

export interface EvidenceSnippet {
  readonly sourcePath: string;
  readonly sourceCommit: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly highlightStartLine: number | null;
  readonly highlightEndLine: number | null;
  readonly language: string;
  readonly code: string;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((child) => (child === undefined ? "null" : canonicalJson(child))).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function gitBuffer(repository: string, args: readonly string[]): Buffer {
  return execFileSync("git", ["--git-dir", repository, ...args], {
    env: {
      ...process.env,
      GIT_LITERAL_PATHSPECS: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readTreeEntry(
  repository: string,
  sourceCommit: string,
  sourcePath: string,
): GitTreeEntry | null {
  let output: Buffer;
  try {
    output = gitBuffer(repository, ["ls-tree", "-z", sourceCommit, "--", sourcePath]);
  } catch {
    throw new Error(`Evidence commit is unavailable in the study repository: ${sourceCommit}`);
  }
  const records = output.toString("utf8").split("\0").filter(Boolean);
  if (records.length === 0) return null;
  if (records.length !== 1) throw new Error(`Evidence path is ambiguous: ${sourcePath}`);
  const tab = records[0].indexOf("\t");
  if (tab < 0) throw new Error("Git returned an invalid evidence tree entry");
  const [mode, type, objectId] = records[0].slice(0, tab).split(" ");
  const path = records[0].slice(tab + 1);
  if (!mode || !type || !objectId || path !== sourcePath) return null;
  return { mode, type, objectId, path };
}

function isRegularBlob(entry: GitTreeEntry | null): entry is GitTreeEntry {
  return (
    entry !== null && entry.type === "blob" && (entry.mode === "100644" || entry.mode === "100755")
  );
}

function requireRegularBlob(
  repository: string,
  sourceCommit: string,
  sourcePath: string,
): GitTreeEntry {
  const entry = readTreeEntry(repository, sourceCommit, sourcePath);
  if (entry === null) throw new Error(`Evidence source file does not exist: ${sourcePath}`);
  if (!isRegularBlob(entry)) {
    throw new Error(
      `Evidence source must be a regular Git blob (not a symlink, tree, or gitlink): ${sourcePath}`,
    );
  }
  return entry;
}

function readBlob(repository: string, objectId: string): Buffer {
  return gitBuffer(repository, ["cat-file", "blob", objectId]);
}

function readBlobSize(repository: string, objectId: string): number {
  const raw = gitBuffer(repository, ["cat-file", "-s", objectId]).toString("utf8").trim();
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Git returned an invalid evidence blob size");
  }
  return size;
}

function decodeTextBlob(source: Buffer, sourcePath: string): string {
  if (source.includes(0)) {
    throw new Error(`Evidence snippet cannot display a binary blob: ${sourcePath}`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    throw new Error(`Evidence snippet must be valid UTF-8 text: ${sourcePath}`);
  }
}

function sourceLines(text: string): readonly string[] {
  if (text.length === 0) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (/(?:\r\n|\n|\r)$/.test(text)) lines.pop();
  return lines;
}

function inferSnippetLanguage(sourcePath: string): string {
  const lower = sourcePath.toLowerCase();
  const name = lower.split("/").at(-1) ?? lower;
  if (name === "package.json" || name === "tsconfig.json" || name.endsWith(".json")) return "json";
  if (name === "dockerfile" || name === "makefile") return "shellscript";
  const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
  return (
    (
      {
        ts: "typescript",
        mts: "typescript",
        cts: "typescript",
        tsx: "tsx",
        js: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        jsx: "jsx",
        json: "json",
        css: "css",
        scss: "css",
        html: "html",
        htm: "html",
        md: "markdown",
        mdx: "markdown",
        sh: "shellscript",
        bash: "shellscript",
        zsh: "shellscript",
        py: "python",
        go: "go",
        rs: "rust",
        sql: "sql",
        yml: "yaml",
        yaml: "yaml",
        vue: "vue",
        svelte: "svelte",
      } as Record<string, string>
    )[extension] ?? "text"
  );
}

/**
 * Reads a bounded source excerpt from the immutable Git object named by approved evidence.
 * The registered live source checkout is deliberately never consulted.
 */
export function readEvidenceSnippet(
  studiesRoot: string,
  studyId: string,
  candidate: EvidenceReference,
  contextLines: number = EVIDENCE_SNIPPET_LIMITS.defaultContextLines,
): EvidenceSnippet {
  const evidence = validateEvidence(studiesRoot, studyId, candidate);
  if (
    !Number.isInteger(contextLines) ||
    contextLines < 0 ||
    contextLines > EVIDENCE_SNIPPET_LIMITS.maxContextLines
  ) {
    throw new Error(
      `Evidence context must be between 0 and ${EVIDENCE_SNIPPET_LIMITS.maxContextLines} lines`,
    );
  }

  const repository = openStudyRepository(studiesRoot, studyId);
  const entry = requireRegularBlob(repository, evidence.sourceCommit, evidence.sourcePath);
  const blobSize = readBlobSize(repository, entry.objectId);
  if (blobSize > EVIDENCE_SNIPPET_LIMITS.maxSourceBytes) {
    throw new Error(
      `Evidence source exceeds the ${EVIDENCE_SNIPPET_LIMITS.maxSourceBytes}-byte display limit: ${evidence.sourcePath}`,
    );
  }

  const lines = sourceLines(
    decodeTextBlob(readBlob(repository, entry.objectId), evidence.sourcePath),
  );
  if (lines.length === 0) {
    throw new Error(`Evidence source is empty: ${evidence.sourcePath}`);
  }

  const hasLineRange = evidence.lineStart !== undefined || evidence.lineEnd !== undefined;
  const highlightStartLine = hasLineRange ? (evidence.lineStart ?? 1) : null;
  const highlightEndLine = hasLineRange
    ? (evidence.lineEnd ?? evidence.lineStart ?? lines.length)
    : null;
  if (
    highlightStartLine !== null &&
    highlightEndLine !== null &&
    highlightEndLine - highlightStartLine + 1 > EVIDENCE_SNIPPET_LIMITS.maxHighlightedLines
  ) {
    throw new Error(
      `Evidence range exceeds the ${EVIDENCE_SNIPPET_LIMITS.maxHighlightedLines}-line display limit`,
    );
  }

  const startLine = hasLineRange ? Math.max(1, (highlightStartLine ?? 1) - contextLines) : 1;
  const endLine = hasLineRange
    ? Math.min(lines.length, (highlightEndLine ?? lines.length) + contextLines)
    : lines.length;
  if (endLine - startLine + 1 > EVIDENCE_SNIPPET_LIMITS.maxReturnedLines) {
    throw new Error(
      `Evidence snippet exceeds the ${EVIDENCE_SNIPPET_LIMITS.maxReturnedLines}-line display limit; cite a narrower range`,
    );
  }

  const code = lines.slice(startLine - 1, endLine).join("\n");
  if (Buffer.byteLength(code, "utf8") > EVIDENCE_SNIPPET_LIMITS.maxReturnedBytes) {
    throw new Error(
      `Evidence snippet exceeds the ${EVIDENCE_SNIPPET_LIMITS.maxReturnedBytes}-byte response limit; cite a narrower range`,
    );
  }

  return {
    sourcePath: evidence.sourcePath,
    sourceCommit: evidence.sourceCommit,
    startLine,
    endLine,
    highlightStartLine,
    highlightEndLine,
    language: inferSnippetLanguage(evidence.sourcePath),
    code,
  };
}

function readVerifiedGraphNodes(path: string, expectedHash: string): Map<string, GraphNode> {
  const bytes = readFileSync(path);
  const actualHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actualHash !== expectedHash) {
    throw new Error("UA knowledge graph no longer matches its immutable graphHash");
  }
  const graph = JSON.parse(bytes.toString("utf8")) as KnowledgeGraph;
  if (!Array.isArray(graph.nodes)) throw new Error("UA knowledge graph has no nodes array");
  return new Map(
    graph.nodes.flatMap((node) => (typeof node.id === "string" ? [[node.id, node] as const] : [])),
  );
}

export function validateEvidence(
  studiesRoot: string,
  studyId: string,
  candidate: EvidenceReference,
): EvidenceReference {
  const evidence = EvidenceReferenceSchema.parse(candidate);
  const snapshotPaths = getSnapshotPaths(studiesRoot, studyId, evidence.snapshotId);
  const snapshot = SnapshotManifestSchema.parse(readJson(snapshotPaths.manifest));
  if (snapshot.sourceCommit !== evidence.sourceCommit) {
    throw new Error("Evidence snapshot does not match sourceCommit");
  }

  // Validation is intentionally offline: reading evidence must never mutate or fetch the source.
  const repository = openStudyRepository(studiesRoot, studyId);
  const entry = requireRegularBlob(repository, evidence.sourceCommit, evidence.sourcePath);

  if (evidence.lineStart || evidence.lineEnd) {
    const source = readBlob(repository, entry.objectId);
    if (source.includes(0)) {
      throw new Error(`Line evidence cannot reference a binary blob: ${evidence.sourcePath}`);
    }
    const text = source.toString("utf8");
    const lineCount =
      text.length === 0 ? 0 : text.split(/\r?\n/).length - (/\r?\n$/.test(text) ? 1 : 0);
    if ((evidence.lineStart ?? 1) > lineCount || (evidence.lineEnd ?? 1) > lineCount) {
      throw new Error(`Evidence line range exceeds ${evidence.sourcePath}`);
    }
  }

  if (evidence.analysisId && evidence.graphHash) {
    const analysisPaths = getUaAnalysisPaths(studiesRoot, studyId, evidence.analysisId);
    const analysis = UaAnalysisManifestSchema.parse(readJson(analysisPaths.manifest));
    if (
      analysis.status !== "ready" ||
      analysis.sourceCommit !== evidence.sourceCommit ||
      analysis.graphHash !== evidence.graphHash
    ) {
      throw new Error("Evidence UA analysis is not ready or does not match its immutable binding");
    }
    const nodes = readVerifiedGraphNodes(
      `${analysisPaths.data}/knowledge-graph.json`,
      analysis.graphHash,
    );
    for (const nodeId of evidence.nodeIds) {
      if (!nodes.has(nodeId)) throw new Error(`Evidence references an unknown UA node: ${nodeId}`);
    }
  }
  return evidence;
}

export function evaluateEvidenceFreshness(
  studiesRoot: string,
  studyId: string,
  candidate: EvidenceReference,
  targetSnapshotId: string,
  targetAnalysisId?: string,
): EvidenceFreshness {
  const evidence = validateEvidence(studiesRoot, studyId, candidate);
  const targetSnapshot = SnapshotManifestSchema.parse(
    readJson(getSnapshotPaths(studiesRoot, studyId, targetSnapshotId).manifest),
  );

  const reasons: string[] = [];
  const repository = openStudyRepository(studiesRoot, studyId);
  const previousEntry = readTreeEntry(repository, evidence.sourceCommit, evidence.sourcePath);
  const targetEntry = readTreeEntry(repository, targetSnapshot.sourceCommit, evidence.sourcePath);
  const sameRegularBlob =
    isRegularBlob(previousEntry) &&
    isRegularBlob(targetEntry) &&
    previousEntry.objectId === targetEntry.objectId;
  if (!sameRegularBlob) reasons.push(`Referenced source changed: ${evidence.sourcePath}`);
  if (
    evidence.kind === "inference" &&
    targetSnapshot.sourceCommit !== evidence.sourceCommit &&
    sameRegularBlob
  ) {
    reasons.push("Inference requires review after the repository commit changes");
  }

  if (evidence.analysisId && evidence.graphHash) {
    if (!targetAnalysisId) {
      reasons.push("UA-backed evidence has no target analysis for comparison");
    } else {
      const oldPaths = getUaAnalysisPaths(studiesRoot, studyId, evidence.analysisId);
      const targetPaths = getUaAnalysisPaths(studiesRoot, studyId, targetAnalysisId);
      const target = UaAnalysisManifestSchema.parse(readJson(targetPaths.manifest));
      if (target.status !== "ready" || target.sourceCommit !== targetSnapshot.sourceCommit) {
        throw new Error("Target UA analysis is not ready or does not match target snapshot");
      }
      const oldManifest = UaAnalysisManifestSchema.parse(readJson(oldPaths.manifest));
      if (oldManifest.status !== "ready") throw new Error("Evidence UA analysis is not ready");
      const oldNodes = readVerifiedGraphNodes(
        `${oldPaths.data}/knowledge-graph.json`,
        oldManifest.graphHash,
      );
      const targetNodes = readVerifiedGraphNodes(
        `${targetPaths.data}/knowledge-graph.json`,
        target.graphHash,
      );
      for (const nodeId of evidence.nodeIds) {
        if (canonicalJson(oldNodes.get(nodeId)) !== canonicalJson(targetNodes.get(nodeId))) {
          reasons.push(`UA node changed or disappeared: ${nodeId}`);
        }
      }
    }
  }
  return reasons.length === 0 ? { status: "fresh", reasons } : { status: "stale", reasons };
}
