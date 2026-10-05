import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UaAnalysisManifestSchema } from "@pieai/university-core/domain/schemas.js";
import { getStudyPaths, getUaAnalysisPaths } from "../studies/paths.js";
const text = (value) => (typeof value === "string" ? value : "");
const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
function listReadyAnalyses(studiesRoot, studyId) {
    const uaRoot = getStudyPaths(studiesRoot, studyId).ua;
    if (!existsSync(uaRoot))
        return [];
    const found = [];
    for (const analysisId of readdirSync(uaRoot)) {
        let paths;
        try {
            paths = getUaAnalysisPaths(studiesRoot, studyId, analysisId);
        }
        catch {
            continue;
        }
        if (!existsSync(paths.manifest))
            continue;
        let manifest;
        try {
            manifest = UaAnalysisManifestSchema.parse(JSON.parse(readFileSync(paths.manifest, "utf8")));
        }
        catch {
            // A half-written or superseded analysis is not a reason to have no map.
            continue;
        }
        // `legacy-import` carries the same graph and the same guarantees; excluding
        // it would leave an imported study with no map for no reason.
        if (manifest.status !== "ready" && manifest.status !== "legacy-import")
            continue;
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
export function newestReadyAnalysis(studiesRoot, studyId) {
    return listReadyAnalyses(studiesRoot, studyId)[0] ?? null;
}
function readGraph(studiesRoot, studyId, analysisId) {
    const graphPath = join(getUaAnalysisPaths(studiesRoot, studyId, analysisId).data, "knowledge-graph.json");
    if (!existsSync(graphPath))
        return null;
    try {
        return JSON.parse(readFileSync(graphPath, "utf8"));
    }
    catch {
        return null;
    }
}
/**
 * Builds the map. `citedPaths` are the source paths every lesson in the study
 * cites, which the caller collects — this module deliberately knows nothing
 * about courses beyond the set of paths it is handed.
 */
export function buildLayerCoverage(studiesRoot, studyId, citedPaths) {
    const analysis = newestReadyAnalysis(studiesRoot, studyId);
    if (!analysis)
        return null;
    const graph = readGraph(studiesRoot, studyId, analysis.id);
    if (!graph)
        return null;
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const pathById = new Map();
    const charted = new Set();
    for (const node of nodes) {
        const filePath = text(node.filePath);
        const id = text(node.id);
        if (!filePath || !id)
            continue;
        pathById.set(id, filePath);
        charted.add(filePath);
    }
    const layers = [];
    for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
        const files = new Set();
        for (const nodeId of strings(layer.nodeIds)) {
            const filePath = pathById.get(nodeId);
            if (filePath)
                files.add(filePath);
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
export function lookupLayerCoverageFiles(studiesRoot, studyId, filePaths) {
    if (filePaths.length === 0)
        return [];
    const analysis = newestReadyAnalysis(studiesRoot, studyId);
    if (!analysis)
        return [];
    const graph = readGraph(studiesRoot, studyId, analysis.id);
    if (!graph)
        return [];
    const wanted = new Set(filePaths);
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const layerByNodeId = new Map();
    for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
        const name = text(layer.name);
        for (const nodeId of strings(layer.nodeIds))
            layerByNodeId.set(nodeId, name);
    }
    const found = [];
    for (const node of nodes) {
        const filePath = text(node.filePath);
        const nodeId = text(node.id);
        if (!filePath || !nodeId || !wanted.has(filePath))
            continue;
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
function pickEvidenceNode(nodes, preferredIds) {
    if (nodes.length === 0)
        return null;
    const byId = new Map(nodes.map((node) => [text(node.id), node]));
    for (const id of preferredIds) {
        const hit = byId.get(id);
        if (hit)
            return hit;
    }
    return nodes.find((node) => FILE_LIKE_TYPES.has(text(node.type))) ?? nodes[0] ?? null;
}
function chooseAnalysis(ready, evidence) {
    if (evidence.analysisId) {
        const bound = ready.find((analysis) => analysis.id === evidence.analysisId);
        if (bound)
            return bound;
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
export function resolveEvidenceUa(studiesRoot, studyId, evidence) {
    if (evidence.length === 0)
        return [];
    const ready = listReadyAnalyses(studiesRoot, studyId);
    if (ready.length === 0)
        return evidence.map(() => null);
    const graphs = new Map();
    const readCached = (analysisId) => {
        if (!graphs.has(analysisId)) {
            const graph = readGraph(studiesRoot, studyId, analysisId);
            if (!graph) {
                graphs.set(analysisId, null);
            }
            else {
                const layerByNodeId = new Map();
                for (const layer of Array.isArray(graph.layers) ? graph.layers : []) {
                    const name = text(layer.name);
                    for (const id of strings(layer.nodeIds))
                        layerByNodeId.set(id, name);
                }
                graphs.set(analysisId, {
                    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
                    layerByNodeId,
                });
            }
        }
        return graphs.get(analysisId) ?? null;
    };
    const placeOn = (analysis, item) => {
        const graph = readCached(analysis.id);
        if (!graph)
            return null;
        const nodes = graph.nodes.filter((node) => text(node.filePath) === item.sourcePath && text(node.id));
        const node = pickEvidenceNode(nodes, item.nodeIds ?? []);
        if (!node)
            return null;
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
        if (!analysis)
            return null;
        const placed = placeOn(analysis, item);
        if (placed)
            return placed;
        // Matching-commit graphs can skip a file the later run indexed. A caption
        // from newest-ready is better than a blank when the path still exists.
        const newest = ready[0];
        if (!newest || newest.id === analysis.id)
            return null;
        return placeOn(newest, item);
    });
}
//# sourceMappingURL=study-map.js.map