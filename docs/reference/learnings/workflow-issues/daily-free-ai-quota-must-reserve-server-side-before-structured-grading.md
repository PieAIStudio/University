---
id: REF-LEARNING-WORKFLOW-ISSUES-DAILY-FREE-AI-QUOTA-MUST-RESERVE-SERVER-SIDE-BEFORE-STRUCTURED-GRADING
title: "Daily free AI quota must reserve server-side before structured grading"
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

# Daily free AI quota must reserve server-side before structured grading

## Guidance

When a delivery learner gets a capped daily allowance for metered tier-two grading, do not decrement browser state or a serverless process-local counter. Have the authenticated server quote the UTC-day balance, reserve atomically with command idempotency, commit only after structured output succeeds, and refund on model or settlement failure. When reserve reports insufficient quota, the online GradingPort must catch that signal and return the existing tier-1 clue while ExerciseBlock keeps the controls enabled; when the quote has room, use a neutral free-funding disclosure and do not show wallet-balance scare copy. Apply this whenever a capped AI allowance must be shared safely across sessions and retries.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
