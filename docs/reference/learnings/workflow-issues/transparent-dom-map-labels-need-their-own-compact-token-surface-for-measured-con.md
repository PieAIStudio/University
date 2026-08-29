---
id: REF-LEARNING-WORKFLOW-ISSUES-TRANSPARENT-DOM-MAP-LABELS-NEED-THEIR-OWN-COMPACT-TOKEN-SURFACE-FOR-MEASURED-CON
title: "Transparent DOM map labels need their own compact token surface for measured contrast"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-29
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

# Transparent DOM map labels need their own compact token surface for measured contrast

## Guidance

When DOM labels sit over live WebGL and the judge samples canvas pixels beneath their centers, white text with a transparent background can collapse to about 1:1 on bright terrain even when its token color is correct. Give only icon and unit labels a compact surface using existing overlay background, text, radius, and scrim tokens, remove live-canvas blur, and verify every shot and mobile viewport; avoid full plates that obscure the route.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
