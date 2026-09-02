---
id: REF-LEARNING-WORKFLOW-ISSUES-GRID-PROPS-NEED-A-ONE-CELL-AABB-AND-EXACT-TERRAIN-HEIGHT-GATE
title: "Grid props need a one-cell AABB and exact terrain-height gate"
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

# Grid props need a one-cell AABB and exact terrain-height gate

## Guidance

When a placed grid prop appears as a gold or olive shard poking through a hex seam, first isolate the hex-grid-prop-fields asset group: plant_bushLarge was oversized and a thicket footprint could span a terrain height step while placement used an approximate y offset. Keep every GridPropPlacement's conservative rotated horizontal AABB at or below one cell diameter, carry groundHeight from its cell and place at cell.topY exactly, and reject or reselect feature anchors whose footprint mixes heights. Verify with pure gridPropsFitWithinCell and gridPropsRestOnCells gates plus real learner-camera screenshots; hiding the prop only masks the defect.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
