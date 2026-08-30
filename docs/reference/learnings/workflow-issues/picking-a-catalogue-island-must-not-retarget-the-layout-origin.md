---
id: REF-LEARNING-WORKFLOW-ISSUES-PICKING-A-CATALOGUE-ISLAND-MUST-NOT-RETARGET-THE-LAYOUT-ORIGIN
title: "Picking a catalogue island must not retarget the layout origin"
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

# Picking a catalogue island must not retarget the layout origin

## Guidance

If the world field lays every course from the focused study (first course at the origin), setNavigationFocus on pick rebuilds all 53 island positions under the pointer. That was a no-op when the scene held one project; on a catalogue field it fails e2e F (card side relative to a leftish island) and looks like the ground jumping. Open the course card from pick; change focused study only from the switcher or by entering a course URL.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
