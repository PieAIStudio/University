---
id: REF-LEARNING-WORKFLOW-ISSUES-PARITY-INVENTORIES-MUST-INCLUDE-INJECTED-LEARNER-CONTROLS
title: "Parity inventories must include injected learner controls"
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

# Parity inventories must include injected learner controls

## Guidance

When a cross-build UI inventory only queries known containers, a one-sided control appended elsewhere can be invisible to the test and produce a false green. Include visible controls carrying the parity marker in the inventory, then run a one-sided injection and require an exact diff such as injected-local-only; this keeps future learner-surface parity tests sensitive to new controls instead of only to today's containers.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
