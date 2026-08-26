---
id: REF-LEARNING-WORKFLOW-ISSUES-EXHAUSTIVE-REVIEW-CARD-REGISTRIES-MUST-GUARD-BOTH-SCHEDULER-AND-DUE-QUEUE
title: "Exhaustive review-card registries must guard both scheduler and due queue"
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

# Exhaustive review-card registries must guard both scheduler and due queue

## Guidance

When a shared review surface supports only some discriminated card kinds, keep one exhaustive registry keyed by the locator union and derive the supported-card type from it; route scheduler operations through one assertion helper so unsupported kinds still fail with the existing error. Also scan the due-card producer in the verification ladder against that registry: otherwise the backend can publish an unsupported kind that the shared UI rejects at runtime. The verified failure symptom was the learner queue emitting knowledge-card while the review port threw UNSUPPORTED_CARD; the proven prevention is a red source gate for that mismatch, a green gate after filtering unsupported cards from the learner queue, and a focused refusal test. Apply whenever a new review-card kind is added or an existing kind changes learner support.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
