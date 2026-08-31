---
id: REF-LEARNING-WORKFLOW-ISSUES-MAP-CONTROL-HINTS-MUST-NAME-THE-POINTER-THAT-EXISTS
title: "Map control hints must name the pointer that exists"
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

# Map control hints must name the pointer that exists

## Guidance

A constant sentence under the map cannot tell the truth on both a mouse and a finger. This product already shipped 「右键旋转」 after rotation was locked, then 「滚轮缩放」 on phones with no wheel. Both taught the learner the app was broken. Build the hint from the pointer (coarse = pinch zoom, fine = wheel zoom), never mention a locked gesture such as right-drag, and keep a unit test that renders both pointers so the next constant lie fails in CI instead of on a walkthrough.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
