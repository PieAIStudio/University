# Teaching Operating Contract

## Create learning artifacts

- Keep a course and its units `draft` while declared children are incomplete.
- Keep a lesson, exercise, or card `draft` while revising; append an `active` revision only after evidence and relationships validate.
- Use stable IDs and append revisions; never overwrite history.
- Preserve a card ID for wording-only changes. Create a new ID when tested knowledge changes materially.
- Activate bottom-up: lesson/card/exercise, unit, then course. Only an active course may become `study.defaultCourseId`.
- Before editing beneath an active course, mark the course and affected unit `stale`; append and validate revisions, then reactivate bottom-up.

Use UniversityLocal repository APIs so atomicity, hashes, revision order, and evidence checks remain enforced.

## Review and record

- Retrieve due cards from the study `LearningStore`; reveal answers only after recall.
- Record exactly one of `Again`, `Hard`, `Good`, or `Easy` through `ts-fsrs`.
- Record attempts, progress, and sessions in the per-study SQLite database.
- Use scoped keys (`course/unit/lesson[/card|exercise]`) and preserve content revision plus scheduler version/hash in learning events.
- Never hand-edit FSRS dates or duplicate learner state in content files.

When the user ends the session, run:

```bash
pnpm university -- session end --study <study-id>
```

Report returned facts only; time or attempt count does not prove mastery.

## Source changes

Compare evidence with the new clean snapshot. Mark changed facts, inferences, missing files, or UA nodes stale with reasons. Never silently rewrite approved content; append a reviewed revision after checking new evidence.

## Safety and donors

- UniversityLocal is permanently local-only: no cloud sync, app backend, or SwimmerBackend.
- Keep UA auto-update disabled; UniversityLocal controls refresh timing.
- Do not install hooks or write learning artifacts in the studied repository.
- Research mature donors before adding a learning mechanism; check license, maintenance, security, accessibility, data boundary, and stack fit.
