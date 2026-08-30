---
id: REF-LEARNING-WORKFLOW-ISSUES-CROSS-RENDERER-LIQUID-CTA-TRANSITIONS-NEED-A-PROJECTED-DOM-TARGET
title: "Cross-renderer liquid CTA transitions need a projected DOM target"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-30
last_reviewed: 2026-08-30
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

# Cross-renderer liquid CTA transitions need a projected DOM target

## Guidance

For a CTA that navigates from a DOM card to a WebGL marker or a later DOM progress bar, reuse the existing per-frame 3D projection to register a viewport-space target and render one transient pointer-events:none LiquidGroup overlay; start navigation in the same click, wait only a bounded grace for a late DOM target, and skip the animation when the target is off-screen or reduced motion is requested. This preserves native text, focus, and hit testing and keeps static LiquidGroup waviness at 0. Apply when adding relationship-based liquid motion across route changes.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
