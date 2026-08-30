---
id: REF-LEARNING-WORKFLOW-ISSUES-INLINE-OPTIONS-OBJECTS-RETRIGGER-EXPENSIVE-ISLAND-GRASS-PLANNING-ON-FIRST-PAN
title: "Inline options objects retrigger expensive island grass planning on first pan"
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

# Inline options objects retrigger expensive island grass planning on first pan

## Guidance

IslandRender passes options={{ ...grassLook.options, safetyZones }} into IslandGrass every render. CourseIslandGrass memoized planIslandGrass on that object identity, so the first map pan (setMapInteracted) rebuilt the whole meadow: 5.0s desktop / 6.8s CPU-4x Android, CPU in latticeNoise and distanceToIslandRoute. Memoize on density/maxCount/seed/safetyZones fields, not the object. After the fix, first pan long task dropped to 348ms. Apply whenever an expensive planner is behind useMemo and the caller allocates a fresh options bag.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
