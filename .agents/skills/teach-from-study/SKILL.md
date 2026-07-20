---
name: teach-from-study
description: Teach, quiz, explain, review, or build an evidence-backed lesson from a UniversityLocal study. Use when the user asks to learn a registered codebase or topic, continue a formal course, inspect an Understand Anything tour, generate exercises or cards, run a study session, review due cards, or diagnose weak areas without writing learning artifacts into the studied repository.
---

# Teach From Study

Use UniversityLocal as the campus: read a fixed source snapshot and UA map, teach from formal course artifacts, and keep learner state separate.

## Start

1. Identify the study and the user's intent: `UA tour`, `formal course`, `practice`, or `review`.
2. Run `pnpm university -- status --study <study-id>`. Resolve `studiesRoot` through UniversityLocal config; do not assume the process working directory.
3. Run `pnpm university -- session status --study <study-id>`. When real teaching starts and no session is open, run:

   ```bash
   pnpm university -- session start --study <study-id> --host grok-build --objective "<one-line objective>"
   ```

   Reuse an existing open session; never create overlapping sessions.
4. Read the selected study manifest, source registration, exact snapshot manifest, and relevant course artifacts.
5. Read [references/data-model.md](references/data-model.md) before creating or changing learning artifacts.

If the study, snapshot, or required course does not exist, explain the missing prerequisite and offer the smallest safe next action. Never analyze the live source repository in place.

## Keep the four layers distinct

- Treat source snapshots as evidence, not learning content.
- Treat UA graphs and Tour steps as machine-generated maps, not formal courses.
- Treat courses, units, lessons, exercises, and cards as teaching content owned by UniversityLocal.
- Treat progress, attempts, sessions, and FSRS state as the learner's private record.

Never present a UA Tour as an approved course. Never place course files or learner records in the studied repository.

## Teach

1. State the learning objective and prerequisite in beginner-friendly language.
2. Ask one short retrieval or prediction question before revealing the explanation when prior knowledge exists.
3. Explain with a concrete analogy, then connect it to exact source evidence.
4. Label every claim as a fact or inference. Cite snapshot, commit, source path and line range; include UA analysis/node bindings when used.
5. Use a small worked example, then ask the learner to explain or apply it.
6. Give corrective feedback without disguising uncertainty.
7. End with a concise recap and one next action.

When the user reaches a useful non-obvious insight, offer one explicit sentence: “要把这个知识点保存成笔记和复习卡吗？” If the user agrees, invoke the local `knowledge-node` skill. Do not save automatically.

Prefer one coherent concept per lesson. Do not flood a beginner with the full graph merely because it is available.

## Create learning artifacts

- Keep a course and its units as `draft` while their declared children are incomplete.
- Generate a lesson, exercise, or card as `draft` while it is still being revised; publish it by
  appending an `active` revision after evidence and relationships validate.
- Use stable IDs and append a new content revision; never overwrite a prior revision.
- Preserve a card's ID when wording changes without changing its knowledge meaning.
- Create a new card ID when the tested knowledge changes materially.
- Validate all evidence before writing content.
- Activate bottom-up: active lesson/card/exercise content, then its unit, then its course. Only an
  active course may become `study.defaultCourseId`.
- Never edit beneath an active course. Mark the course and affected unit `stale` first, append the
  revision, revalidate, then reactivate bottom-up.

Use UniversityLocal repository APIs instead of ad hoc writes so atomicity, hashes, revision order, and evidence checks remain enforced.

## Review and record

- Retrieve due cards from the study's `LearningStore`.
- Reveal the answer only after the learner attempts recall.
- Record exactly one of `Again`, `Hard`, `Good`, or `Easy` through `ts-fsrs`.
- Record exercise attempts, lesson progress, and session boundaries in the per-study SQLite database.
- Use scoped keys (`course/unit/lesson[/card|exercise]`) so identical local IDs in different courses
  cannot share progress accidentally.
- Preserve content revision and scheduler version/hash in learning events.
- Do not hand-edit FSRS dates or duplicate learner state in content files.

When the user says the session is finished, run:

```bash
pnpm university -- session end --study <study-id>
```

Report only factual counts from the returned summary. Do not infer mastery from time spent or attempt count.

## Handle source changes

Compare evidence against the new clean snapshot. Mark changed facts, inferences, missing files, or changed UA nodes as stale with reasons. Do not silently rewrite an approved lesson. Create a reviewed revision after rechecking the new evidence.

## Safety

- UniversityLocal is permanently local-only. Do not create, prepare, or invoke cloud sync or an application backend.
- Keep UA auto-update disabled; UniversityLocal owns refresh timing.
- Do not install hooks in a studied repository.
- Never modify or invoke SwimmerBackend for UniversityLocal. A future commercial `University` owns that decision separately.
- Research mature donors before implementing a new learning mechanism; reuse a maintained dependency or adapt a proven pattern after license, maintenance, security, accessibility, and fit checks.
