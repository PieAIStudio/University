---
id: REF-LEARNING-WORKFLOW-ISSUES-WEBGL-RECON-SCREENSHOTS-NEED-FRAME-SYNCHRONOUS-READPIXELS-VALIDATION
title: "WebGL recon screenshots need frame-synchronous readPixels validation"
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

# WebGL recon screenshots need frame-synchronous readPixels validation

## Guidance

When a WebGL canvas is rendered in a hidden or composited browser panel, readPixels sampled after the render can return an all-zero buffer even while the visible screenshot contains the scene. In verified donor reconnaissance, reopening the tab and sampling several pixels inside requestAnimationFrame after the scene settled produced non-black values. Validate screenshots with frame-synchronous readPixels, and treat an all-black post-render sample as inconclusive rather than evidence of a blank app.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
