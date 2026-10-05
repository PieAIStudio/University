---
id: REF-LEARNING-WORKFLOW-ISSUES-PREVENT-MOBILE-OVERFLOW-FROM-CSS-GRID-MIN-CONTENT-FLOORS
title: "Prevent mobile overflow from CSS Grid min-content floors"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
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

# Prevent mobile overflow from CSS Grid min-content floors

## Guidance

Symptom: a responsive page still had document-level horizontal scrolling at 390 px even though its parent measured the viewport width. Verified root cause: CSS Grid tracks written as 1fr and nested auto tracks retained an automatic min-content floor, so immutable evidence code and long inline commit hashes forced the grid items wider than the page. Proven fix: use minmax(0, 1fr) on the responsive outer grid and any nested one-column content list, keep block code in a bounded overflow:auto panel, and add overflow-wrap:anywhere to inline code. Verify both invariants in a real narrow browser: documentElement.scrollWidth equals clientWidth, while a long code panel may have scrollWidth greater than clientWidth internally without expanding the document.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
