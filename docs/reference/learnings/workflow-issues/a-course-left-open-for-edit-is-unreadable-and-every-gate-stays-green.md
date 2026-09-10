---
id: REF-LEARNING-WORKFLOW-ISSUES-A-COURSE-LEFT-OPEN-FOR-EDIT-IS-UNREADABLE-AND-EVERY-GATE-STAYS-GREEN
title: "A course left open for edit is unreadable, and every gate stays green"
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

# A course left open for edit is unreadable, and every gate stays green

## Guidance

Symptom: a lesson revision landed, lint-lessons was clean, check-lesson-activities said ok, the engine accepted the payload — and opening the lesson in a browser showed 「课程资料没有打开」 with no content at all. The page title resolved correctly (it even carried the NEW revision's title), so the catalogue was fine; only the body failed.

Root cause: 'course open-for-edit' moves a course and its units to status 'stale' so 'course revise' can touch them ('course revise' refuses active containers). A stale course serves no content to the reader. 'course reactivate --study <s> --course <c> --snapshot <id>' is the only way back, and nothing in the gate chain notices a course sitting in stale.

Verified: three parallel agents each revised a course and two left it stale; reactivating turned the browser check from failing to passing with no other change.

Guidance: treat reactivate as part of landing a revision, not as an optional follow-up. Sequence is open-for-edit → revise (one or many lessons) → verify → reactivate, and reactivate must come last because revise refuses an active course. When dispatching lesson work, put the reactivate command in the brief with the snapshot id filled in; agents that were not told about it will not infer it, because everything they can check is green without it.

Prevention: the browser is the only thing that sees this. A lesson-writing run that never opens the lesson cannot detect it.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
