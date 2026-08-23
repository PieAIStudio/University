export const HELP = `UniversityLocal local host bridge

Commands:
  status --study <study-id>
  capture --study <study-id> --input <proposal.json> [--dry-run]
  knowledge list --study <study-id>
  refresh prepare --study <study-id> [--ref <git-ref>] [--acknowledge-dirty-excluded] [--takeover]
  refresh finalize --study <study-id> --analysis <analysis-id>
  refresh verify --study <study-id> --analysis <analysis-id>
  refresh retire --study <study-id> --analysis <analysis-id> --reason <text> [--superseded-by <analysis-id>] [--force]
  refresh audit --study <study-id> --snapshot <snapshot-id> [--analysis <analysis-id>] [--apply]
  course create --study <study-id> --input <proposal.json> [--dry-run]
  course revise --study <study-id> --input <proposal.json> [--dry-run]
  course reactivate --study <study-id> --course <course-id> --snapshot <snapshot-id> [--analysis <analysis-id>]
  course set-default --study <study-id> --course <course-id>
  course pin --study <study-id> --course <course-id>
  course follow --study <study-id> --course <course-id>
  course set-prerequisites --study <study-id> --course <course-id> [--requires <course-id>[,<course-id>...]]
  course set-track --study <study-id> --course <course-id> [--track <track-id>]
  course open-for-edit --study <study-id> --course <course-id>
  course add-lessons --study <study-id> --input <proposal.json> [--dry-run]
  course recovery export --study <study-id> --out <directory>
  course recovery import --study <study-id> --input <directory> --source <git-path> [--dry-run]
  focus set --study <study-id> [--course <course-id>[,<course-id>...]]
  focus show
  focus clear
  teach next
  session start --study <study-id> --host <current-host-id> --objective <text>
  session status --study <study-id>
  session end --study <study-id> [--session <session-id>]
  snapshot list --study <study-id>
  snapshot open --study <study-id> [--snapshot <snapshot-id>]
  snapshot close --study <study-id> [--snapshot <snapshot-id>]
  study create --study <study-id> --title <text> --source <absolute-path> [--ref <git-ref>]
  study source rebind --study <study-id> --source <absolute-path> [--ref <git-ref>]
  study archive --study <study-id>
  study unarchive --study <study-id>
  airlock promote --airlock <absolute-path> --upstream <absolute-path> [--ref <git-ref>] [--acknowledge-dirty-excluded]
  airlock doctor --airlock <absolute-path> [--study <study-id>]
  airlock status --airlock <absolute-path> [--study <study-id>]
  language annotate --study <study-id> --input <overlay.json>
  express review --study <study-id> [--limit <n>] [--goal <text>]
  learner backup --study <study-id>
  learner reset --study <study-id> --confirm <study-id>
  learner restore --study <study-id> --from <exact-sqlite-path>
  exercise host-grade --study <study-id> --input <grade.json>

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
  readonly takeover?: boolean;
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

interface CourseCurrencyCommand {
  readonly kind: "course-pin" | "course-follow";
  readonly studyId: string;
  readonly courseId: string;
}

interface CourseSetPrerequisitesCommand {
  readonly kind: "course-set-prerequisites";
  readonly studyId: string;
  readonly courseId: string;
  readonly prerequisiteCourseIds: readonly string[];
}

interface CourseSetTrackCommand {
  readonly kind: "course-set-track";
  readonly studyId: string;
  readonly courseId: string;
  readonly trackId: string | null;
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

interface CourseRecoveryExportCommand {
  readonly kind: "course-recovery-export";
  readonly studyId: string;
  readonly outDirectory: string;
}

interface CourseRecoveryImportCommand {
  readonly kind: "course-recovery-import";
  readonly studyId: string;
  readonly inputDirectory: string;
  readonly sourceRoot: string;
  readonly dryRun: boolean;
}

interface FocusCommand {
  readonly kind: "focus-set" | "focus-clear" | "focus-show";
  readonly studyId?: string;
  readonly courseIds?: readonly string[];
}

interface TeachNextCommand {
  readonly kind: "teach-next";
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

interface SnapshotCheckoutCommand {
  readonly kind: "snapshot-list" | "snapshot-open" | "snapshot-close";
  readonly studyId: string;
  readonly snapshotId?: string;
}

interface StudyStatusCommand {
  readonly kind: "study-archive" | "study-unarchive";
  readonly studyId: string;
}

interface StudyCreateCommand {
  readonly kind: "study-create";
  readonly studyId: string;
  readonly title: string;
  /** Absent for a study with no repository — a 通用课 shelf. */
  readonly sourceRoot?: string;
  readonly reference?: string;
}

interface StudySourceRebindCommand {
  readonly kind: "study-source-rebind";
  readonly studyId: string;
  readonly sourceRoot: string;
  readonly reference?: string;
}

interface AirlockPromoteCommand {
  readonly kind: "airlock-promote";
  readonly airlockRoot: string;
  readonly upstreamRoot: string;
  readonly reference?: string;
  readonly acknowledgeDirtyExcluded?: boolean;
}

interface AirlockInspectCommand {
  readonly kind: "airlock-doctor" | "airlock-status";
  readonly airlockRoot: string;
  readonly studyId?: string;
}

interface LanguageAnnotateCommand {
  readonly kind: "language-annotate";
  readonly studyId: string;
  readonly inputPath: string;
}

interface ExpressReviewCommand {
  readonly kind: "express-review";
  readonly studyId: string;
  readonly limit?: number;
  readonly goal?: string;
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

interface ExerciseHostGradeCommand {
  readonly kind: "exercise-host-grade";
  readonly studyId: string;
  readonly inputPath: string;
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
  | CourseCurrencyCommand
  | CourseSetPrerequisitesCommand
  | CourseSetTrackCommand
  | CourseOpenForEditCommand
  | CourseAddLessonsCommand
  | CourseRecoveryExportCommand
  | CourseRecoveryImportCommand
  | FocusCommand
  | TeachNextCommand
  | SessionStartCommand
  | SessionStatusCommand
  | SessionEndCommand
  | LearnerBackupCommand
  | LearnerResetCommand
  | LearnerRestoreCommand
  | ExerciseHostGradeCommand
  | SnapshotCheckoutCommand
  | StudyCreateCommand
  | StudySourceRebindCommand
  | StudyStatusCommand
  | AirlockPromoteCommand
  | AirlockInspectCommand
  | ExpressReviewCommand
  | LanguageAnnotateCommand
  | HelpCommand;

export class CliUsageError extends Error {}
