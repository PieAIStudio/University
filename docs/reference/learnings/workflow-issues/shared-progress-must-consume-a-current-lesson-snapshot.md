---
id: REF-LEARNING-WORKFLOW-ISSUES-SHARED-PROGRESS-MUST-CONSUME-A-CURRENT-LESSON-SNAPSHOT
title: "Shared progress must consume a current lesson snapshot"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-25
last_reviewed: 2026-08-25
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

Verified in the University progress read model: never derive exercisesPassed from aggregate lesson progress. Pass the current contentRevision and complete exerciseIds into progressSourceOf, then query latestExerciseAttempt(...).hostGrade.passed for every id and compare readConfirmedRevision to that same revision. Otherwise settlement writes progress=1 and the reader later asks that same aggregate field, creating a circular read/write result, while a delivery-only revision constant can reject authoring revisions. Keep an explicit incomplete exercise-list state so unloaded ids are not mistaken for a no-exercise lesson, and preserve legacy rows where readConfirmed is undefined and progress >= 1. Apply whenever shared progress serves delivery and authoring content versions.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
