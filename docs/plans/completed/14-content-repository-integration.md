---
id: PLAN-14-CONTENT-REPOSITORY-INTEGRATION
title: "14 continuation · one configured course repository"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-10-04
last_reviewed: 2026-10-04
domain: execution
tags:
  - content
  - repository
  - architecture
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 14 continuation · one configured course repository

The first delivery created `/Users/yuanfei/PieAI/UniversityCourses` but left
University's old content paths in place. This continuation completed the
approved integration before task 17 R2.

The canonical configuration is `UNIVERSITY_COURSE_ROOT`. It points at the
repository containing `studies/`, `course-proposals/` and `vocabulary/`. The
existing `UNIVERSITY_CONTENT_ROOT` remains the generated browser-content
directory used by the Vite importer; it is not a second course repository.

## Required order

1. Compare University and UniversityCourses byte-for-byte. Sync any real
   difference into UniversityCourses and commit there before changing readers.
2. Route recovery, studies, vocabulary, PRIMM writes, import/check scripts,
   author server and release build through `UNIVERSITY_COURSE_ROOT`.
3. Remove the old University content paths with `git rm`; no compatibility
   path remains in a clean University checkout.
4. Run the full gates in a fresh University clone without UniversityCourses and
   in a normal checkout with UniversityCourses configured.
5. Record both environments, counts, receipts and any deviation here and in
   `.scratch/overnight-20261003/REPORT.md`.

## Completion record · 2026-10-04

- The byte comparison found no course-content differences. University had only
  twelve ignored `.DS_Store` files absent from UniversityCourses; the external
  repository was committed at `90d7c348210b78fb0743e3ab1bbbc64461e48c05`.
- All readers and writers now derive studies, recovery, proposals and the
  vocabulary from `UNIVERSITY_COURSE_ROOT`; the generated browser directory
  remains `UNIVERSITY_CONTENT_ROOT`.
- `git rm` removed University's old `apps/local/course-proposals`,
  `apps/local/studies` and `apps/local/data/vocabulary` paths. PRIMM executable
  scripts moved to `apps/local/scripts/primm`; no compatibility content path
  remains.
- Fresh/no-content gate: `pnpm verify` passed, including `54` local test files
  and `517` tests, with content-specific checks explicitly deferred.
- Normal/with-content gate:
  `UNIVERSITY_COURSE_ROOT=/Users/yuanfei/PieAI/UniversityCourses pnpm verify`
  passed. The same `54/517` local tests and all repository gates passed while
  content checks scanned `1` study, `1` course and `3` lessons.
- A first normal-gate attempt exposed fixture leakage from the ambient course
  root; the fix makes isolated Vitest and PRIMM shelves win unless a test
  explicitly supplies a content environment. A release-boundary regression
  also keeps rejecting the deleted legacy studies path. These are recorded
  implementation fixes, not content edits.

## Push gate stop · 2026-10-04

The implementation is left in the local task-14 commit. The pre-push
browser gate ran `pnpm e2e && pnpm e2e:timing`; the e2e leg ran for 39.1 minutes,
reported `378 passed` and exited 1, so GitHub was not updated. The representative
failure was `AA.map-navigation.spec.ts:137`, waiting 45 seconds for
`.lesson-reader` after entering the selected current lesson. Running exactly
`pnpm e2e --grep 'AA authoring/zh-CN'` twice in isolation reproduced the same
failure both times (`.scratch/overnight-20261003/task14-e2e-isolated-1.log` and
`task14-e2e-isolated-2.log`). Because the isolated runs did not pass, this is
not eligible for the queue's low-load retry exception; task 17 was not started.

The historical plan remains a record of the initial repository handoff.
