---
id: REF-LEARNING-WORKFLOW-ISSUES-PROCEDURAL-TERRAIN-SURFACE-VARIATION-NEEDS-TOPOLOGY-AND-COLOUR-GATES
title: "Procedural terrain surface variation needs topology and colour gates"
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

# Procedural terrain surface variation needs topology and colour gates

## Guidance

When adding procedural terrain surface types, do not validate only per-surface counts or mix ratios: those scalar checks can pass while water becomes one-cell scatter or all roles collapse into near-identical colour. Keep surface orthogonal to route semantics, fail closed for route/lesson walkability, flood-fill water and require a measured minimum connected component, force a sand buffer at water-to-grass boundaries, and gate the canonical role colours by pairwise distance, luminance span, and route contrast. Apply this whenever a shared instanced grid gains a new ground type so course and world projections remain one renderer-friendly plan.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
