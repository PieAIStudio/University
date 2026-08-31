---
id: REF-LEARNING-WORKFLOW-ISSUES-CLOSED-LOW-POLY-VOLUMES-RESTORE-DEPTH-WITHOUT-A-RUNTIME-BUDGET-INCREASE
title: "Closed low-poly volumes restore depth without a runtime budget increase"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-31
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

# Closed low-poly volumes restore depth without a runtime budget increase

## Guidance

When an aerial course scene reads like flat cloud or water plates but draw, triangle, and sampler budgets cannot grow, replace ShapeGeometry or PlaneGeometry with a closed low-poly volume and a baked vertex value ramp. Keep the shared geometry in useMemo, use one vertex-colour material, clear BoxGeometry groups, and use FrontSide for transparent closed bodies so the change stays on the existing batch path. MeshBasicMaterial plus vertexColors can carry the value cue without introducing another environment-texture sample; verify the claim with gl.info.render calls/triangles and a visible-browser frame interval. Do not try to solve this symptom by only increasing key light or AO: the flat primitive and the post-grade interaction with a shared dark swatch are the root causes.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
