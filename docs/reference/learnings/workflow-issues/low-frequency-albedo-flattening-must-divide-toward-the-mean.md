---
id: REF-LEARNING-WORKFLOW-ISSUES-LOW-FREQUENCY-ALBEDO-FLATTENING-MUST-DIVIDE-TOWARD-THE-MEAN
title: "Low-frequency albedo flattening must divide toward the mean"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-28
last_reviewed: 2026-08-28
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

# Low-frequency albedo flattening must divide toward the mean

## Guidance

Symptom: generated terrain albedo retained broad directional lighting after supposed low-frequency flattening. Root cause: the correction was computed as luma / blur_luma and multiplied back, so broad bright regions were amplified. Proven fix: use mean_luma / blur_luma, clamp the correction, then validate the final decoded WebP with an 8x8 luma-range check and full-resolution luminance statistics. Prevention: do not trust a model's flat-lighting prompt or the pre-encode image; inspect the final decode and run seam plus 8x8 checks whenever producing procedural terrain textures.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
