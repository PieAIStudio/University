---
id: REF-LEARNING-WORKFLOW-ISSUES-MOBILE-PLAYBACK-MUST-BRING-THE-OUTPUT-AND-ITS-CONTROLS-INTO-VIEW
title: "Mobile playback must bring the output and its controls into view"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-08
last_reviewed: 2026-09-08
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "learning-play/ProgramGame"
capture_mode: pgs-native
---

# Mobile playback must bring the output and its controls into view

## Guidance

On a 390×844 phone viewport, running a seven-command program from the bottom of a long editor left the animated board above the viewport: controls were visible in the DOM and completion passed, but the learner could not see execution. The verified fix in ProgramGame conditionally scrolls the board into view on run, keeps stop/result/status controls beside that board in the same responsive DOM tree, and returns focus to the offending repeat input when the learner chooses to edit after a collision. Apply this when a long editor switches into an animated output phase; do not duplicate the mobile renderer or force a jump when the board is already visible. Prevent regression with a real click from the end of the long editor and toBeInViewport assertions for the board and stop control during normal-motion playback, plus a collision-to-editor focus check; toBeVisible alone cannot prove visible learning feedback. Verified by e2e/P.learning-play.spec.ts and an independent 390×844 static-build walkthrough of all 12 steps.

## Applies When

- An editor grows longer than a phone viewport, then starts playback or simulation above the editing controls.
- DOM visibility checks pass while the output or its stop controls remain outside the visible viewport.
