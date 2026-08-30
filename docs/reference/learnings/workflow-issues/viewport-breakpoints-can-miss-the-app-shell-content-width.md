---
id: REF-LEARNING-WORKFLOW-ISSUES-VIEWPORT-BREAKPOINTS-CAN-MISS-THE-APP-SHELL-CONTENT-WIDTH
title: "Viewport breakpoints can miss the app-shell content width"
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

# Viewport breakpoints can miss the app-shell content width

## Guidance

When an authoring panel sits inside University’s app shell, the usable `.studio-section` width can be much narrower than the browser viewport because the shell reserves rail/aside gutters. A viewport media query can therefore put two panels into cramped columns and wrap Chinese metric labels vertically. Use a named inline-size container query for panel layout, reproduce at both the effective desktop content width and a phone viewport, and verify computed widths plus screenshots before keeping the two-column layout.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
