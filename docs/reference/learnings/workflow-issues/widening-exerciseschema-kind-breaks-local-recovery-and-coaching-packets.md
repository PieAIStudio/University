---
id: REF-LEARNING-WORKFLOW-ISSUES-WIDENING-EXERCISESCHEMA-KIND-BREAKS-LOCAL-RECOVERY-AND-COACHING-PACKETS
title: "Widening ExerciseSchema kind breaks local recovery and coaching packets"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-21
last_reviewed: 2026-08-21
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

# Widening ExerciseSchema kind breaks local recovery and coaching packets

## Guidance

Adding a third discriminant to `ExerciseSchema` (for example `kind: "choice"`) fails TypeScript with `Property 'rubric' does not exist on type ... kind: "choice"` in `apps/local/server/recovery/course-recovery.ts` and `apps/local/server/http/views.ts`. Those sites treat `kind !== "short-answer"` as explain and read `.rubric`. Join the union only together with 3-way narrowing there, and update `CoachingPacketExercise.kind`. Until that landing, keep a sibling `ChoiceExerciseSchema` on the same `PracticeBaseSchema` rather than widening the union.

## Applies When

- Adding a new `kind` to `packages/core` `ExerciseSchema`.
- A typecheck or build of `apps/local` fails on `.rubric` after a schema change in core.
