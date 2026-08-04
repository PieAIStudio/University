/**
 * Pure UA analysis quality gates: coverage vs fingerprints and template-collapse detection.
 * Callers own all I/O; this module only inspects already-parsed objects.
 */

/** File-level node types that participate in architecture-layer coverage and fingerprint equality. */
export const UA_FILE_LEVEL_TYPES = [
  "file",
  "config",
  "document",
  "service",
  "pipeline",
  "table",
  "schema",
  "resource",
  "endpoint",
] as const;

export type UaFileLevelType = (typeof UA_FILE_LEVEL_TYPES)[number];

export const fileLevelTypes: ReadonlySet<string> = new Set(UA_FILE_LEVEL_TYPES);

export interface UaQualityGraphNode {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly filePath?: unknown;
  readonly summary?: unknown;
}

export interface UaGraph {
  readonly nodes?: readonly UaQualityGraphNode[];
}

export interface UaFingerprints {
  readonly files?: Readonly<Record<string, unknown>>;
}

export interface UaCoverageGap {
  readonly missingFromGraph: readonly string[];
  readonly missingFromFingerprints: readonly string[];
}

export interface UaTemplateCollapse {
  readonly sampleSize: number;
  readonly distinctSkeletons: number;
  readonly duplicateRatio: number;
  readonly topSkeletons: readonly { readonly skeleton: string; readonly count: number }[];
}

export interface UaQualityReport {
  readonly coverage: UaCoverageGap;
  readonly templateCollapse: UaTemplateCollapse;
  readonly failures: readonly string[];
}

/** Candidate tokens that may be code identifiers or prose words. */
const CODE_OR_PROSE_TOKEN = /[A-Za-z0-9_][A-Za-z0-9_./\\-]*/g;
const WHITESPACE = /\s+/g;
const MAX_LISTED_PATHS = 20;
const MAX_SKELETON_MESSAGE_LENGTH = 60;
const TEMPLATE_MIN_SAMPLE = 20;
const TEMPLATE_DUPLICATE_RATIO_THRESHOLD = 0.3;
const TOP_SKELETONS_IN_REPORT = 5;
const TOP_SKELETONS_IN_FAILURE = 3;

function isTopLevelFileNode(node: UaQualityGraphNode): node is UaQualityGraphNode & {
  readonly id: string;
  readonly type: string;
  readonly filePath: string;
} {
  return (
    typeof node.id === "string" &&
    typeof node.type === "string" &&
    typeof node.filePath === "string" &&
    fileLevelTypes.has(node.type) &&
    node.id === `${node.type}:${node.filePath}`
  );
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatPathList(paths: readonly string[]): string {
  if (paths.length <= MAX_LISTED_PATHS) return paths.join(", ");
  const shown = paths.slice(0, MAX_LISTED_PATHS).join(", ");
  return `${shown}…还有 ${paths.length - MAX_LISTED_PATHS} 个`;
}

function coverageFailure(
  direction: "missingFromGraph" | "missingFromFingerprints",
  paths: readonly string[],
): string {
  const label =
    direction === "missingFromGraph"
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
function isCodeLikeToken(token: string): boolean {
  return (
    /\d/.test(token) ||
    /[_/\\]/.test(token) ||
    /[a-z][A-Z]/.test(token) ||
    /^[A-Z]{2,}$/.test(token) ||
    /[A-Za-z]\.[A-Za-z]/.test(token) ||
    /[a-z]-[a-z]/.test(token)
  );
}

export function extractSummarySkeleton(summary: string): string {
  return summary
    .replace(CODE_OR_PROSE_TOKEN, (token) => (isCodeLikeToken(token) ? "" : token))
    .replace(WHITESPACE, "");
}

function inspectCoverage(graph: UaGraph, fingerprints: UaFingerprints): UaCoverageGap {
  const graphPaths = sortedUnique(
    (graph.nodes ?? []).filter(isTopLevelFileNode).map((node) => node.filePath),
  );
  const fingerprintPaths = sortedUnique(Object.keys(fingerprints.files ?? {}));
  const graphSet = new Set(graphPaths);
  const fingerprintSet = new Set(fingerprintPaths);
  return {
    missingFromGraph: fingerprintPaths.filter((path) => !graphSet.has(path)),
    missingFromFingerprints: graphPaths.filter((path) => !fingerprintSet.has(path)),
  };
}

function inspectTemplateCollapse(graph: UaGraph): UaTemplateCollapse {
  const counts = new Map<string, number>();
  let sampleSize = 0;
  for (const node of graph.nodes ?? []) {
    if (node.type !== "function" && node.type !== "class") continue;
    sampleSize += 1;
    const summary = typeof node.summary === "string" ? node.summary : "";
    const skeleton = extractSummarySkeleton(summary);
    counts.set(skeleton, (counts.get(skeleton) ?? 0) + 1);
  }

  let duplicated = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicated += count;
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

function templateCollapseFailure(collapse: UaTemplateCollapse): string {
  const tops = collapse.topSkeletons.slice(0, TOP_SKELETONS_IN_FAILURE).map((entry) => {
    const skeleton =
      entry.skeleton.length > MAX_SKELETON_MESSAGE_LENGTH
        ? `${entry.skeleton.slice(0, MAX_SKELETON_MESSAGE_LENGTH)}…`
        : entry.skeleton;
    const display = skeleton.length === 0 ? "(empty)" : JSON.stringify(skeleton);
    return `${display}×${entry.count}`;
  });
  return (
    `UA template collapse: duplicateRatio=${collapse.duplicateRatio.toFixed(3)} ` +
    `(sampleSize=${collapse.sampleSize}, distinctSkeletons=${collapse.distinctSkeletons}); ` +
    `top skeletons: ${tops.join(", ")}`
  );
}

export function inspectUaQuality(input: {
  readonly graph: UaGraph;
  readonly fingerprints: UaFingerprints;
}): UaQualityReport {
  const coverage = inspectCoverage(input.graph, input.fingerprints);
  const templateCollapse = inspectTemplateCollapse(input.graph);
  const failures: string[] = [];

  if (coverage.missingFromGraph.length > 0) {
    failures.push(coverageFailure("missingFromGraph", coverage.missingFromGraph));
  }
  if (coverage.missingFromFingerprints.length > 0) {
    failures.push(coverageFailure("missingFromFingerprints", coverage.missingFromFingerprints));
  }
  if (
    templateCollapse.sampleSize >= TEMPLATE_MIN_SAMPLE &&
    templateCollapse.duplicateRatio > TEMPLATE_DUPLICATE_RATIO_THRESHOLD
  ) {
    failures.push(templateCollapseFailure(templateCollapse));
  }

  return { coverage, templateCollapse, failures };
}
