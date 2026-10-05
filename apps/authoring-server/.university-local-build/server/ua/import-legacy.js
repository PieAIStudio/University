import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { SnapshotManifestSchema, UaAnalysisManifestSchema, } from "@pieai/university-core/domain/schemas.js";
import { writeJsonAtomically, writeTextAtomically } from "../storage/atomic-json.js";
import { getSnapshotPaths, getUaAnalysisPaths } from "../studies/paths.js";
const COPY_PATHS = [
    "knowledge-graph.json",
    "meta.json",
    "fingerprints.json",
    "config.json",
    ".understandignore",
    "intermediate/scan-result.json",
];
function sha256(value) {
    return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
export function importLegacyUaAnalysis(input) {
    const paths = getUaAnalysisPaths(input.studiesRoot, input.studyId, input.analysisId);
    if (existsSync(paths.root))
        throw new Error(`UA analysis already exists: ${input.analysisId}`);
    const snapshot = SnapshotManifestSchema.parse(readJson(getSnapshotPaths(input.studiesRoot, input.studyId, input.snapshotId).manifest));
    if (snapshot.status !== "ready")
        throw new Error("Legacy UA snapshot is not ready");
    const graphSource = join(input.sourceUaDirectory, "knowledge-graph.json");
    const metaSource = join(input.sourceUaDirectory, "meta.json");
    const fingerprintsSource = join(input.sourceUaDirectory, "fingerprints.json");
    const configSource = join(input.sourceUaDirectory, "config.json");
    for (const required of [graphSource, metaSource, fingerprintsSource, configSource]) {
        if (!existsSync(required))
            throw new Error(`Legacy UA data is incomplete: ${required}`);
    }
    const graphBuffer = readFileSync(graphSource);
    const graph = JSON.parse(graphBuffer.toString("utf8"));
    const meta = readJson(metaSource);
    const configBuffer = readFileSync(configSource);
    const config = JSON.parse(configBuffer.toString("utf8"));
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error("Legacy UA graph must contain nodes and edges arrays");
    }
    if (meta.gitCommitHash !== snapshot.sourceCommit) {
        throw new Error("Legacy UA meta commit does not match its source snapshot");
    }
    // Stage the whole analysis beside its destination and move it in one
    // rename. Copying files into `paths.root` first meant a crash mid-import
    // left a directory with no manifest: every retry hit "UA analysis already
    // exists" and the import could never be completed or repaired.
    const staging = `${paths.root}.importing-${randomUUID()}`;
    const stagingData = join(staging, "data");
    const completedAt = meta.lastAnalyzedAt ?? new Date().toISOString();
    try {
        mkdirSync(stagingData, { recursive: true, mode: 0o700 });
        for (const relativePath of COPY_PATHS) {
            const source = join(input.sourceUaDirectory, relativePath);
            if (existsSync(source)) {
                writeTextAtomically(join(stagingData, relativePath), readFileSync(source, "utf8"));
            }
        }
    }
    catch (error) {
        rmSync(staging, { recursive: true, force: true });
        throw error;
    }
    const manifest = UaAnalysisManifestSchema.parse({
        schemaVersion: 1,
        id: input.analysisId,
        engine: "understand-anything",
        engineVersion: input.engineVersion,
        snapshotId: input.snapshotId,
        sourceCommit: snapshot.sourceCommit,
        outputLanguage: config.outputLanguage ?? "en",
        configHash: sha256(configBuffer),
        graphHash: sha256(graphBuffer),
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        status: "legacy-import",
        createdAt: completedAt,
        completedAt,
    });
    try {
        writeJsonAtomically(join(staging, "manifest.json"), manifest);
        mkdirSync(dirname(paths.root), { recursive: true, mode: 0o700 });
        renameSync(staging, paths.root);
    }
    catch (error) {
        rmSync(staging, { recursive: true, force: true });
        throw error;
    }
    return manifest;
}
//# sourceMappingURL=import-legacy.js.map