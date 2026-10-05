import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GitCommit, SnapshotManifestSchema, StableId, UaAnalysisManifestSchema, isRepositoryEvidence, } from "@pieai/university-core/domain/schemas.js";
import { evaluateEvidenceFreshness } from "../content/evidence.js";
import { readCourse, readLatestCard, readLatestExercise, readLatestLesson, readUnit, updateCourseStatus, updateUnitStatus, } from "../content/repository.js";
import { listKnowledgeNotes, markKnowledgeNoteStale, readLatestKnowledgeNote, } from "../knowledge/repository.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { canonicalJson, readJson, sha256 } from "../storage/serialization.js";
import { getCoursePaths, getKnowledgeNotePaths, getSnapshotPaths, getStudyPaths, getUaAnalysisPaths, } from "../studies/paths.js";
import { readSourceRegistration } from "../studies/repository.js";
const MISSING_TARGET_UA_REASON = "UA-backed evidence has no target analysis for comparison";
function gitText(sourceRoot, args) {
    return execFileSync("git", ["-C", sourceRoot, ...args], {
        encoding: "utf8",
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
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function uniqueIdentities(values) {
    const identities = new Map(values.map((value) => [canonicalJson(value), value]));
    return [...identities.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, identity]) => identity);
}
/**
 * Which snapshot and analysis a citation came from, so the audit can say what
 * a lesson is still pinned to after the studied repository moves.
 *
 * Only repository citations have one. A URL citation names a public page, and
 * a public page has no relationship to the studied repo's HEAD — 「MDN 那篇改过
 * 没有」 is an editorial question, not something a commit comparison can answer.
 * Including them would put a row of nulls in the audit that reads as "pinned to
 * nothing" rather than as "not pinned to this at all".
 */
function evidenceIdentity(evidence) {
    return {
        snapshotId: evidence.snapshotId,
        sourceCommit: evidence.sourceCommit,
        analysisId: evidence.analysisId ?? null,
        graphHash: evidence.graphHash ?? null,
    };
}
export function inspectSourceStatus(studiesRoot, studyId) {
    const registration = readSourceRegistration(studiesRoot, studyId);
    const headCommit = GitCommit.parse(gitText(registration.sourceRoot, ["rev-parse", "--verify", "HEAD^{commit}"]).trim());
    let branch;
    try {
        branch = gitText(registration.sourceRoot, [
            "symbolic-ref",
            "--quiet",
            "--short",
            "HEAD",
        ]).trim();
    }
    catch {
        branch = null;
    }
    const dirtyEntries = gitText(registration.sourceRoot, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
    ])
        .split("\0")
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
    return {
        sourceRoot: registration.sourceRoot,
        defaultRef: registration.defaultRef,
        headCommit,
        branch: branch || null,
        dirty: dirtyEntries.length > 0,
        dirtyEntries,
        snapshotBasis: "local-commit",
        localCommitSufficient: true,
        dirtyChangesIncluded: false,
    };
}
function targetIdentity(input) {
    const snapshot = SnapshotManifestSchema.parse(readJson(getSnapshotPaths(input.studiesRoot, input.studyId, input.targetSnapshotId).manifest));
    if (!input.targetAnalysisId) {
        return {
            snapshotId: snapshot.id,
            sourceCommit: snapshot.sourceCommit,
            analysisId: null,
            graphHash: null,
        };
    }
    const analysis = UaAnalysisManifestSchema.parse(readJson(getUaAnalysisPaths(input.studiesRoot, input.studyId, input.targetAnalysisId).manifest));
    if (analysis.status !== "ready" ||
        analysis.snapshotId !== snapshot.id ||
        analysis.sourceCommit !== snapshot.sourceCommit) {
        throw new Error("Target UA analysis is not ready or does not match the target snapshot identity");
    }
    return {
        snapshotId: snapshot.id,
        sourceCommit: snapshot.sourceCommit,
        analysisId: analysis.id,
        graphHash: analysis.graphHash,
    };
}
function evaluateReferences(input, evidence) {
    const results = evidence.map((reference) => evaluateEvidenceFreshness(input.studiesRoot, input.studyId, reference, input.targetSnapshotId, input.targetAnalysisId));
    const reasons = uniqueSorted(results.flatMap((result) => result.reasons));
    return {
        status: reasons.length === 0 ? "fresh" : "stale",
        waitingForUa: reasons.includes(MISSING_TARGET_UA_REASON),
        reasons,
        previousIdentities: uniqueIdentities(evidence.filter(isRepositoryEvidence).map(evidenceIdentity)),
    };
}
function createItem(input, kind, courseId, unitId, lessonId, contentId, contentRevision, contentStatus, evidence) {
    const evaluated = evaluateReferences(input, evidence);
    const suffix = kind === "lesson" ? "" : `/${kind}s/${contentId}`;
    return {
        kind,
        key: `${courseId}/${unitId}/${lessonId}${suffix}`,
        courseId,
        unitId,
        lessonId,
        contentId,
        contentRevision,
        contentStatus,
        ...evaluated,
    };
}
function lessonItems(input, courseId, unitId, lessonId) {
    const lesson = readLatestLesson(input.studiesRoot, input.studyId, courseId, unitId, lessonId).manifest;
    const items = [
        createItem(input, "lesson", courseId, unitId, lessonId, lesson.id, lesson.contentRevision, lesson.status, lesson.evidence),
    ];
    for (const cardId of lesson.cardIds) {
        const card = readLatestCard(input.studiesRoot, input.studyId, courseId, unitId, lessonId, cardId);
        items.push(createItem(input, "card", courseId, unitId, lessonId, card.id, card.contentRevision, card.status, card.evidence));
    }
    for (const exerciseId of lesson.exerciseIds) {
        const exercise = readLatestExercise(input.studiesRoot, input.studyId, courseId, unitId, lessonId, exerciseId);
        items.push(createItem(input, "exercise", courseId, unitId, lessonId, exercise.id, exercise.contentRevision, exercise.status, exercise.evidence));
    }
    return items;
}
function buildCourseReport(input, courseId, target) {
    const course = readCourse(input.studiesRoot, input.studyId, courseId);
    const items = [];
    const units = [];
    for (const unitId of course.unitIds) {
        const unit = readUnit(input.studiesRoot, input.studyId, course.id, unitId);
        const unitItems = unit.lessonIds.flatMap((lessonId) => lessonItems(input, course.id, unit.id, lessonId));
        items.push(...unitItems);
        const staleItemKeys = unitItems
            .filter((item) => item.status === "stale")
            .map((item) => item.key)
            .sort((left, right) => left.localeCompare(right));
        units.push({
            unitId: unit.id,
            status: staleItemKeys.length === 0 ? "fresh" : "stale",
            reasons: staleItemKeys.map((key) => `Stale content: ${key}`),
            staleItemKeys,
        });
    }
    items.sort((left, right) => left.key.localeCompare(right.key));
    units.sort((left, right) => left.unitId.localeCompare(right.unitId));
    const staleUnits = units.filter((unit) => unit.status === "stale");
    const payload = {
        schemaVersion: 1,
        studyId: input.studyId,
        courseId: course.id,
        previousIdentities: uniqueIdentities(items.flatMap((item) => item.previousIdentities)),
        targetIdentity: target,
        status: staleUnits.length === 0 ? "fresh" : "stale",
        waitingForUa: items.some((item) => item.waitingForUa),
        reasons: staleUnits.map((unit) => `Stale unit: ${unit.unitId}`),
        units,
        items,
    };
    return { ...payload, reportHash: sha256(canonicalJson(payload)) };
}
function buildKnowledgeReport(input, note, target) {
    const evaluated = evaluateReferences(input, note.evidence);
    const payload = {
        schemaVersion: 1,
        studyId: input.studyId,
        noteId: note.id,
        claimType: note.claimType,
        previousIdentities: evaluated.previousIdentities,
        targetIdentity: target,
        status: evaluated.status,
        waitingForUa: evaluated.waitingForUa,
        reasons: evaluated.reasons,
    };
    return { ...payload, reportHash: sha256(canonicalJson(payload)) };
}
function discoverCourseIds(studiesRoot, studyId) {
    const coursesRoot = getStudyPaths(studiesRoot, studyId).courses;
    if (!existsSync(coursesRoot))
        return [];
    return readdirSync(coursesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => StableId.parse(entry.name))
        .sort((left, right) => left.localeCompare(right));
}
function reportPath(studiesRoot, studyId, report) {
    const targetAnalysis = report.targetIdentity.analysisId ?? "none";
    return join(getCoursePaths(studiesRoot, studyId, report.courseId).root, "freshness", `${report.targetIdentity.snapshotId}--${targetAnalysis}.json`);
}
function knowledgeReportPath(studiesRoot, studyId, report) {
    const targetAnalysis = report.targetIdentity.analysisId ?? "none";
    return join(getKnowledgeNotePaths(studiesRoot, studyId, report.noteId).root, "freshness", `${report.targetIdentity.snapshotId}--${targetAnalysis}.json`);
}
function applyReport(studiesRoot, studyId, report) {
    if (report.status === "fresh")
        return [];
    const transitions = [];
    let course = readCourse(studiesRoot, studyId, report.courseId);
    // A pinned-history course cites an old commit on purpose. The report above is
    // still written, because "how far behind is it" stays worth knowing, but
    // acting on it would mark the course stale every single audit forever, and a
    // warning that can never be cleared trains the reader to ignore all of them.
    if (course.currency === "pinned-history")
        return transitions;
    if (course.status === "active") {
        course = updateCourseStatus(studiesRoot, studyId, course.id, "stale");
        transitions.push({ kind: "course", courseId: course.id, from: "active", to: "stale" });
    }
    if (course.status !== "stale")
        return transitions;
    for (const unitReport of report.units) {
        if (unitReport.status !== "stale")
            continue;
        const unit = readUnit(studiesRoot, studyId, course.id, unitReport.unitId);
        if (unit.status !== "active")
            continue;
        updateUnitStatus(studiesRoot, studyId, course.id, unit.id, "stale");
        transitions.push({
            kind: "unit",
            courseId: course.id,
            unitId: unit.id,
            from: "active",
            to: "stale",
        });
    }
    return transitions;
}
function applyKnowledgeReport(input, report) {
    if (report.status === "fresh")
        return [];
    const latest = readLatestKnowledgeNote(input.studiesRoot, input.studyId, report.noteId).note;
    if (latest.status !== "active")
        return [];
    const result = markKnowledgeNoteStale({
        studiesRoot: input.studiesRoot,
        studyId: input.studyId,
        noteId: report.noteId,
        reportHash: report.reportHash,
        now: input.now,
    });
    if (!result.transitioned)
        return [];
    return [
        {
            kind: "note",
            noteId: report.noteId,
            reportHash: report.reportHash,
            from: "active",
            to: "stale",
        },
    ];
}
export function auditStudyFreshness(input) {
    const sourceStatus = inspectSourceStatus(input.studiesRoot, input.studyId);
    const target = targetIdentity(input);
    const reports = discoverCourseIds(input.studiesRoot, input.studyId).map((courseId) => {
        const report = buildCourseReport(input, courseId, target);
        writeJsonAtomically(reportPath(input.studiesRoot, input.studyId, report), report);
        return report;
    });
    const noteReports = [...listKnowledgeNotes(input.studiesRoot, input.studyId)]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((note) => {
        const report = buildKnowledgeReport(input, note, target);
        writeJsonAtomically(knowledgeReportPath(input.studiesRoot, input.studyId, report), report);
        return report;
    });
    const transitions = input.apply
        ? [
            ...reports.flatMap((report) => applyReport(input.studiesRoot, input.studyId, report)),
            ...noteReports.flatMap((report) => applyKnowledgeReport(input, report)),
        ]
        : [];
    const finalSourceStatus = inspectSourceStatus(input.studiesRoot, input.studyId);
    if (canonicalJson(finalSourceStatus) !== canonicalJson(sourceStatus)) {
        throw new Error("Studied repository status changed while freshness was being audited");
    }
    return { sourceStatus, reports, noteReports, transitions };
}
//# sourceMappingURL=refresh-study.js.map