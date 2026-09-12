---
id: REF-LEARNING-WORKFLOW-ISSUES-A-KEYED-LEARNING-ACTIVITY-LOSES-THE-SELECTED-DIFFICULTY-ON-SCENARIO-CHANGE
title: "A keyed learning activity loses the selected difficulty on scenario change"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-12
last_reviewed: 2026-09-12
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

# A keyed learning activity loses the selected difficulty on scenario change

## Guidance

Symptom: after choosing practice or challenge, changing the activity mode or scenario silently returns to intro; advanced controls and tools disappear. Root cause: the host keys and remounts the activity payload while the child initializes difficulty from null, so child-local selection is discarded. Fix: pass the host-selected difficulty as the child's initialDifficulty when the host owns the selection. Prevention: add a cross-payload unit test and a browser path that changes scenario after selecting an advanced level.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
