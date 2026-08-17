# Session And Evidence Start

1. Run `pnpm university -- teach next`. This is the shared read model used by
   the UniversityLocal home page: it resolves the current focus, next lesson,
   due card, exact lesson revision/evidence, and any open session without making
   the host guess a study from directory order.
2. Use `teachingStudyId` and `nextLesson` from that receipt for continuation.
   If the user explicitly names a different study, run
   `pnpm university -- status --study <study-id>` and
   `pnpm university -- session status --study <study-id>` for that override.
   Resolve `studiesRoot` through UniversityLocal config, never from the process
   working directory.
3. Reuse the receipt's open session. When real teaching starts and none exists, run the
   command below after replacing `<current-host-id>` with the current AI host's
   stable identifier defined by that host's own documentation. Do not copy a
   host-specific default from this skill:

   ```bash
   pnpm university -- session start --study <study-id> --host <current-host-id> --objective "<one-line objective>"
   ```

   Keep `--study`, `--host`, and `--objective`; they are required by the CLI.

   Never create overlapping sessions.
4. Read the study manifest and source registration, then the exact lesson
   `artifact` and `evidence` paths returned by `teach next`. Read the referenced
   snapshot manifest before making factual claims.
5. Read [data-model.md](data-model.md) before creating or changing learning artifacts.

If a study, snapshot, or required course is missing, explain the prerequisite and offer the smallest safe next action.
