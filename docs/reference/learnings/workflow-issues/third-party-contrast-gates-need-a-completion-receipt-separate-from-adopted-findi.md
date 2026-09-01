---
id: REF-LEARNING-WORKFLOW-ISSUES-THIRD-PARTY-CONTRAST-GATES-NEED-A-COMPLETION-RECEIPT-SEPARATE-FROM-ADOPTED-FINDI
title: "Third-party contrast gates need a completion receipt separate from adopted findings"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-01
last_reviewed: 2026-09-01
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

# Third-party contrast gates need a completion receipt separate from adopted findings

## Guidance

Symptom: the contrast wrapper stayed red because swimmer-ui-check exits 1 for this repository's intentional raw-colour debt. Root cause: treating every nonzero child status as an incomplete contrast scan conflated the kit's separate raw-colour rule with the two adopted rules. Verified fix: require the kit's final raw-colour summary or clean line as a positive completion receipt, accept status 1 only after that receipt, and keep below AA, undefined tokens, contrast NOT checked, crashes, signals, missing statuses, and missing receipts fail-closed. Apply when wrapping a third-party checker whose exit status covers rules that the repository intentionally governs elsewhere.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
