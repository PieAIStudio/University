---
id: REF-LEARNING-WORKFLOW-ISSUES-GRID-PROP-DENSITY-NEEDS-CLUSTER-GEOMETRY-AND-ROUTE-VISIBLE-FLOORS
title: "Grid prop density needs cluster geometry and route-visible floors"
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

# Grid prop density needs cluster geometry and route-visible floors

## Guidance

When a learner-view grid is sparse because one cell permits only one prop, do not solve it with a flat count increase. Generate one canopy, understory, or landmark subject plus two to four ground or compact-understory attachments in the same pure planner; validate pairwise horizontal separation and the merged cell-sized AABB before returning the cluster, and select clusters atomically in the course LOD. A plan can have healthy total counts and batched cost while the camera still sees an empty lawn, so measure visiblePropsNearRoute across representative course sizes and seeds and assert both a total floor and a height > 0.6 floor. Keep role size lower bounds and reverse tripwires for tiny attachments and cross-cell offsets. Apply whenever procedural dressing density is changed on a route-based grid.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
