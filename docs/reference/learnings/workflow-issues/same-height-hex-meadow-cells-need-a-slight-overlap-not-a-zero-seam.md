---
id: REF-LEARNING-WORKFLOW-ISSUES-SAME-HEIGHT-HEX-MEADOW-CELLS-NEED-A-SLIGHT-OVERLAP-NOT-A-ZERO-SEAM
title: "Same-height hex meadow cells need a slight overlap, not a zero seam"
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

# Same-height hex meadow cells need a slight overlap, not a zero seam

## Guidance

Symptom: aerial course-design shots show dotted or dashed hex outlines on ordinary meadow, which read as debug wireframes. Root cause: GRID_SEAM_STRENGTH.land at 0 or a tiny positive value leaves a hairline; the 65° camera looks into that gap and sees cliff sides, or two shared edges z-fight and sparkle. LOOK-V2 §13 already asks for near-seamless same-height ground, but a zero seam is not seamless at this camera. Proven fix: give land a small negative seam (overlap, e.g. -0.02) while keeping route and detached seams positive. Darkening top-face edge vertices recreates the same outline, so keep that ramp quiet and put tile variation in cell colour instead.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
