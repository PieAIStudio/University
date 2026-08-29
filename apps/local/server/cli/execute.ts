import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { loadUniversityLocalConfig } from "../config/load-config.js";
import { listKnowledgeNotes } from "../knowledge/repository.js";
import { rebindLocalGitSource, setDefaultCourse, setStudyStatus } from "../studies/repository.js";
import { captureKnowledge } from "../workflows/capture-knowledge.js";
import { getHostStudyStatus } from "../workflows/host-status.js";
import { backupLearner, resetLearner, restoreLearner } from "../workflows/learner.js";
import { retireUaAnalysis, verifyUaAnalysisQuality } from "../ua/adapter.js";
import {
  auditStudyRefresh,
  finalizeStudyRefresh,
  prepareStudyRefresh,
} from "../workflows/refresh-source.js";
import { addCourseLessons } from "../workflows/add-lessons.js";
import { clearAuthoringFocus, setAuthoringFocus, showAuthoringFocus } from "../workflows/focus.js";
import { createCourse } from "../workflows/create-course.js";
import {
  openCourseForEdit,
  reactivateCourse,
  reviseCourseLesson,
} from "../workflows/revise-course.js";
import {
  endLearningSession,
  inspectLearningSession,
  startLearningSession,
} from "../workflows/session.js";
import {
  applyHostExerciseGrade,
  HostExerciseGradeCliProposalSchema,
} from "../workflows/host-exercise-grade.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { getStudyPaths } from "../studies/paths.js";
import {
  setCourseCurrency,
  setCoursePrerequisites,
  setCourseTrack,
} from "../content/repository.js";
import { exportCourseRecovery, importCourseRecovery } from "../recovery/course-recovery.js";
import { readCourseClock } from "../airlock/course-clock.js";
import { inspectAirlock } from "../airlock/inspect.js";
import { promoteAirlock } from "../airlock/promote.js";
import { createStudyWithSource } from "../workflows/create-study.js";
import { reviewExpression } from "../workflows/expression-review.js";
import { buildLearningOverview } from "../workflows/learning-overview.js";
import { annotateLanguage } from "../workflows/annotate-language.js";
import {
  closeSnapshotCheckout,
  listSnapshotCheckouts,
  openSnapshotCheckout,
} from "../workflows/snapshot-checkout.js";
import { HELP, type UniversityLocalCliCommand } from "./commands.js";

const MAX_CAPTURE_FILE_BYTES = 1024 * 1024;

