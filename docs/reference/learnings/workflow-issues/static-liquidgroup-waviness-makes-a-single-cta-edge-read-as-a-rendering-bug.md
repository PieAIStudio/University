---
id: REF-LEARNING-WORKFLOW-ISSUES-STATIC-LIQUIDGROUP-WAVINESS-MAKES-A-SINGLE-CTA-EDGE-READ-AS-A-RENDERING-BUG
title: "Static LiquidGroup waviness makes a single CTA edge read as a rendering bug"
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

# Static LiquidGroup waviness makes a single CTA edge read as a rendering bug

## Guidance

Verified in packages/ui/src/cta/LiquidCtaButton.tsx and the University world-map CTA screenshots: applying LiquidGroup waviness to one static rounded rectangle produced a wavy perimeter that read as a rendering defect, while the donor gooey technique is strongest when nearby shapes merge or separate. Keep waviness at 0 in the rest state, place a non-interactive LiquidGroup silhouette behind the native button, and drive only a pointer/keyboard press morph on the silhouette; leave the button box, DOM text, and focus ring untransformed. Pair this with motion=reduced and a browser hit-test/focus check whenever a single primary CTA adopts liquid feedback.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
