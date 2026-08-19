import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { UaAnalysisManifestSchema } from "@pieai/university-core/domain/schemas.js";
import { getStudyPaths, getUaAnalysisPaths } from "../studies/paths.js";

/**
 * The studied project's own shape, crossed with how far the courses have taken
 * the reader into it.
 *
 * Understand Anything already produces a map of a codebase: files grouped into
 * architectural layers, each with a summary in the reader's language. It ships
 * a graph explorer for that map, and running a second web app beside this one
 * is a real cost — but the fix is not to embed the explorer. A graph browser
 * answers "show me the whole project", and nobody reading lesson 3 of 41 has
 * that question. They have a smaller one: *what is this file I am being shown
 * code from, and where does it sit?*
 *
 * What neither tool can answer alone is the interesting one. UA knows the
 * project's structure; UniversityLocal knows which files the lessons cite and
 * which of those lessons the reader has finished. Only together can they say
 * "this project has nine layers and your courses have taken you into three" —
 * which is a statement about a curriculum's reach, not about a codebase, and
 * is exactly the gap that produced 60 Buzz lessons touching 18 files.
 *
 * So this reads UA's artifact rather than importing its application: no graph
 * library, no second bundle, and nothing to keep in sync with an engine that
 * ships its own releases.
 */

/** One architectural layer, and how much of it the courses have reached. */
export interface StudyMapLayer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Files UA placed in this layer. */
  readonly fileCount: number;
  /** Of those, how many at least one lesson cites. */
  readonly citedFileCount: number;
  /** The cited ones, so a reader can jump from a layer to what taught it. */
  readonly citedFiles: readonly string[];
}

export interface StudyMap {
  readonly analysisId: string;
  readonly sourceCommit: string;
  readonly outputLanguage: string;
  readonly nodeCount: number;
  readonly layers: readonly StudyMapLayer[];
  /** Files the courses cite that UA has no node for — a coverage question, not an error. */
  readonly uncharted: readonly string[];
}

/** What UA knows about one file, for the panel beside a piece of evidence. */
export interface StudyMapFile {
  readonly nodeId: string;
  readonly filePath: string;
  readonly name: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly complexity: string | null;
  readonly layerName: string | null;
}

/**
 * One evidence citation, placed on the graph that actually analysed that
 * snapshot. A lesson reader asks "where does this file sit?", not "show me
 * the newest analysis of the whole repo".
 */
export interface EvidenceUaContext {
  readonly analysisId: string;
  readonly nodeId: string;
  readonly filePath: string;
  readonly name: string;
  readonly summary: string;
  readonly layerName: string | null;
}

interface EvidenceUaLookup {
  readonly analysisId?: string | undefined;
  readonly sourceCommit: string;
  readonly sourcePath: string;
  readonly nodeIds?: readonly string[] | undefined;
}

interface RawNode {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly name?: unknown;
  readonly filePath?: unknown;
  readonly summary?: unknown;
  readonly tags?: unknown;
  readonly complexity?: unknown;
}

interface RawLayer {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly nodeIds?: unknown;
}

