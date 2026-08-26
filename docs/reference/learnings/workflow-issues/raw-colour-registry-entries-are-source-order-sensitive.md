---
id: REF-LEARNING-WORKFLOW-ISSUES-RAW-COLOUR-REGISTRY-ENTRIES-ARE-SOURCE-ORDER-SENSITIVE
title: "Raw-colour registry entries are source-order sensitive"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-26
last_reviewed: 2026-08-26
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

# Raw-colour registry entries are source-order sensitive

## Guidance

The raw-colour verification gate records fixed material and pending migration entries by source path, line, column, and value. Inserting even colour-free CSS before a registered occurrence makes pnpm verify report fixed registry missing and pending migration missing, and can make the pending count appear too small, although no new raw colour was added. The verified fix is to remove or move layout-only additions out of the registry-tracked source-order region; update the registry only when the colour occurrence itself changes. Apply before adding styles to a file listed by scripts/raw-colour-registry.mjs.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
