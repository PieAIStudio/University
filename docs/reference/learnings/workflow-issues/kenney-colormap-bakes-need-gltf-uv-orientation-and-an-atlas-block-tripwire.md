---
id: REF-LEARNING-WORKFLOW-ISSUES-KENNEY-COLORMAP-BAKES-NEED-GLTF-UV-ORIENTATION-AND-AN-ATLAS-BLOCK-TRIPWIRE
title: "Kenney colormap bakes need glTF UV orientation and an atlas-block tripwire"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-02
last_reviewed: 2026-09-02
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

# Kenney colormap bakes need glTF UV orientation and an atlas-block tripwire

## Guidance

Symptom: baked Kenney grid props rendered black even though the donor UV sweep reported zero cross-colour triangles. Root cause: the sweep used (1-v) against glTF's top-row v=0 convention, sampling black padding; exact RGB comparison also counted intentional gradients inside one atlas swatch as cross-colour. Proven fix: sample the PNG with direct v, audit the 64x128 Kenney atlas block boundary separately, write normalized COLOR_0 bytes, reject any triangle crossing blocks, and re-read every output to compare each vertex plus a known holiday model tripwire. Prevention: verify UV orientation against the runtime loader/spec before baking, keep a visual screenshot gate, and never average a cross-block triangle.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
