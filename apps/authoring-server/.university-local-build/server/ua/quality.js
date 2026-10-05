/**
 * Pure UA analysis quality gates: coverage vs fingerprints, batch progress, and
 * template-collapse detection. Callers own all I/O; this module only inspects
 * already-parsed objects.
 */
/** File-level node types that participate in architecture-layer coverage and fingerprint equality. */
const UA_FILE_LEVEL_TYPES = [
    "file",
    "config",
    "document",
    "service",
    "pipeline",
    "table",
    "schema",
    "resource",
    "endpoint",
];
export const fileLevelTypes = new Set(UA_FILE_LEVEL_TYPES);
/** Matches `batch-<i>.json` and `batch-<i>-part-<k>.json`; capture group 1 is the batch index. */
const UA_BATCH_OUTPUT_FILENAME = /^batch-(\d+)(?:-part-\d+)?\.json$/;
/** Candidate tokens that may be code identifiers or prose words. */
const CODE_OR_PROSE_TOKEN = /[A-Za-z0-9_][A-Za-z0-9_./\\-]*/g;
const WHITESPACE = /\s+/g;
const MAX_LISTED_PATHS = 20;
const MAX_SKELETON_MESSAGE_LENGTH = 60;
const TEMPLATE_MIN_SAMPLE = 20;
const TEMPLATE_DUPLICATE_RATIO_THRESHOLD = 0.3;
const TOP_SKELETONS_IN_REPORT = 5;
const TOP_SKELETONS_IN_FAILURE = 3;
/** Shared: top-level file-layer node with id === `${type}:${filePath}`. */
function isTopLevelFileNode(node) {
    return (typeof node.id === "string" &&
        typeof node.type === "string" &&
        typeof node.filePath === "string" &&
        fileLevelTypes.has(node.type) &&
        node.id === `${node.type}:${node.filePath}`);
}
function sortedUnique(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function formatPathList(paths) {
    if (paths.length <= MAX_LISTED_PATHS)
        return paths.join(", ");
    const shown = paths.slice(0, MAX_LISTED_PATHS).join(", ");
    return `${shown}…还有 ${paths.length - MAX_LISTED_PATHS} 个`;
}
function coverageFailure(direction, paths) {
    const label = direction === "missingFromGraph"
        ? "fingerprints has files missing from the graph"
        : "graph has top-level file nodes missing from fingerprints";
    return `UA coverage gap (${paths.length}): ${label}: ${formatPathList(paths)}`;
}
/**
 * Strip code-like tokens from a summary, keep ordinary prose words, then remove
 * whitespace. Prose provides distinctiveness; identifiers/paths are noise that
 * collapse templates into false uniqueness (or, if all ASCII is stripped, false
 * collapse for healthy English).
 */
function isCodeLikeToken(token) {
    return (/\d/.test(token) ||
        /[_/\\]/.test(token) ||
        /[a-z][A-Z]/.test(token) ||
        /^[A-Z]{2,}$/.test(token) ||
        /[A-Za-z]\.[A-Za-z]/.test(token) ||
        /[a-z]-[a-z]/.test(token));
}
export function extractSummarySkeleton(summary) {
    return summary
        .replace(CODE_OR_PROSE_TOKEN, (token) => (isCodeLikeToken(token) ? "" : token))
        .replace(WHITESPACE, "");
}
/** Shared: collect sorted unique paths from top-level file-layer nodes. */
function topLevelFilePaths(nodes) {
    return sortedUnique(nodes.filter(isTopLevelFileNode).map((node) => node.filePath));
}
function inspectCoverage(graph, fingerprints) {
    const graphPaths = topLevelFilePaths(graph.nodes ?? []);
    const fingerprintPaths = sortedUnique(Object.keys(fingerprints.files ?? {}));
    const graphSet = new Set(graphPaths);
    const fingerprintSet = new Set(fingerprintPaths);
    return {
        missingFromGraph: fingerprintPaths.filter((path) => !graphSet.has(path)),
        missingFromFingerprints: graphPaths.filter((path) => !fingerprintSet.has(path)),
    };
}
/** Shared: template-collapse stats over function/class nodes (uses extractSummarySkeleton). */
function inspectTemplateCollapse(nodes) {
    const counts = new Map();
    let sampleSize = 0;
    for (const node of nodes) {
        if (node.type !== "function" && node.type !== "class")
            continue;
        sampleSize += 1;
        const summary = typeof node.summary === "string" ? node.summary : "";
        const skeleton = extractSummarySkeleton(summary);
        counts.set(skeleton, (counts.get(skeleton) ?? 0) + 1);
    }
    let duplicated = 0;
    for (const count of counts.values()) {
        if (count > 1)
            duplicated += count;
    }
    const duplicateRatio = sampleSize === 0 ? 0 : duplicated / sampleSize;
    const topSkeletons = [...counts.entries()]
        .map(([skeleton, count]) => ({ skeleton, count }))
        .sort((left, right) => right.count - left.count || left.skeleton.localeCompare(right.skeleton))
        .slice(0, TOP_SKELETONS_IN_REPORT);
    return {
        sampleSize,
        distinctSkeletons: counts.size,
        duplicateRatio,
        topSkeletons,
    };
}
function templateCollapseFailure(collapse) {
    const tops = collapse.topSkeletons.slice(0, TOP_SKELETONS_IN_FAILURE).map((entry) => {
        const skeleton = entry.skeleton.length > MAX_SKELETON_MESSAGE_LENGTH
            ? `${entry.skeleton.slice(0, MAX_SKELETON_MESSAGE_LENGTH)}…`
            : entry.skeleton;
        const display = skeleton.length === 0 ? "(empty)" : JSON.stringify(skeleton);
        return `${display}×${entry.count}`;
    });
    return (`UA template collapse: duplicateRatio=${collapse.duplicateRatio.toFixed(3)} ` +
        `(sampleSize=${collapse.sampleSize}, distinctSkeletons=${collapse.distinctSkeletons}); ` +
        `top skeletons: ${tops.join(", ")}`);
}
function maybeTemplateCollapseFailure(collapse) {
    if (collapse.sampleSize >= TEMPLATE_MIN_SAMPLE &&
        collapse.duplicateRatio > TEMPLATE_DUPLICATE_RATIO_THRESHOLD) {
        return templateCollapseFailure(collapse);
    }
    return null;
}
/**
 * Parse planned file paths from one batches.json element.
 * Accepts a string array, `{ files: string[] }`, or `{ files: { path: string }[] }`.
 */
function plannedFilesFromBatchEntry(entry) {
    if (Array.isArray(entry)) {
        return entry.filter((item) => typeof item === "string");
    }
    if (entry === null || typeof entry !== "object")
        return [];
    const files = entry.files;
    if (!Array.isArray(files))
        return [];
    const paths = [];
    for (const item of files) {
        if (typeof item === "string") {
            paths.push(item);
            continue;
        }
        if (item !== null &&
            typeof item === "object" &&
            typeof item.path === "string") {
            paths.push(item.path);
        }
    }
    return paths;
}
/**
 * Extract 1-based batch index from an intermediate output filename, or null if
 * the name does not match `batch-<i>.json` / `batch-<i>-part-<k>.json`.
 */
export function batchIndexFromOutputFilename(filename) {
    const match = UA_BATCH_OUTPUT_FILENAME.exec(filename);
    if (!match)
        return null;
    const index = Number(match[1]);
    return Number.isInteger(index) && index > 0 ? index : null;
}
export function inspectUaQuality(input) {
    const coverage = inspectCoverage(input.graph, input.fingerprints);
    const templateCollapse = inspectTemplateCollapse(input.graph.nodes ?? []);
    const failures = [];
    if (coverage.missingFromGraph.length > 0) {
        failures.push(coverageFailure("missingFromGraph", coverage.missingFromGraph));
    }
    if (coverage.missingFromFingerprints.length > 0) {
        failures.push(coverageFailure("missingFromFingerprints", coverage.missingFromFingerprints));
    }
    const templateFailure = maybeTemplateCollapseFailure(templateCollapse);
    if (templateFailure)
        failures.push(templateFailure);
    return { coverage, templateCollapse, failures };
}
export function inspectUaBatchProgress(input) {
    const totalBatches = input.batches.length;
    const batchEntries = [];
    const failures = [];
    const producedNodes = [];
    let producedBatches = 0;
    let plannedFileCount = 0;
    let coveredFileCount = 0;
    for (let offset = 0; offset < totalBatches; offset += 1) {
        const batchIndex = offset + 1;
        const planned = plannedFilesFromBatchEntry(input.batches[offset]);
        plannedFileCount += planned.length;
        const hasOutput = input.outputsByBatchIndex.has(batchIndex);
        if (!hasOutput) {
            batchEntries.push({
                batchIndex,
                plannedFiles: planned.length,
                producedFiles: 0,
                missingFiles: [],
                status: "pending",
            });
            continue;
        }
        const nodes = input.outputsByBatchIndex.get(batchIndex) ?? [];
        producedBatches += 1;
        producedNodes.push(...nodes);
        const producedPaths = topLevelFilePaths(nodes);
        const producedSet = new Set(producedPaths);
        const missingFiles = planned.filter((path) => !producedSet.has(path));
        const covered = planned.length - missingFiles.length;
        coveredFileCount += covered;
        if (missingFiles.length > 0) {
            const status = "incomplete";
            batchEntries.push({
                batchIndex,
                plannedFiles: planned.length,
                producedFiles: producedPaths.length,
                missingFiles,
                status,
            });
            failures.push(`UA batch ${batchIndex} incomplete: missing ${missingFiles.length} planned file(s): ${formatPathList(missingFiles)}`);
        }
        else {
            batchEntries.push({
                batchIndex,
                plannedFiles: planned.length,
                producedFiles: producedPaths.length,
                missingFiles: [],
                status: "complete",
            });
        }
    }
    const templateCollapse = inspectTemplateCollapse(producedNodes);
    const templateFailure = maybeTemplateCollapseFailure(templateCollapse);
    if (templateFailure)
        failures.push(templateFailure);
    return {
        totalBatches,
        producedBatches,
        plannedFileCount,
        coveredFileCount,
        batches: batchEntries,
        templateCollapse,
        failures,
    };
}
//# sourceMappingURL=quality.js.map