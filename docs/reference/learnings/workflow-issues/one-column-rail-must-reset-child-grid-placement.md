---
id: REF-LEARNING-WORKFLOW-ISSUES-ONE-COLUMN-RAIL-MUST-RESET-CHILD-GRID-PLACEMENT
title: "One-column rail must reset child grid placement"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-26
last_reviewed: 2026-08-26
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

# One-column rail must reset child grid placement

## Guidance

Symptom: the Today first task rail collapsed to about 60px and its Chinese title wrapped one character per line. Root cause: .app-shell__aside .today-layout changed to one explicit grid column while .today-metric kept grid-column: 2, so CSS Grid created an implicit second track and squeezed the hero track. Fix: explicitly place .app-shell__aside .today-metric in grid-column: 1. Prevention: whenever a shell variant changes a shared grid's track count, audit child grid-column assignments and verify computed gridTemplateColumns in desktop and mobile browser screenshots; do not mask it with min-width.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
