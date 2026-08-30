---
id: REF-LEARNING-WORKFLOW-ISSUES-CAPTURE-PROVIDER-USAGE-AT-THE-STRUCTURED-GRADING-SEAM-WITHOUT-CHANGING-GRADING-B
title: "Capture provider usage at the structured grading seam without changing grading behavior"
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

# Capture provider usage at the structured grading seam without changing grading behavior

## Guidance

When structured grading needs provider cost evidence, wrap the injected transport per call and retain the provider result before structured-output parsing; expose a separate enriched result while preserving the existing grade() contract for callers. Record only a whitelist ledger entry after commit or refund, keep missing usage as unknown/null instead of estimating it, and swallow ledger adapter errors so telemetry cannot alter grading or settlement. Apply this whenever an existing metered grading seam needs usage accounting without learner-visible behavior or backend coupling.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
