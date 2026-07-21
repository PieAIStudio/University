# Session And Evidence Start

1. Run `pnpm university -- status --study <study-id>`. Resolve `studiesRoot` through UniversityLocal config, not the process working directory.
2. Run `pnpm university -- session status --study <study-id>`.
3. Reuse an open session. When real teaching starts and none exists, run:

   ```bash
   pnpm university -- session start --study <study-id> --host grok-build --objective "<one-line objective>"
   ```

   Never create overlapping sessions.
4. Read the study manifest, source registration, exact snapshot manifest, and relevant course artifacts.
5. Read [data-model.md](data-model.md) before creating or changing learning artifacts.

If a study, snapshot, or required course is missing, explain the prerequisite and offer the smallest safe next action.
