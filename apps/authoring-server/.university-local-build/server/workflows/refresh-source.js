import { existsSync, readFileSync } from "node:fs";
import { UaAnalysisManifestSchema, } from "@pieai/university-core/domain/schemas.js";
import { getUaAnalysisPaths } from "../studies/paths.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { createUaAnalysisIdentity, finalizeUaAnalysis, prepareUaAnalysis, } from "../ua/adapter.js";
import { inspectUaEngineProvenance } from "../ua/provenance.js";
import { auditStudyFreshness, inspectSourceStatus, } from "./refresh-study.js";
const DEFAULT_UA_ENGINE_VERSION = "2.9.4";
const DEFAULT_UA_OUTPUT_LANGUAGE = "zh";
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(",")}]`;
    if (value !== null && typeof value === "object") {
        return `{${Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? "undefined";
}
function assertSourceUnchanged(before, after) {
    if (canonicalJson(before) !== canonicalJson(after)) {
        throw new Error("Studied repository status changed during the refresh operation");
    }
}
function readAnalysisManifest(path) {
    return UaAnalysisManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
function assertReadyAnalysisMatches(analysis, expected) {
    if (analysis.status !== "ready") {
        throw new Error(`UA analysis ${analysis.id} cannot be reused from status ${analysis.status}`);
    }
    for (const [label, actual, wanted] of [
        ["analysisId", analysis.id, expected.analysisId],
        ["snapshotId", analysis.snapshotId, expected.snapshotId],
        ["sourceCommit", analysis.sourceCommit, expected.sourceCommit],
        ["engineVersion", analysis.engineVersion, expected.engineVersion],
        ["outputLanguage", analysis.outputLanguage, expected.outputLanguage],
        ["configHash", analysis.configHash, expected.configHash],
    ]) {
        if (actual !== wanted)
            throw new Error(`Ready UA analysis changed immutable field: ${label}`);
    }
    if (canonicalJson(analysis.engineProvenance ?? null) !== canonicalJson(expected.engineProvenance)) {
        throw new Error("Ready UA analysis changed immutable field: engineProvenance");
    }
}
/**
 * Creates a commit-only snapshot and returns the single structured host invocation needed for UA.
 * It never executes UA and never contacts GitHub; a local commit is sufficient. Dirty files are
 * excluded and require an explicit acknowledgement so the host cannot silently teach from them.
 */
export function prepareStudyRefresh(input) {
    const sourceBefore = inspectSourceStatus(input.studiesRoot, input.studyId);
    if (sourceBefore.dirty && !input.acknowledgeDirtyExcluded) {
        throw new Error("Refresh refused because the studied repository has uncommitted changes. Commit or discard them, or explicitly pass --acknowledge-dirty-excluded to analyze only the immutable commit. GitHub push is not required.");
    }
    const requestedRef = input.reference ?? sourceBefore.defaultRef;
    const snapshot = createCleanSnapshot(input.studiesRoot, input.studyId, input.reference, input.now);
    const engineVersion = input.engineVersion ?? DEFAULT_UA_ENGINE_VERSION;
    const outputLanguage = input.outputLanguage ?? DEFAULT_UA_OUTPUT_LANGUAGE;
    const engineProvenance = inspectUaEngineProvenance(input.uaSkillPath ? { skillPath: input.uaSkillPath } : {});
    const identity = createUaAnalysisIdentity({
        snapshotId: snapshot.id,
        sourceCommit: snapshot.sourceCommit,
        engineVersion,
        outputLanguage,
        config: input.config,
        engineProvenance,
    });
    const paths = getUaAnalysisPaths(input.studiesRoot, input.studyId, identity.analysisId);
    let disposition;
    let analysis;
    let invocation;
    if (existsSync(paths.manifest)) {
        const existing = readAnalysisManifest(paths.manifest);
        if (existing.status === "ready") {
            assertReadyAnalysisMatches(existing, {
                analysisId: identity.analysisId,
                snapshotId: snapshot.id,
                sourceCommit: snapshot.sourceCommit,
                engineVersion,
                outputLanguage,
                configHash: identity.configHash,
                engineProvenance,
            });
            disposition = "ready-reused";
            analysis = existing;
            invocation = null;
        }
        else if (existing.status === "preparing") {
            invocation = prepareUaAnalysis({
                studiesRoot: input.studiesRoot,
                studyId: input.studyId,
                snapshotId: snapshot.id,
                analysisId: identity.analysisId,
                engineVersion,
                outputLanguage,
                config: input.config,
                engineProvenance,
                now: input.now,
            });
            disposition = "resumed";
            analysis = invocation.analysis;
        }
        else if (existing.status === "superseded") {
            // Identity is deterministic; retiring the base slot used to block identical
            // re-runs forever. Allocate a free -retryN id and prepare a fresh analysis
            // without mutating the superseded predecessor.
            // Scan retry slots in order so an interrupted retry keeps the same
            // resume/reuse semantics the base slot has, instead of orphaning its
            // partial work behind a freshly minted id.
            let retryAnalysisId;
            let retryExisting;
            for (let attempt = 2; attempt < 10_000; attempt += 1) {
                const candidate = `${identity.analysisId}-retry${attempt}`;
                const candidatePaths = getUaAnalysisPaths(input.studiesRoot, input.studyId, candidate);
                if (!existsSync(candidatePaths.manifest)) {
                    retryAnalysisId = candidate;
                    break;
                }
                const candidateManifest = readAnalysisManifest(candidatePaths.manifest);
                if (candidateManifest.status === "ready" || candidateManifest.status === "preparing") {
                    retryAnalysisId = candidate;
                    retryExisting = candidateManifest;
                    break;
                }
            }
            if (!retryAnalysisId) {
                throw new Error(`UA analysis ${identity.analysisId} is superseded and no free -retryN analysis id remains`);
            }
            if (retryExisting?.status === "ready") {
                assertReadyAnalysisMatches(retryExisting, {
                    analysisId: retryAnalysisId,
                    snapshotId: snapshot.id,
                    sourceCommit: snapshot.sourceCommit,
                    engineVersion,
                    outputLanguage,
                    configHash: identity.configHash,
                    engineProvenance,
                });
                disposition = "ready-reused";
                analysis = retryExisting;
                invocation = null;
            }
            else {
                invocation = prepareUaAnalysis({
                    studiesRoot: input.studiesRoot,
                    studyId: input.studyId,
                    snapshotId: snapshot.id,
                    analysisId: retryAnalysisId,
                    engineVersion,
                    outputLanguage,
                    config: input.config,
                    engineProvenance,
                    now: input.now,
                });
                disposition = retryExisting ? "resumed" : "retried";
                analysis = invocation.analysis;
            }
        }
        else {
            throw new Error(`UA analysis ${identity.analysisId} is ${existing.status}; it cannot be prepared or reused`);
        }
    }
    else {
        invocation = prepareUaAnalysis({
            studiesRoot: input.studiesRoot,
            studyId: input.studyId,
            snapshotId: snapshot.id,
            analysisId: identity.analysisId,
            engineVersion,
            outputLanguage,
            config: input.config,
            engineProvenance,
            now: input.now,
        });
        disposition = "prepared";
        analysis = invocation.analysis;
    }
    const sourceAfter = inspectSourceStatus(input.studiesRoot, input.studyId);
    assertSourceUnchanged(sourceBefore, sourceAfter);
    return {
        schemaVersion: 1,
        operation: "refresh-prepare",
        disposition,
        source: {
            ...sourceBefore,
            pushRequired: false,
            acknowledged: sourceBefore.dirty && input.acknowledgeDirtyExcluded === true,
            requestedRef,
            resolvedCommit: snapshot.sourceCommit,
        },
        snapshot,
        engineProvenance,
        analysis,
        invocation,
        nextAction: invocation ? "run-ua-in-host-then-finalize" : "audit-freshness",
        uaWasExecuted: false,
    };
}
export function finalizeStudyRefresh(input) {
    const sourceBefore = inspectSourceStatus(input.studiesRoot, input.studyId);
    const analysis = finalizeUaAnalysis(input.studiesRoot, input.studyId, input.analysisId, input.now);
    const sourceAfter = inspectSourceStatus(input.studiesRoot, input.studyId);
    assertSourceUnchanged(sourceBefore, sourceAfter);
    return {
        schemaVersion: 1,
        operation: "refresh-finalize",
        source: sourceBefore,
        analysis,
        nextAction: "audit-freshness",
    };
}
export function auditStudyRefresh(input) {
    const result = auditStudyFreshness({
        studiesRoot: input.studiesRoot,
        studyId: input.studyId,
        targetSnapshotId: input.snapshotId,
        ...(input.analysisId ? { targetAnalysisId: input.analysisId } : {}),
        apply: input.apply ?? false,
    });
    return {
        schemaVersion: 1,
        operation: "refresh-audit",
        applied: input.apply ?? false,
        result,
    };
}
//# sourceMappingURL=refresh-source.js.map