---
id: REF-LEARNING-WORKFLOW-ISSUES-E2E-FIXTURES-MUST-FOLLOW-THE-RELEASED-COURSE-SHELF
title: "E2E fixtures must follow the released course shelf"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-01
last_reviewed: 2026-09-01
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

# E2E fixtures must follow the released course shelf

## Guidance

When a course is intentionally stale or retired, hardcoded Playwright course paths make unrelated structure probes fail together. Read the delivery shelf at /content/shelf.json, select a complete released lesson, assert non-empty study/course/unit/lesson IDs, and build every route from that fixture; keep assertions about structure and interaction, not a particular course's copy. Verified by the University e2e suite: the retired foundations-terrain path was absent, a live Buzz lesson was selected, and all 46 tests passed.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
