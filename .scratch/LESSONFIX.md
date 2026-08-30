# Lesson fix report

- Date: 2026-08-31
- Branch: `work/lessonfix`
- Scope: `.scratch/BRIEF.md` and `.scratch/LESSONLOOP.md`
- Course-content guarantee: no file under `apps/local/studies/` was modified,
  created, or revisioned.

## Completed fixes

1. **Media reference**

   `write-lesson` now points to the real Mermaid renderer at
   `packages/ui/src/markdown/MermaidDiagram.tsx`.

2. **Exact opening-section gate**

   `apps/local/scripts/lint-lessons.mjs` now requires
   `openHeadings.length === shape.openCount`, rather than accepting any count
   above the minimum. The failure says `需要恰好 ... 个开场章节`.

3. **Regression fixture**

   Added two isolated fixtures under `apps/local/fixtures/lesson-lint/`:

   - `valid`: one `现象` opening section, valid detail volume, and a matching
     content hash; it exits successfully.
   - `two-openings`: two `现象` opening sections; it exits with code 1 and
     reports the exact-opening failure.

   The test copies each fixture to a temporary directory. It never uses the
   real studies shelf.

4. **Stable source-path normalization**

   Added `apps/local/scripts/lesson-pipeline-runner.mjs` and the
   `lesson:run` package command. A source path is resolved to the requested
   `studies/<study>/source/checkouts/<snapshot>/...` checkout before a model
   process starts. Checkout-relative, legacy `source/checkouts/...`, canonical
   repository-relative, and absolute forms are supported. Traversal, another
   snapshot, and symlink escapes are rejected.

5. **Child exit and model-output capture**

   The runner uses direct `spawn` with `shell: false` and resolves from the
   child's `close` event. It records the actual `exitCode`, signal, spawn
   error, timeout, and duration, without relying on zsh's reserved `status`
   variable.

   Stdout is split at the first Markdown H1: progress is forwarded separately
   and the final Markdown is never sent through the progress stream. Every
   attempt retains raw stdout, raw stderr, parsed progress/final text, and a
   `sessionResult`. Grok transport failures and timeouts receive one bounded
   retry by default; ordinary content failures do not. The runner is draft-only
   and refuses receipt/draft output inside course-study roots.

6. **Accurate SKILL path explanation**

   `write-lesson/SKILL.md` now explains that its relative link resolves to
   `apps/local/docs/reference/lesson-pedagogy.md`, not the repository-root
   `docs/reference/` directory.

## Verification

- Targeted Vitest: `scripts/lint-lessons.test.ts` and
  `scripts/lesson-pipeline-runner.test.ts` — **2 files, 9/9 tests passed**.
- CLI parsing smoke test: `pnpm lesson:run -- --help` — **passed**.
- Read-only lesson linter: `pnpm lint:lessons` — **passed, 0 lessons in the
  current real `studies/` shelf**.
- Read-only hedge check against the recorded scratch drafts — **passed**.
- Read-only anchor check was invoked for `turing-pact`; it returned exit 2
  because this worktree has no `studies/turing-pact/source/repository.git`.
  No source or lesson data was created to fake that check.
- Full `pnpm verify` — **passed** after the repository's existing prerequisite
  `pnpm --filter @pieai/university-core build` generated the ignored core build
  output. The first attempt stopped at the pre-build sibling type-resolution
  failure (`@pieai/university-core` declarations unavailable to
  `apps/university-grading`).
- After capturing the learning entry, `pnpm doc-gov scan` synchronized the
  governance manifest and `pnpm docs:check` — **passed**.
- `git diff --check` — **passed**.

## Product-owner decisions left open

- Run the new runner against real provider CLIs and a real pinned study in an
  authoring environment; this was intentionally not run because the brief
  forbids rerunning the long end-to-end pipeline and this checkout has no real
  study data.
- Decide when/how the draft-only runner should be wired to the course revision
  CLI, including receipt retention and provider-version compatibility.
- Run `check-lesson-anchors.mjs` with the actual pinned source repository when
  that study is available.

No course revision was minted, no baseline was updated, and no real course
content was changed.

## Closeout learning

Captured:
`docs/reference/learnings/workflow-issues/model-stage-wrappers-need-close-event-receipts-and-first-h1-output-separation.md`
