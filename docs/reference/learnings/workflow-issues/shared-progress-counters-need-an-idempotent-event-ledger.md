---
id: REF-LEARNING-WORKFLOW-ISSUES-SHARED-PROGRESS-COUNTERS-NEED-AN-IDEMPOTENT-EVENT-LEDGER
title: "Shared progress counters need an idempotent event ledger"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-25
last_reviewed: 2026-08-25
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

# Shared progress counters need an idempotent event ledger

## Guidance

When two devices independently increment a cloud-synchronised learner counter from the same snapshot, merging a scalar with max loses one device's delta. Store immutable event IDs with their amounts, merge by ID union and sum, and keep retries idempotent; use this pattern for any append-only progress total. Legacy scalar snapshots cannot reveal forked deltas, so treat them only as a compatibility baseline.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
