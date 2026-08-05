import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { loadUniversityLocalConfig } from "./config/load-config.js";
import { listKnowledgeNotes } from "./knowledge/repository.js";
import { setDefaultCourse } from "./studies/repository.js";
import { captureKnowledge } from "./workflows/capture-knowledge.js";
import { getHostStudyStatus } from "./workflows/host-status.js";
import { backupLearner, resetLearner, restoreLearner } from "./workflows/learner.js";
import { retireUaAnalysis, verifyUaAnalysisQuality } from "./ua/adapter.js";
import {
  auditStudyRefresh,
  finalizeStudyRefresh,
  prepareStudyRefresh,
} from "./workflows/refresh-source.js";
import { addCourseLessons } from "./workflows/add-lessons.js";
import { clearLearningFocus, setLearningFocus, showLearningFocus } from "./workflows/focus.js";
import { createCourse } from "./workflows/create-course.js";
import {
  CourseRevisionPartialError,
  openCourseForEdit,
  reactivateCourse,
  reviseCourseLesson,
} from "./workflows/revise-course.js";
import {
  endLearningSession,
  inspectLearningSession,
  startLearningSession,
} from "./workflows/session.js";

const MAX_CAPTURE_FILE_BYTES = 1024 * 1024;
const HELP = `UniversityLocal local host bridge

Commands:
  status --study <study-id>
  capture --study <study-id> --input <proposal.json> [--dry-run]
  knowledge list --study <study-id>
  refresh prepare --study <study-id> [--ref <git-ref>] [--acknowledge-dirty-excluded]
  refresh finalize --study <study-id> --analysis <analysis-id>
  refresh verify --study <study-id> --analysis <analysis-id>
  refresh retire --study <study-id> --analysis <analysis-id> --reason <text> [--superseded-by <analysis-id>] [--force]
  refresh audit --study <study-id> --snapshot <snapshot-id> [--analysis <analysis-id>] [--apply]
  course create --study <study-id> --input <proposal.json> [--dry-run]
  course revise --study <study-id> --input <proposal.json> [--dry-run]
  course reactivate --study <study-id> --course <course-id> --snapshot <snapshot-id> [--analysis <analysis-id>]
  course set-default --study <study-id> --course <course-id>
  course open-for-edit --study <study-id> --course <course-id>
  course add-lessons --study <study-id> --input <proposal.json> [--dry-run]
  focus set --study <study-id> [--course <course-id>[,<course-id>...]]
  focus show
  focus clear
  session start --study <study-id> --host grok-build --objective <text>
  session status --study <study-id>
  session end --study <study-id> [--session <session-id>]
  learner backup --study <study-id>
  learner reset --study <study-id> --confirm <study-id>
  learner restore --study <study-id> --from <exact-sqlite-path>

Notes:
  A local Git commit is sufficient; GitHub push is never required.
  Dirty files are excluded from snapshots and require explicit acknowledgement.
`;

interface StatusCommand {
  readonly kind: "status";
  readonly studyId: string;
}

interface CaptureCommand {
  readonly kind: "capture";
  readonly studyId: string;
  readonly inputPath: string;
  readonly dryRun: boolean;
}

interface KnowledgeListCommand {
  readonly kind: "knowledge-list";
  readonly studyId: string;
}

interface RefreshPrepareCommand {
  readonly kind: "refresh-prepare";
  readonly studyId: string;
  readonly reference?: string;
  readonly acknowledgeDirtyExcluded: boolean;
}

interface RefreshFinalizeCommand {
  readonly kind: "refresh-finalize";
  readonly studyId: string;
  readonly analysisId: string;
}

interface RefreshVerifyCommand {
  readonly kind: "refresh-verify";
  readonly studyId: string;
  readonly analysisId: string;
}

interface RefreshRetireCommand {
  readonly kind: "refresh-retire";
  readonly studyId: string;
  readonly analysisId: string;
  readonly reason: string;
  readonly supersededBy?: string;
  readonly force: boolean;
}

