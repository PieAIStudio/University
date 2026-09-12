---
id: REF-LEARNING-WORKFLOW-ISSUES-A-FIELD-ADDED-AFTER-A-BOUNDARYS-FIELD-LIST-IS-WRITTEN-VANISHES-SILENTLY-AT-EVERY
title: "A field added after a boundary's field list is written vanishes silently at every boundary"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-10
last_reviewed: 2026-09-10
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

# A field added after a boundary's field list is written vanishes silently at every boundary

## Guidance

Symptom: a finished feature behaves like a backlog. The eleventh learning-play game 'sort' shipped with an engine, a renderer, difficulty examples and a line in check-lesson-activities.mjs, but no line in LessonActivitySchema; every attempt to store one returned 'Invalid option: expected one of "connect"|"tune"|…', indistinguishable from a typo in the payload, and three finished lessons were recorded as decided-but-unlanded. The same omission then repeated at RecoveryLessonSchema (.strict(), the authoring transport) and PUBLIC_DTO_FIELDS.lesson (the publish allowlist), so nine landed activities reached no delivery learner while the ::play markers referencing them travelled inside content — the reader correctly rendered '找不到这个互动课件' in nine paid lessons. Root cause: an allowlist that drops unknown fields by construction is right, and is exactly why a field added to the object later is lost with no error on either side; nothing that already worked breaks, and a gate reading only the authoring copy sees nothing missing. Fix: when a payload gains a kind or a field, walk every schema on its path from disk to browser and add it to each — in this repo LessonActivitySchema, RecoveryLessonSchema, PUBLIC_DTO_FIELDS, and the leak detector's AUTHOR_ONLY_KEYS if the new field reuses a denied name. Reuse the existing schema (RecoveryLessonSchema now imports LessonActivitySchema) rather than restating the shape, because a second spelling is how the drift started. Prevention: fixing only the last boundary changes nothing observable, which is the cheapest way to discover an earlier one; and give the checks that read stored data a second pass over the published copy, since a gate that only reads the authoring side cannot see a boundary losing things.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
