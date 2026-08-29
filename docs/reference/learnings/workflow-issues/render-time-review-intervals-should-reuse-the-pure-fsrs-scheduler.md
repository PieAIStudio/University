---
id: REF-LEARNING-WORKFLOW-ISSUES-RENDER-TIME-REVIEW-INTERVALS-SHOULD-REUSE-THE-PURE-FSRS-SCHEDULER
title: "Render-time review intervals should reuse the pure FSRS scheduler"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-29
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

# Render-time review intervals should reuse the pure FSRS scheduler

## Guidance

When review buttons need to explain their consequence before submission, read the stored CardProgress.fsrs and call the shared pure review(card, rating, at) for each existing RATING. Expose that result through a read-only preview and assert the progress snapshot is unchanged; this surfaces existing scheduling information without changing gradeCard, scheduler parameters, or inventing intervals. Apply whenever learner UI needs to show the consequence of a rating before submit.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