export interface ReadyUaAnalysis {
  readonly id: string;
  readonly completedAt: string;
  readonly sourceCommit: string;
  readonly language: string;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function listReadyAnalyses(studiesRoot: string, studyId: string): ReadyUaAnalysis[] {
  const uaRoot = getStudyPaths(studiesRoot, studyId).ua;
  if (!existsSync(uaRoot)) return [];
  const found: ReadyUaAnalysis[] = [];
  for (const analysisId of readdirSync(uaRoot)) {
    let paths;
    try {
      paths = getUaAnalysisPaths(studiesRoot, studyId, analysisId);
    } catch {
      continue;
    }
    if (!existsSync(paths.manifest)) continue;
    let manifest;
    try {
      manifest = UaAnalysisManifestSchema.parse(JSON.parse(readFileSync(paths.manifest, "utf8")));
    } catch {
      // A half-written or superseded analysis is not a reason to have no map.
      continue;
    }
    // `legacy-import` carries the same graph and the same guarantees; excluding
    // it would leave an imported study with no map for no reason.
    if (manifest.status !== "ready" && manifest.status !== "legacy-import") continue;
    found.push({
      id: manifest.id,
      completedAt: manifest.completedAt,
      sourceCommit: manifest.sourceCommit,
      language: manifest.outputLanguage ?? "zh",
    });
  }
  return found.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

/**
 * The newest ready analysis for a study, or null when there is none.
 *
 * Newest by `completedAt` rather than by directory name: ids carry a config
 * hash, so they sort by nothing meaningful.
 */
export function newestReadyAnalysis(studiesRoot: string, studyId: string): ReadyUaAnalysis | null {
  return listReadyAnalyses(studiesRoot, studyId)[0] ?? null;
}

function readGraph(studiesRoot: string, studyId: string, analysisId: string) {
  const graphPath = join(
    getUaAnalysisPaths(studiesRoot, studyId, analysisId).data,
    "knowledge-graph.json",
  );
  if (!existsSync(graphPath)) return null;
  try {
    return JSON.parse(readFileSync(graphPath, "utf8")) as {
      nodes?: RawNode[];
      layers?: RawLayer[];
    };
  } catch {
    return null;
  }
}

/**
 * Builds the map. `citedPaths` are the source paths every lesson in the study
 * cites, which the caller collects — this module deliberately knows nothing
 * about courses beyond the set of paths it is handed.
 */
export function buildStudyMap(
  studiesRoot: string,
  studyId: string,
  citedPaths: ReadonlySet<string>,
): StudyMap | null {
  const analysis = newestReadyAnalysis(studiesRoot, studyId);
  if (!analysis) return null;
  const graph = readGraph(studiesRoot, studyId, analysis.id);
  if (!graph) return null;

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const pathById = new Map<string, string>();
  const charted = new Set<string>();
  for (const node of nodes) {
    const filePath = text(node.filePath);
    const id = text(node.id);
    if (!filePath || !id) continue;
    pathById.set(id, filePath);
    charted.add(filePath);
  }

  const layers: StudyMapLayer[] = [];
  for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
    const files = new Set<string>();
    for (const nodeId of strings(layer.nodeIds)) {
      const filePath = pathById.get(nodeId);
      if (filePath) files.add(filePath);
    }
    const cited = [...files].filter((filePath) => citedPaths.has(filePath)).sort();
    layers.push({
      id: text(layer.id) || text(layer.name),
      name: text(layer.name),
      description: text(layer.description),
      fileCount: files.size,
      citedFileCount: cited.length,
      citedFiles: cited,
    });
  }

  return {
    analysisId: analysis.id,
    sourceCommit: analysis.sourceCommit,
    outputLanguage: analysis.language,
    nodeCount: nodes.length,
    // Widest reach first: a layer the courses have barely entered is the
    // interesting one, but a layer with nothing in it at all is usually a
    // layer nobody should be taught (generated output, vendored code).
    layers: layers.sort((left, right) => right.fileCount - left.fileCount),
    uncharted: [...citedPaths].filter((filePath) => !charted.has(filePath)).sort(),
  };
}

/** What UA knows about specific files, keyed by path. Missing files are simply absent. */
export function lookupStudyMapFiles(
  studiesRoot: string,
  studyId: string,
  filePaths: readonly string[],
): readonly StudyMapFile[] {
  if (filePaths.length === 0) return [];
  const analysis = newestReadyAnalysis(studiesRoot, studyId);
  if (!analysis) return [];
  const graph = readGraph(studiesRoot, studyId, analysis.id);
  if (!graph) return [];

  const wanted = new Set(filePaths);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

  const layerByNodeId = new Map<string, string>();
  for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
    const name = text(layer.name);
    for (const nodeId of strings(layer.nodeIds)) layerByNodeId.set(nodeId, name);
  }

