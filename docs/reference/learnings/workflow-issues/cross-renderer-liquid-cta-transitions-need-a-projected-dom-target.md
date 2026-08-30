---
id: REF-LEARNING-WORKFLOW-ISSUES-CROSS-RENDERER-LIQUID-CTA-TRANSITIONS-NEED-A-PROJECTED-DOM-TARGET
title: "Cross-renderer liquid CTA transitions need a route-safe visual boundary"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-30
last_reviewed: 2026-08-31
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

# Cross-renderer liquid CTA transitions need a route-safe visual boundary

## Guidance

For a same-screen CTA that lands on a later DOM progress bar, register a measured viewport-space sub-rect at the filled track's leading edge and render one transient `pointer-events:none` LiquidGroup underlay; keep readable content above it and route the flight through page air. A correct WebGL/DOM projection or target coordinate is not enough for cross-screen motion: when source and target belong to different route layouts, navigate directly and defer the shared-element effect until a View Transitions design owns both snapshots. This preserves native text, focus, and hit testing, keeps static LiquidGroup waviness at 0, and prevents the flight from becoming ink over lesson copy. Apply when adding relationship-based liquid motion across route changes or same-screen progress feedback.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
