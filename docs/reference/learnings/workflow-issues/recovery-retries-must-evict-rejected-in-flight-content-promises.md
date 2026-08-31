---
id: REF-LEARNING-WORKFLOW-ISSUES-RECOVERY-RETRIES-MUST-EVICT-REJECTED-IN-FLIGHT-CONTENT-PROMISES
title: "Recovery retries must evict rejected in-flight content promises"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-31
last_reviewed: 2026-08-31
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

# Recovery retries must evict rejected in-flight content promises

## Guidance

Symptom: after a course package or shelf returns HTTP 5xx, clicking the visible retry action keeps showing the same failure and never issues a successful second request. Root cause: the failed Promise remains in a session cache, so retry reads the rejected Promise again. Proven fix: delete the course cache key in the rejection handler, clear the online shelf Promise on rejection, and clear local bootstrap's shared Promise only when it is still the failed request. Prevention: every user-visible network recovery branch needs a fault-injected Playwright test that fails once, retries, and proves the real content or shelf renders.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
