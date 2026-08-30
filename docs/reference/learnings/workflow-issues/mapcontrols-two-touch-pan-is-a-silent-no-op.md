---
id: REF-LEARNING-WORKFLOW-ISSUES-MAPCONTROLS-TWO-TOUCH-PAN-IS-A-SILENT-NO-OP
title: "MapControls TWO=TOUCH.PAN is a silent no-op"
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

# MapControls TWO=TOUCH.PAN is a silent no-op

## Guidance

three.js r185 OrbitControls/MapControls only handles two-finger touches as DOLLY_PAN or DOLLY_ROTATE. Assigning touches.TWO = TOUCH.PAN looks like pan-only and falls through to state=NONE, so a two-finger map move does nothing. Measured on Pixel 5: targetDelta 7.63 with DOLLY_PAN, 0 after TWO=PAN. Keep DOLLY_PAN and deadzone the dolly half (18% finger-span) if pan must stay stable. Do not use TOUCH.PAN for two fingers.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
