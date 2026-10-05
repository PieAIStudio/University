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
  study create --study <study-id> --title <text> [--source <absolute-path>] [--ref <git-ref>] [--locales-file <path>]
  study describe --study <study-id> --description <text> [--locales-file <path>]
  study source rebind --study <study-id> --source <absolute-path> [--ref <git-ref>]
  study archive --study <study-id>
  study retire-content --study <study-id> --input <proposal.json> --out <archive-directory> [--dry-run]
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
export class CliUsageError extends Error {
}
//# sourceMappingURL=commands.js.map