  const found: StudyMapFile[] = [];
  for (const node of nodes) {
    const filePath = text(node.filePath);
    const nodeId = text(node.id);
    if (!filePath || !nodeId || !wanted.has(filePath)) continue;
    found.push({
      nodeId,
      filePath,
      name: text(node.name) || filePath,
      summary: text(node.summary),
      tags: strings(node.tags),
      complexity: text(node.complexity) || null,
      layerName: layerByNodeId.get(nodeId) || null,
    });
  }
  return found;
}

/** File-level UA nodes. Function/class children of the same path are too small for a lesson caption. */
const FILE_LIKE_TYPES = new Set(["file", "document", "config", "pipeline"]);

function pickEvidenceNode(
  nodes: readonly RawNode[],
  preferredIds: readonly string[],
): RawNode | null {
  if (nodes.length === 0) return null;
  const byId = new Map(nodes.map((node) => [text(node.id), node]));
  for (const id of preferredIds) {
    const hit = byId.get(id);
    if (hit) return hit;
  }
  return nodes.find((node) => FILE_LIKE_TYPES.has(text(node.type))) ?? nodes[0] ?? null;
}

function chooseAnalysis(
  ready: readonly ReadyUaAnalysis[],
  evidence: EvidenceUaLookup,
): ReadyUaAnalysis | null {
  if (evidence.analysisId) {
    const bound = ready.find((analysis) => analysis.id === evidence.analysisId);
    if (bound) return bound;
  }
  const matchingCommit = ready.find((analysis) => analysis.sourceCommit === evidence.sourceCommit);
  return matchingCommit ?? ready[0] ?? null;
}

/**
 * Place each citation on the graph that analysed its snapshot.
 *
 * Newest-ready is the wrong default here: a beginner course pinned to commit A
 * must not caption files from commit B's later analysis just because that run
 * finished more recently. Bound `analysisId` wins, then same-commit ready,
 * then newest ready as a last resort.
 */
export function resolveEvidenceUa(
  studiesRoot: string,
  studyId: string,
  evidence: readonly EvidenceUaLookup[],
): readonly (EvidenceUaContext | null)[] {
  if (evidence.length === 0) return [];
  const ready = listReadyAnalyses(studiesRoot, studyId);
  if (ready.length === 0) return evidence.map(() => null);

  const graphs = new Map<
    string,
    {
      readonly nodes: readonly RawNode[];
      readonly layerByNodeId: ReadonlyMap<string, string>;
    } | null
  >();
  const readCached = (analysisId: string) => {
    if (!graphs.has(analysisId)) {
      const graph = readGraph(studiesRoot, studyId, analysisId);
      if (!graph) {
        graphs.set(analysisId, null);
      } else {
        const layerByNodeId = new Map<string, string>();
        for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
          const name = text(layer.name);
          for (const id of strings(layer.nodeIds)) layerByNodeId.set(id, name);
        }
        graphs.set(analysisId, {
          nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
          layerByNodeId,
        });
      }
    }
    return graphs.get(analysisId) ?? null;
  };

  const placeOn = (analysis: ReadyUaAnalysis, item: EvidenceUaLookup): EvidenceUaContext | null => {
    const graph = readCached(analysis.id);
    if (!graph) return null;
    const nodes = graph.nodes.filter(
      (node) => text(node.filePath) === item.sourcePath && text(node.id),
    );
    const node = pickEvidenceNode(nodes, item.nodeIds ?? []);
    if (!node) return null;
    const nodeId = text(node.id);
    return {
      analysisId: analysis.id,
      nodeId,
      filePath: item.sourcePath,
      name: text(node.name) || item.sourcePath,
      summary: text(node.summary),
      layerName: graph.layerByNodeId.get(nodeId) || null,
    };
  };

  return evidence.map((item) => {
    const analysis = chooseAnalysis(ready, item);
    if (!analysis) return null;
    const placed = placeOn(analysis, item);
    if (placed) return placed;
    // Matching-commit graphs can skip a file the later run indexed. A caption
    // from newest-ready is better than a blank when the path still exists.
    const newest = ready[0];
    if (!newest || newest.id === analysis.id) return null;
    return placeOn(newest, item);
  });
}
