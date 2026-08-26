---
id: REF-LEARNING-WORKFLOW-ISSUES-CSS-EXTRACTION-MUST-PRESERVE-PACKAGE-FALLBACK-AND-SOURCE-ORDER
title: "CSS extraction must preserve package fallback and source order"
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

# CSS extraction must preserve package fallback and source order

## Guidance

When moving a shared component's CSS out of apps/university/src/styles.css, byte-identical declarations can still change computed styles because packages/ui/src/lesson/lesson-reader.css contains older fallback copies. Import extracted sheets after the existing shared UI CSS and order them by their original first appearance in styles.css; otherwise source-sheet can lose its expected border and host-grade__body can inherit markdown-body defaults. Prevent regressions with a Playwright computed-style snapshot covering color, background-color, font-size, font-weight, line-height, padding, margin, border, and display, compared field by field before and after.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