function readProposal(path: string, label: string): unknown {
  if (!existsSync(path)) throw new Error(`${label} proposal file does not exist: ${path}`);
  const bytes = statSync(path).size;
  if (bytes > MAX_CAPTURE_FILE_BYTES) {
    throw new Error(`${label} proposal file must not exceed ${MAX_CAPTURE_FILE_BYTES} bytes`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error(`${label} proposal must contain valid JSON: ${path}`);
  }
}

interface ExecuteCliInput {
  readonly command: UniversityLocalCliCommand;
  readonly projectRoot: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export async function executeUniversityLocalCli(input: ExecuteCliInput): Promise<unknown> {
  if (input.command.kind === "help") return { help: HELP };
  const config = loadUniversityLocalConfig({ projectRoot: input.projectRoot, env: input.env });
  switch (input.command.kind) {
    case "status":
      return getHostStudyStatus({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
      });
    case "capture":
      return captureKnowledge({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        proposal: readProposal(
          resolve(input.cwd ?? process.cwd(), input.command.inputPath),
          "Capture",
        ),
        dryRun: input.command.dryRun,
      });
    case "knowledge-list":
      return {
        schemaVersion: 1,
        operation: "knowledge-list",
        studyId: input.command.studyId,
        notes: [...listKnowledgeNotes(config.studiesRoot, input.command.studyId)]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((note) => ({
            id: note.id,
            title: note.title,
            question: note.question,
            summary: note.summary,
            tags: note.tags,
            status: note.status,
            contentRevision: note.contentRevision,
          })),
      };
    case "refresh-prepare":
      return prepareStudyRefresh({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        ...(input.command.reference ? { reference: input.command.reference } : {}),
        acknowledgeDirtyExcluded: input.command.acknowledgeDirtyExcluded,
        ...(input.command.takeover ? { takeover: true } : {}),
      });
    case "refresh-finalize":
      return finalizeStudyRefresh({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        analysisId: input.command.analysisId,
      });
    case "refresh-verify": {
      const report = verifyUaAnalysisQuality(
        config.studiesRoot,
        input.command.studyId,
        input.command.analysisId,
      );
      return {
        schemaVersion: 1,
        operation: "refresh-verify",
        studyId: input.command.studyId,
        analysisId: input.command.analysisId,
        ...report,
      };
    }
    case "refresh-retire":
      return {
        schemaVersion: 1,
        operation: "refresh-retire",
        analysis: retireUaAnalysis({
          studiesRoot: config.studiesRoot,
          studyId: input.command.studyId,
          analysisId: input.command.analysisId,
          reason: input.command.reason,
          ...(input.command.supersededBy ? { supersededBy: input.command.supersededBy } : {}),
          force: input.command.force,
        }),
      };
    case "refresh-audit":
      return auditStudyRefresh({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        snapshotId: input.command.snapshotId,
        ...(input.command.analysisId ? { analysisId: input.command.analysisId } : {}),
        apply: input.command.apply,
      });
    case "course-recovery-export":
      return exportCourseRecovery({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        outDirectory: resolve(input.cwd ?? process.cwd(), input.command.outDirectory),
      });
    case "course-recovery-import":
      return importCourseRecovery({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        inputDirectory: resolve(input.cwd ?? process.cwd(), input.command.inputDirectory),
        sourceRoot: resolve(input.cwd ?? process.cwd(), input.command.sourceRoot),
        dryRun: input.command.dryRun,
      });
    case "course-create":
      return createCourse({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        proposal: readProposal(
          resolve(input.cwd ?? process.cwd(), input.command.inputPath),
          "Course creation",
        ),
        dryRun: input.command.dryRun,
      });
    case "course-revise":
      return reviseCourseLesson({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        proposal: readProposal(
          resolve(input.cwd ?? process.cwd(), input.command.inputPath),
          "Course revision",
        ),
        dryRun: input.command.dryRun,
      });
    case "course-reactivate":
      return reactivateCourse({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        courseId: input.command.courseId,
        targetSnapshotId: input.command.snapshotId,
        ...(input.command.analysisId ? { targetAnalysisId: input.command.analysisId } : {}),
      });
    case "course-pin":
    case "course-follow": {
      const course = setCourseCurrency(
        config.studiesRoot,
        input.command.studyId,
        input.command.courseId,
        input.command.kind === "course-pin" ? "pinned-history" : "follow-ref",
      );
      return {
        schemaVersion: 1 as const,
        operation: input.command.kind,
        courseId: course.id,
        currency: course.currency,
        status: course.status,
        updatedAt: course.updatedAt,
      };
    }
    case "course-set-prerequisites": {
      const course = setCoursePrerequisites(
        config.studiesRoot,
        input.command.studyId,
        input.command.courseId,
        input.command.prerequisiteCourseIds,
      );
      return {
        schemaVersion: 1 as const,
        operation: "course-set-prerequisites" as const,
        courseId: course.id,
        prerequisiteCourseIds: course.prerequisiteCourseIds,
        updatedAt: course.updatedAt,
      };
    }
    case "course-set-track": {
      const course = setCourseTrack(
        config.studiesRoot,
        input.command.studyId,
        input.command.courseId,
        input.command.trackId,
      );
      return {
        schemaVersion: 1 as const,
        operation: "course-set-track" as const,
        courseId: course.id,
        trackId: course.trackId,
        updatedAt: course.updatedAt,
      };
    }
    case "course-set-default": {
      // A study is a shelf: every active course on it is learnable, and the
      // default only decides which one the campus opens on and which lesson
      // "today" reaches for first.
      const study = setDefaultCourse(
        config.studiesRoot,
        input.command.studyId,
        input.command.courseId,
      );
      return {
        schemaVersion: 1 as const,
        operation: "course-set-default" as const,
        studyId: study.id,
        defaultCourseId: study.defaultCourseId,
        updatedAt: study.updatedAt,
      };
    }
    case "course-add-lessons":
      return addCourseLessons({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        proposal: readProposal(
          resolve(input.cwd ?? process.cwd(), input.command.inputPath),
          "Lesson addition",
        ),
        dryRun: input.command.dryRun,
      });
    case "course-open-for-edit":
      return openCourseForEdit({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        courseId: input.command.courseId,
      });
    case "focus-set":
      return setAuthoringFocus({
        projectRoot: config.projectRoot,
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId!,
        courseIds: input.command.courseIds ?? [],
      });
    case "focus-show":
      return showAuthoringFocus(config.projectRoot);
    case "focus-clear":
      return clearAuthoringFocus(config.projectRoot);
    case "teach-next": {
      const stores = new Map<string, SqliteLearningStore>();
      try {
        const overview = buildLearningOverview({
          studiesRoot: config.studiesRoot,
          ...(config.focus ? { authoringFocus: config.focus } : {}),
          getStore: (studyId) => {
            const existing = stores.get(studyId);
            if (existing) return existing;
            const database = getStudyPaths(config.studiesRoot, studyId).learner.database;
            if (!existsSync(database)) return null;
            const store = new SqliteLearningStore(database);
            stores.set(studyId, store);
            return store;
          },
        });
        return {
          schemaVersion: 1 as const,
          operation: "teach-next" as const,
          studiesRoot: config.studiesRoot,
          ...overview,
        };
      } finally {
        for (const store of stores.values()) store.close();
      }
    }
    case "session-start":
      return startLearningSession({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        host: input.command.host,
        objective: input.command.objective,
      });
    case "session-status":
      return inspectLearningSession({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
      });
    case "session-end":
      return endLearningSession({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        ...(input.command.sessionId ? { sessionId: input.command.sessionId } : {}),
      });
    case "learner-backup":
      return await backupLearner({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
      });
    case "learner-reset":
      return await resetLearner({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        confirmStudyId: input.command.confirmStudyId,
      });
    case "learner-restore":
      return await restoreLearner({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        candidate: resolve(input.cwd ?? process.cwd(), input.command.fromPath),
      });
    case "exercise-host-grade": {
      const raw = readProposal(
        resolve(input.cwd ?? process.cwd(), input.command.inputPath),
        "Host exercise grade",
      );
      const proposal = HostExerciseGradeCliProposalSchema.parse(raw);
      const store = new SqliteLearningStore(
        getStudyPaths(config.studiesRoot, input.command.studyId).learner.database,
      );
      try {
        const result = applyHostExerciseGrade({
          studiesRoot: config.studiesRoot,
          store,
          route: {
            studyId: input.command.studyId,
            courseId: proposal.courseId,
            unitId: proposal.unitId,
            lessonId: proposal.lessonId,
            exerciseId: proposal.exerciseId,
          },
          proposal,
        });
        return {
          schemaVersion: 1 as const,
          operation: "exercise-host-grade" as const,
          studyId: input.command.studyId,
          ...result,
        };
      } finally {
        store.close();
      }
    }
    case "language-annotate":
      return annotateLanguage({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        inputPath: resolve(input.cwd ?? process.cwd(), input.command.inputPath),
      });
    case "express-review":
      return reviewExpression({
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId,
        ...(input.command.limit === undefined ? {} : { limit: input.command.limit }),
        ...(input.command.goal === undefined ? {} : { goal: input.command.goal }),
      });
    case "snapshot-list":
      return {
        schemaVersion: 1 as const,
        operation: "snapshot-list",
        studyId: input.command.studyId,
        snapshots: listSnapshotCheckouts(config.studiesRoot, input.command.studyId),
      };
    case "snapshot-open":
      return {
        schemaVersion: 1 as const,
        operation: "snapshot-open",
        studyId: input.command.studyId,
        ...openSnapshotCheckout(
          config.studiesRoot,
          input.command.studyId,
          input.command.snapshotId,
        ),
      };
    case "snapshot-close":
      return {
        schemaVersion: 1 as const,
        operation: "snapshot-close",
        studyId: input.command.studyId,
        ...closeSnapshotCheckout(
          config.studiesRoot,
          input.command.studyId,
          input.command.snapshotId,
        ),
      };
    case "study-archive":
    case "study-unarchive":
      return {
        schemaVersion: 1 as const,
        operation: input.command.kind,
        study: setStudyStatus(
          config.studiesRoot,
          input.command.studyId,
          input.command.kind === "study-archive" ? "archived" : "active",
        ),
      };
    case "study-create":
      return createStudyWithSource({
        studiesRoot: config.studiesRoot,
        id: input.command.studyId,
        title: input.command.title,
        ...(input.command.sourceRoot
          ? { sourceRoot: resolve(input.cwd ?? process.cwd(), input.command.sourceRoot) }
          : {}),
        ...(input.command.reference ? { reference: input.command.reference } : {}),
      });
    case "study-source-rebind":
      return {
        schemaVersion: 1 as const,
        operation: "study-source-rebind" as const,
        studyId: input.command.studyId,
        ...rebindLocalGitSource(
          config.studiesRoot,
          input.command.studyId,
          resolve(input.cwd ?? process.cwd(), input.command.sourceRoot),
          input.command.reference,
        ),
      };
    case "airlock-promote":
      return promoteAirlock({
        airlockRoot: resolve(input.cwd ?? process.cwd(), input.command.airlockRoot),
        upstreamRoot: resolve(input.cwd ?? process.cwd(), input.command.upstreamRoot),
        studiesRoot: config.studiesRoot,
        ...(input.command.reference ? { reference: input.command.reference } : {}),
        ...(input.command.acknowledgeDirtyExcluded ? { acknowledgeDirtyExcluded: true } : {}),
      });
    case "airlock-doctor":
    case "airlock-status": {
      const inspection = inspectAirlock(
        resolve(input.cwd ?? process.cwd(), input.command.airlockRoot),
      );
      // `doctor` is a gate and `status` is a report. They read the same state,
      // so they share one implementation and differ only in whether a problem
      // is allowed to pass silently.
      if (input.command.kind === "airlock-doctor" && inspection.verdict === "blocked") {
        throw new Error(["airlock 未通过检查：", ...inspection.problems].join("\n  - "));
      }
      // The third clock only exists when a study is named: the airlock has no
      // idea which shelf, if any, is being taught from it.
      const course = input.command.studyId
        ? readCourseClock(config.studiesRoot, input.command.studyId, inspection.seal.promotedCommit)
        : null;
      return {
        schemaVersion: 1 as const,
        operation: input.command.kind,
        verdict: inspection.verdict,
        problems: inspection.problems,
        clocks: {
          upstream: inspection.upstream,
          airlock: {
            promotedCommit: inspection.seal.promotedCommit,
            promotedAt: inspection.seal.promotedAt,
            allowedRef: inspection.seal.allowedRef,
          },
          course,
        },
        seal: inspection.seal,
      };
    }
  }
}