interface RefreshAuditCommand {
  readonly kind: "refresh-audit";
  readonly studyId: string;
  readonly snapshotId: string;
  readonly analysisId?: string;
  readonly apply: boolean;
}

interface CourseCreateCommand {
  readonly kind: "course-create";
  readonly studyId: string;
  readonly inputPath: string;
  readonly dryRun: boolean;
}

interface CourseReviseCommand {
  readonly kind: "course-revise";
  readonly studyId: string;
  readonly inputPath: string;
  readonly dryRun: boolean;
}

interface CourseReactivateCommand {
  readonly kind: "course-reactivate";
  readonly studyId: string;
  readonly courseId: string;
  readonly snapshotId: string;
  readonly analysisId?: string;
}

interface CourseSetDefaultCommand {
  readonly kind: "course-set-default";
  readonly studyId: string;
  readonly courseId: string;
}

interface CourseOpenForEditCommand {
  readonly kind: "course-open-for-edit";
  readonly studyId: string;
  readonly courseId: string;
}

interface CourseAddLessonsCommand {
  readonly kind: "course-add-lessons";
  readonly studyId: string;
  readonly inputPath: string;
  readonly dryRun: boolean;
}

interface FocusCommand {
  readonly kind: "focus-set" | "focus-clear" | "focus-show";
  readonly studyId?: string;
  readonly courseIds?: readonly string[];
}

interface SessionStartCommand {
  readonly kind: "session-start";
  readonly studyId: string;
  readonly host: string;
  readonly objective: string;
}

interface SessionStatusCommand {
  readonly kind: "session-status";
  readonly studyId: string;
}

interface SessionEndCommand {
  readonly kind: "session-end";
  readonly studyId: string;
  readonly sessionId?: string;
}

interface LearnerBackupCommand {
  readonly kind: "learner-backup";
  readonly studyId: string;
}

interface LearnerResetCommand {
  readonly kind: "learner-reset";
  readonly studyId: string;
  readonly confirmStudyId: string;
}

interface LearnerRestoreCommand {
  readonly kind: "learner-restore";
  readonly studyId: string;
  readonly fromPath: string;
}

interface HelpCommand {
  readonly kind: "help";
}

export type UniversityLocalCliCommand =
  | StatusCommand
  | CaptureCommand
  | KnowledgeListCommand
  | RefreshPrepareCommand
  | RefreshFinalizeCommand
  | RefreshVerifyCommand
  | RefreshRetireCommand
  | RefreshAuditCommand
  | CourseCreateCommand
  | CourseReviseCommand
  | CourseReactivateCommand
  | CourseSetDefaultCommand
  | CourseOpenForEditCommand
  | CourseAddLessonsCommand
  | FocusCommand
  | SessionStartCommand
  | SessionStatusCommand
  | SessionEndCommand
  | LearnerBackupCommand
  | LearnerResetCommand
  | LearnerRestoreCommand
  | HelpCommand;

export class CliUsageError extends Error {}

type ParsedValues = {
  readonly study?: string;
  readonly input?: string;
  readonly analysis?: string;
  readonly snapshot?: string;
  readonly course?: string;
  readonly ref?: string;
  readonly host?: string;
  readonly objective?: string;
  readonly session?: string;
  readonly confirm?: string;
  readonly from?: string;
  readonly reason?: string;
  readonly "superseded-by"?: string;
  readonly "dry-run"?: boolean;
  readonly apply?: boolean;
  readonly force?: boolean;
  readonly "acknowledge-dirty-excluded"?: boolean;
  readonly help?: boolean;
};

function required(value: string | undefined, option: string): string {
  if (!value) throw new CliUsageError(`Missing required option: --${option}`);
  return value;
}

function rejectUnrelatedOptions(
  values: ParsedValues,
  allowed: readonly (keyof ParsedValues)[],
): void {
  const permitted = new Set<keyof ParsedValues>([...allowed, "help"]);
  for (const [key, value] of Object.entries(values) as Array<
    [keyof ParsedValues, string | boolean | undefined]
  >) {
    if (value !== undefined && !permitted.has(key)) {
      throw new CliUsageError(`Option --${key} does not belong to this command`);
    }
  }
}

