---
id: REF-LEARNING-WORKFLOW-ISSUES-SHARED-PROGRESS-MUST-CONSUME-A-CURRENT-LESSON-SNAPSHOT
title: "Shared progress must consume a current lesson snapshot"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-25
last_reviewed: 2026-09-19
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# Shared progress must consume a current lesson snapshot

## Guidance

Verified in the University progress read model: never derive exercisesPassed from aggregate lesson progress. Pass the current contentRevision and complete exerciseIds into progressSourceOf, then query latestExerciseAttempt(...).hostGrade.passed for every id and compare readConfirmedRevision to that same revision. Otherwise settlement writes progress=1 and the reader later asks that same aggregate field, creating a circular read/write result, while a delivery-only revision constant can reject authoring revisions. Keep an explicit incomplete exercise-list state so unloaded ids are not mistaken for a no-exercise lesson, and preserve legacy rows where readConfirmed is undefined and progress >= 1. After the source is correct, re-project every screen-facing LessonProgress from that same completion result; carrying a server status or read flag forward can resurrect the old proxy in the reader or 「今天」 panel. Apply whenever shared progress serves delivery and authoring content versions.

Private/native content has the same requirement for individual exercise results,
not just the overall completion indicator. In the map-node pilot, a real Make
assessment was stored as passed, but reopening the generated lesson and pressing
“查看最新评定” showed “未定”: the immutable lesson response contained no learner
grade. On every private ContentPort read, overlay the current learner's
`latestExerciseAttempt(locator, exerciseId, contentRevision)` as `hostGrade` and
`latestSubmission`, in addition to the completion projection. Never copy another
revision's grade or mutate the native content body. The reader must still compare
the exact saved answer with the current request/run/final work before accepting
the verdict. Verified by actual close/reopen/completion/card-drop and guarded by
`apps/university/src/personal/content.test.ts`; no new AI call is needed merely to
restore an already-recorded assessment.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
