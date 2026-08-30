---
id: REF-LEARNING-WORKFLOW-ISSUES-CUSTOM-INSTANCED-TERRAIN-BLACK-WEDGES-USUALLY-SIGNAL-TOPOLOGY-BEFORE-COLOUR
title: "Custom instanced terrain black wedges usually signal topology before colour"
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

# Custom instanced terrain black wedges usually signal topology before colour

## Guidance

When a new custom InstancedMesh terrain renders as black wedges or missing top faces, inspect triangle winding, index topology, and per-vertex attributes before changing palette or lights. In the hex-grid prototype, centre→first→second top triangles pointed normals down and an incorrect side index layout compounded it; explicit indexed top/side triangles with top winding counter-clockwise fixed the read. Verify the fix in a real browser with the intended stage canvas and a non-zero readPixels sample, because a hidden panel can leave a misleading 300x150 or blank canvas. Apply this whenever procedural geometry is introduced or visually judged.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
