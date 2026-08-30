---
id: REF-LEARNING-WORKFLOW-ISSUES-PLAN-ENTITLEMENT-MUST-PRECEDE-FREE-QUOTA-AND-WALLET-FUNDING
title: "Plan entitlement must precede free quota and wallet funding"
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

# Plan entitlement must precede free quota and wallet funding

## Guidance

When a paid AI plan and a daily free quota share one grading endpoint, resolve the authenticated plan on the server before quoting or reserving the free quota or reading the wallet. A free plan may use only the atomic server-side trial quota and, when it is exhausted, must return an explicit actionable membership explanation; a paid plan must skip the free quota and use the wallet. The client should preserve the deterministic tier-one result while surfacing the refusal reason and membership action, and capability controls should remain visible with an explanation when unavailable. Apply this whenever plan-based metered AI meets a trial allowance.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
