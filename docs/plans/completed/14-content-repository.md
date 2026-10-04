---
id: PLAN-14-CONTENT-REPOSITORY
title: "14 · Course content moves to its own repository"
type: plan
status: superseded
canonical: false
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-03
domain: execution
tags:
  - content
  - repository
  - architecture
related:
  - REF-WORK-QUEUE
  - PLAN-11-TEST-CATALOGUE
  - PLAN-13-RETIRE-OLD-COURSES
supersedes: []
superseded_by: PLAN-14-CONTENT-REPOSITORY-INTEGRATION
---

# Task 14 · Course content moves to its own repository

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md).
- Depends on `11-test-catalogue.md` (required: without it the browser suite has
  no content once the courses leave) and `13-retire-old-courses.md` (preferred, so
  the moved tree is already sorted into shipped and retired). If `13-` was stepped
  over, move the tree as it is and say so.
- **Owner revision, 2026-10-03.** Create the repository at
  `/Users/yuanfei/PieAI/UniversityCourses`. Do not read, change or move
  `/Users/yuanfei/PieAI/UniversityContent`; another Codex owns that preparation
  repository and Claude will reconcile it later. If GitHub private-repository
  creation fails for credentials, create and commit the local repository,
  record the original error and continue. Do not stop or ask for login here.
- **What is content.** Course content lives in two places today:
  - `apps/local/studies/`: about 1.7 GB on disk. Most of it is gitignored, but 69
    files are tracked. This half-tracked state is why
    `scripts/link-studies-into-worktree.mjs` exists, and why a study being
    refreshed fails verification in every other checkout.
  - `apps/local/course-proposals/`: 234 tracked files, about 73 MB. It holds:
    - `recovery/`, the packages delivery builds from;
    - `locked/`, packages kept out of delivery;
    - the retired area from task `13-`;
    - proposal JSON and authoring reports.

  Also decide where the delivery lexicon `apps/local/data/vocabulary/` belongs.
  The release build reads it.
- **Every reader and writer of that content.** All of these must use the new
  location through one configured root, not a second copy:
  - `import-courses.mjs` (`pnpm content`);
  - `check-published-catalog.mjs`, `check-export-freshness.mjs`,
    `check-content-revisions.mjs` and `pull-taxonomy.mjs`;
  - the authoring server's studies root (`university-local.config.json`,
    `UNIVERSITY_LOCAL_STUDIES_ROOT`);
  - the PRIMM production line, including its lesson/proposal write destinations
    and native-CLI apply path introduced by task `12-`. Move those destinations
    with the content repository and derive them from the same configured root,
    not a separate pipeline setting or hard-coded old directory;
  - the release build in `vercel.json`, which passes
    `--recovery-root apps/local/course-proposals/recovery` and is built locally
    where the private study sources exist.
- **Rules that stay true.**
  - Course content still has exactly one producer, the `apps/local` CLI. It now
    writes into the content repository.
  - Publishing is still a separate, gated act (ADR-0001, ADR-0002; the root
    `AGENTS.md` rules "One producer of course content" and "Local does not mean
    permanently offline").
  - The learner's own data stays in the cloud account, not in either repository.
- **Why.** The Owner wants courses out of the application repository (answer
  **S1**). Codex will afterwards produce courses in the content repository while
  this repository carries application code. The two lanes then never share a
  working tree.

## 1 Outcome

Course content lives in its own private repository. University carries only
application code and the test catalogue. Authoring, import and release all read
the content repository through one configured root. A fresh clone of University
passes verification and runs its browser suite without the content repository
present.

## 2 What the Owner said

> 「或者站位，这些课程都移到别的位置，不要移不要放在咱们这个项目里。」 (2026-10-02)

His answer to "课程内容搬到独立仓库，由 Codex 在那边做课？" was **S1**.

Interpretation:
- The content repository also serves as the archive that task `13-` refers to:
  retired courses move with the rest, with their own history from here on.
- University's history is not rewritten. Old content stays readable in its past
  commits.

## 3 Out of scope

- Rewriting or squashing University's history (a rewrite does not unpublish
  anything, and erases the undo).
- Changing any lesson, card or exercise.
- Publishing or deploying.
- Making the content repository public.

## 4 How it is judged

| Gate | Command | Baseline measured 2026-10-02 on `26a296fe` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | must stay green |
| complete | `pnpm e2e` (also run by `pre-push`) | 430 passed | must pass; count may not fall |
| timing | `pnpm e2e:timing` | 40 passed | must pass; count may not fall |

Standing floor: **pass counts may rise, never fall.**

Also required:

- **Fresh clone.** Clone University into a scratch directory with no content
  repository next to it. Install, run `pnpm verify` and the complete gate there,
  and show both outputs.
- **With content.** With the content repository at its configured location:
  - `pnpm content` imports the shipped lessons;
  - the authoring server opens a study;
  - the production line's `status` command lists its lessons;
  - the pipeline's own tests and a native dry-run prove that its writes/proposals
    target that same configured content root; preserve lesson four's contents,
    revision identities, receipts and unpublished/Owner-review state during the move;
  - the release build's dry run (`pnpm delivery:build` with the content root)
    produces an artifact that contains the shipped lessons.

  Show each one.
- **Documents updated in the same commit.** Every document that names the old
  paths: the root and `apps/local` `AGENTS.md`, `studies/README.md`, the locked
  README, the write-lesson skill and its pipeline reference, `vercel.json` notes,
  and the local-device-testing reference. A repository search for the old paths
  finds only history and lines that say they moved.
- **Creating the repository.** It is private, under the same owner as University's
  `origin`. The Owner's answer S1 authorizes creating it. If credentials prevent GitHub creation, use the Owner-authorized local
  repository fallback above and continue. Do not put a token in a file.

## 5 Delivery discipline

- One task, one commit, one push in University. The push runs the complete gate.
  The content repository gets its own first commit and, when credentials permit,
  its own private push. Record a credential-blocked remote as incomplete without
  blocking University's local integration.
- If the complete gate cannot go green: stop, keep the work committed locally,
  and write down what blocked it.
- Never force-push or rewrite history in either repository.

## 6 Report back

- Gate numbers verbatim, from both the fresh clone and the normal checkout.
- The content repository's URL, its layout, and the single configured root
  everything reads.
- Size before and after for University's working tree.
- Anything that still assumes the old layout, as candidates for later tasks.

## 7 Delivery record

Created the dedicated local repository at `/Users/yuanfei/PieAI/UniversityCourses`
with commit `90d7c34`. It contains `studies/`, `course-proposals/` (including
task 13 retired packages), and `vocabulary/`. `UniversityContent` was not read or
modified. No GitHub remote was configured: the local repository is the authorized
credential fallback and still needs Owner-side private remote setup.

The initial handoff was partial. The completed integration is recorded in
[14-content-repository-integration](14-content-repository-integration.md).