export function parseUniversityLocalCli(argv: readonly string[]): UniversityLocalCliCommand {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        study: { type: "string" },
        input: { type: "string" },
        analysis: { type: "string" },
        snapshot: { type: "string" },
        course: { type: "string" },
        ref: { type: "string" },
        host: { type: "string" },
        objective: { type: "string" },
        session: { type: "string" },
        confirm: { type: "string" },
        from: { type: "string" },
        reason: { type: "string" },
        "superseded-by": { type: "string" },
        "dry-run": { type: "boolean" },
        apply: { type: "boolean" },
        force: { type: "boolean" },
        "acknowledge-dirty-excluded": { type: "boolean" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }
  const values = parsed.values as ParsedValues;
  const positionals = parsed.positionals;
  if (values.help) return { kind: "help" };

  if (positionals.length === 1 && positionals[0] === "status") {
    rejectUnrelatedOptions(values, ["study"]);
    return { kind: "status", studyId: required(values.study, "study") };
  }
  if (positionals.length === 1 && positionals[0] === "capture") {
    rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
    return {
      kind: "capture",
      studyId: required(values.study, "study"),
      inputPath: required(values.input, "input"),
      dryRun: values["dry-run"] ?? false,
    };
  }
  if (positionals.length === 2 && positionals[0] === "knowledge" && positionals[1] === "list") {
    rejectUnrelatedOptions(values, ["study"]);
    return { kind: "knowledge-list", studyId: required(values.study, "study") };
  }
  if (positionals.length === 2 && positionals[0] === "refresh") {
    if (positionals[1] === "prepare") {
      rejectUnrelatedOptions(values, ["study", "ref", "acknowledge-dirty-excluded"]);
      return {
        kind: "refresh-prepare",
        studyId: required(values.study, "study"),
        ...(values.ref ? { reference: values.ref } : {}),
        acknowledgeDirtyExcluded: values["acknowledge-dirty-excluded"] ?? false,
      };
    }
    if (positionals[1] === "finalize") {
      rejectUnrelatedOptions(values, ["study", "analysis"]);
      return {
        kind: "refresh-finalize",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
      };
    }
    if (positionals[1] === "verify") {
      rejectUnrelatedOptions(values, ["study", "analysis"]);
      return {
        kind: "refresh-verify",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
      };
    }
    if (positionals[1] === "retire") {
      rejectUnrelatedOptions(values, ["study", "analysis", "reason", "superseded-by", "force"]);
      return {
        kind: "refresh-retire",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
        reason: required(values.reason, "reason"),
        ...(values["superseded-by"] ? { supersededBy: values["superseded-by"] } : {}),
        force: values.force ?? false,
      };
    }
    if (positionals[1] === "audit") {
      rejectUnrelatedOptions(values, ["study", "snapshot", "analysis", "apply"]);
      return {
        kind: "refresh-audit",
        studyId: required(values.study, "study"),
        snapshotId: required(values.snapshot, "snapshot"),
        ...(values.analysis ? { analysisId: values.analysis } : {}),
        apply: values.apply ?? false,
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "course") {
    if (positionals[1] === "create") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-create",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
    if (positionals[1] === "revise") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-revise",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
    if (positionals[1] === "reactivate") {
      rejectUnrelatedOptions(values, ["study", "course", "snapshot", "analysis"]);
      return {
        kind: "course-reactivate",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
        snapshotId: required(values.snapshot, "snapshot"),
        ...(values.analysis ? { analysisId: values.analysis } : {}),
      };
    }
    if (positionals[1] === "set-default") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      return {
        kind: "course-set-default",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
      };
    }
    if (positionals[1] === "open-for-edit") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      return {
        kind: "course-open-for-edit",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
      };
    }
    if (positionals[1] === "add-lessons") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-add-lessons",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "focus") {
    if (positionals[1] === "set") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      // Comma-separated because a focus is a run in order, and typing the run
      // out is the whole point: the learner is saying "these, in this order".
      const courseIds = (values.course ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      return { kind: "focus-set", studyId: required(values.study, "study"), courseIds };
    }
    if (positionals[1] === "show") {
      rejectUnrelatedOptions(values, []);
      return { kind: "focus-show" };
    }
    if (positionals[1] === "clear") {
      rejectUnrelatedOptions(values, []);
      return { kind: "focus-clear" };
    }
  }
  if (positionals.length === 2 && positionals[0] === "session") {
    if (positionals[1] === "start") {
      rejectUnrelatedOptions(values, ["study", "host", "objective"]);
      return {
        kind: "session-start",
        studyId: required(values.study, "study"),
        host: required(values.host, "host"),
        objective: required(values.objective, "objective"),
      };
    }
    if (positionals[1] === "status") {
      rejectUnrelatedOptions(values, ["study"]);
      return { kind: "session-status", studyId: required(values.study, "study") };
    }
    if (positionals[1] === "end") {
      rejectUnrelatedOptions(values, ["study", "session"]);
      return {
        kind: "session-end",
        studyId: required(values.study, "study"),
        ...(values.session ? { sessionId: values.session } : {}),
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "learner") {
    if (positionals[1] === "backup") {
      rejectUnrelatedOptions(values, ["study"]);
      return { kind: "learner-backup", studyId: required(values.study, "study") };
    }
    if (positionals[1] === "reset") {
      rejectUnrelatedOptions(values, ["study", "confirm"]);
      return {
        kind: "learner-reset",
        studyId: required(values.study, "study"),
        confirmStudyId: required(values.confirm, "confirm"),
      };
    }
    if (positionals[1] === "restore") {
      rejectUnrelatedOptions(values, ["study", "from"]);
      return {
        kind: "learner-restore",
        studyId: required(values.study, "study"),
        fromPath: required(values.from, "from"),
      };
    }
  }
  throw new CliUsageError("Unknown command or unexpected positional argument");
}

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

export interface ExecuteCliInput {
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
      return setLearningFocus({
        projectRoot: config.projectRoot,
        studiesRoot: config.studiesRoot,
        studyId: input.command.studyId!,
        courseIds: input.command.courseIds ?? [],
      });
    case "focus-show":
      return showLearningFocus(config.projectRoot);
    case "focus-clear":
      return clearLearningFocus(config.projectRoot);
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
  }
}

export interface CliIo {
  readonly stdout: { write(value: string): unknown };
  readonly stderr: { write(value: string): unknown };
}

export interface MainOptions {
  readonly projectRoot?: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly io?: CliIo;
}

export async function main(
  argv = process.argv.slice(2),
  options: MainOptions = {},
): Promise<number> {
  const io = options.io ?? process;
  try {
    const command = parseUniversityLocalCli(argv);
    if (command.kind === "help") {
      io.stdout.write(HELP);
      return 0;
    }
    const projectRoot =
      options.projectRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const result = await executeUniversityLocalCli({
      command,
      projectRoot,
      cwd: options.cwd,
      env: options.env,
    });
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (
      command.kind === "refresh-verify" &&
      result !== null &&
      typeof result === "object" &&
      "failures" in result &&
      Array.isArray((result as { failures: unknown }).failures) &&
      (result as { failures: unknown[] }).failures.length > 0
    ) {
      return 1;
    }
    return 0;
  } catch (error) {
    const usage = error instanceof CliUsageError;
    const message = error instanceof Error ? error.message : String(error);
    const busy = /\b(?:busy|locked)\b/i.test(message);
    io.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          error: message,
          ...(error instanceof CourseRevisionPartialError
            ? {
                retry: {
                  required: true,
                  proposalId: error.receipt.proposalId,
                  receipt: error.receipt,
                },
              }
            : {}),
          hint: usage
            ? "Run this command with --help to see valid UniversityLocal commands."
            : busy
              ? "Stop the UniversityLocal local server and any other process using learning.sqlite, then retry."
              : "The operation was stopped safely; inspect the message, fix the input, and retry.",
        },
        null,
        2,
      )}\n`,
    );
    return usage ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
