---
id: REF-LEARNING-WORKFLOW-ISSUES-ISLAND-LOOK-JUDGE-READY-CHECK-REQUIRES-MATERIAL-MAP-ON-THE-AERIAL-PLATE
title: "Island look judge ready-check requires material.map on the aerial plate"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-27
last_reviewed: 2026-08-27
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

# Island look judge ready-check requires material.map on the aerial plate

## Guidance

Symptom: e2e/J.island-look hangs in waitForLookReady for 150s with no WebGL error. Root cause: look-metrics aerialPlateReady() only becomes true when the mesh named island-look-aerial-plate has material.map.image with width and height. Replacing the MeshBasicMaterial with a ShaderMaterial that samples the texture through a uniform leaves .map undefined, so the judge never sees the plate. Fix: keep assigning the loaded texture to material.map (even on ShaderMaterial) in addition to the shader uniform. Prevention: do not change that mesh's material type without keeping a real Texture on .map; the probe is in look-metrics.ts and must not be edited to make a look change pass.

## Applies When

- Changing the aerial plate material, shader, or texture loading in `packages/world`.
- Diagnosing a silent 150s hang in `pnpm e2e:island-look` at `waitForLookReady`.
