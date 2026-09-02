---
id: REF-LEARNING-WORKFLOW-ISSUES-COOL-FILL-CAN-TURN-A-NEAR-WHITE-HEX-BEVEL-NAVY
title: "Cool fill can turn a near-white hex bevel navy"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-02
last_reviewed: 2026-09-02
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

# Cool fill can turn a near-white hex bevel navy

## Guidance

Symptom: a lesson plinth or route edge renders as a distracting navy-blue band while its cream top remains correct. Verified root cause: the near-white steep face is shaded by the existing cool-fill material/light pipeline, which shifts that face blue; isolated plinth and route objects separately to distinguish the sources. Proven fix: give the lesson plinth an authored warm sandstone albedo and tint only the route bevel with a warm authored albedo, while leaving the shared road top, lights, and grade unchanged. Apply when a neutral or near-white low-poly edge turns blue only on steep faces; verify with per-object render isolation and real learner-camera screenshots.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
