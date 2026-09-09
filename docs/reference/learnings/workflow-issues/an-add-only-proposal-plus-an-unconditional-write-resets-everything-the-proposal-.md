---
id: REF-LEARNING-WORKFLOW-ISSUES-AN-ADD-ONLY-PROPOSAL-PLUS-AN-UNCONDITIONAL-WRITE-RESETS-EVERYTHING-THE-PROPOSAL
title: "An add-only proposal plus an unconditional write resets everything the proposal had to list"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-09
last_reviewed: 2026-09-09
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

# An add-only proposal plus an unconditional write resets everything the proposal had to list

## Guidance

Symptom: adding one interactive activity to a lesson moved all three of its cards to a new revision, which resets completion and pulls those cards out of the spaced-repetition queue, even though no card text changed. Root cause is two individually reasonable rules meeting: apps/local/server/workflows/revise-course.ts requires a revision proposal to list every existing card and exercise, because omitting one reads as deleting it, and then wrote a new revision for everything listed without ever comparing content. Together they meant no lesson's prose could be edited without resetting the review schedule of every card attached to it. Fix: build the candidate at the revision already stored and keep the stored item when the two hash alike (createCardRevision / createExerciseRevision share one unchangedFrom helper). contentHash covers contentRevision, so two revisions of identical text never hash the same — renumbering the candidate first is what makes the comparison ask about content instead of about the number. Attack-test it: edit one card's text and confirm that one moves while the untouched ones stay, or a gate that never fires looks identical from the passing side. Prevention: whenever a contract forces callers to restate things they are not changing, check what the write side does with the restated items.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
