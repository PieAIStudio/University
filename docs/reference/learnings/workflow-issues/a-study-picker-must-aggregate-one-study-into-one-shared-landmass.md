---
id: REF-LEARNING-WORKFLOW-ISSUES-A-STUDY-PICKER-MUST-AGGREGATE-ONE-STUDY-INTO-ONE-SHARED-LANDMASS
title: "A study picker must aggregate one study into one shared landmass"
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

# A study picker must aggregate one study into one shared landmass

## Guidance

When a higher-level study picker reuses a course-level world grid, pulling the camera back over every course produces many unreadable specks and makes selection feedback meaningless. Keep one shared projection and palette, but aggregate exactly one measured landmass per study; size its cell target from max(minimum footprint, lesson count, course count × course weight), enforce a visible floor and a shared-field ceiling, and pack only those study envelopes. Verify the smallest real study remains clickable, the largest stays below the frame-share limit, total cells and scene GL cost are below the previous course-level baseline, and selection changes only lift/dim/focus rendering rather than layout origin. Apply this whenever a map layer changes semantic unit (study, course, lesson) without changing the underlying renderer.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
