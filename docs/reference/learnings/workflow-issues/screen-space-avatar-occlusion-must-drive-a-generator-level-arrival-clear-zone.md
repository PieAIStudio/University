---
id: REF-LEARNING-WORKFLOW-ISSUES-SCREEN-SPACE-AVATAR-OCCLUSION-MUST-DRIVE-A-GENERATOR-LEVEL-ARRIVAL-CLEAR-ZONE
title: "Screen-space avatar occlusion must drive a generator-level arrival clear zone"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-29
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

# Screen-space avatar occlusion must drive a generator-level arrival clear zone

## Guidance

When a tightened course camera places the live avatar near an island edge, the symptom can be a visible avatar buried by repeated foreground grass even after empty sea is reduced. Measure the projected avatar bounds with a rerunnable 8x12 screen-space ray probe: count only samples whose ray reaches avatar geometry, classify a non-avatar hit at least 0.025 world units before the avatar as a blocker, and require zero blocked avatar-surface samples for the start view. The verified root cause was first-node grass placement stopping only at the ordinary node safety radius, while the diagonal edge-recovery camera left instanced grass in the camera-to-avatar corridor. The proven fix is a generator-level first-node arrival apron (keep the later node spacing unchanged), with named instanced-grass blockers and a DEV/browser metric hook so future camera changes fail visibly instead of relying on screenshots alone.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
