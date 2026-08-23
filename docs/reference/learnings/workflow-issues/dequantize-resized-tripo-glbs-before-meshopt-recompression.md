---
id: REF-LEARNING-WORKFLOW-ISSUES-DEQUANTIZE-RESIZED-TRIPO-GLBS-BEFORE-MESHOPT-RECOMPRESSION
title: "Dequantize resized Tripo GLBs before Meshopt recompression"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-23
last_reviewed: 2026-08-23
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

# Dequantize resized Tripo GLBs before Meshopt recompression

## Guidance

Symptom: a quantized Tripo GLB processed directly with @gltf-transform/cli resize followed by meshopt decoded with POSITION Y collapsed to zero, flattening the model even though the command succeeded. Verified fix: run resize, then dequantize, then meshopt. Before accepting each LOD, compare decoded bounds, vertex and triangle counts, material texture slots, extensions and orientation with the source, and run the glTF validator. Apply this whenever deriving texture-resolution LODs from quantized Tripo GLBs.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
