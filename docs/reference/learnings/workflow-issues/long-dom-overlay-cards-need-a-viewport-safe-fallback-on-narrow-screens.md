---
id: REF-LEARNING-WORKFLOW-ISSUES-LONG-DOM-OVERLAY-CARDS-NEED-A-VIEWPORT-SAFE-FALLBACK-ON-NARROW-SCREENS
title: "Long DOM overlay cards need a viewport-safe fallback on narrow screens"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-27
last_reviewed: 2026-08-27
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

# Long DOM overlay cards need a viewport-safe fallback on narrow screens

## Guidance

When a learner-facing DOM overlay grows beyond the label-placement slots on a narrow viewport, keep the control visible with a final viewport-clamped overlay position, a bounded scrollable panel, and a usable-height calculation that subtracts any fixed mobile navigation. This matters because slot exhaustion otherwise makes a real selection disappear or places its content under the tab bar. Apply it whenever responsive overlay content can grow from real course data rather than a fixed one-line label.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
