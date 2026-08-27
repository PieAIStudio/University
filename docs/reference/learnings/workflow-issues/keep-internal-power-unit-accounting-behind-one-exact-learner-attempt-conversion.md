---
id: REF-LEARNING-WORKFLOW-ISSUES-KEEP-INTERNAL-POWER-UNIT-ACCOUNTING-BEHIND-ONE-EXACT-LEARNER-ATTEMPT-CONVERSION
title: "Keep internal power-unit accounting behind one exact learner-attempt conversion"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-27
last_reviewed: 2026-08-27
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

# Keep internal power-unit accounting behind one exact learner-attempt conversion

## Guidance

Keep server and wallet contracts in their internal power-unit strings, but expose only complete AI grading attempts to learners. Define the per-attempt cost once in shared core and let one exact floor-division helper convert every UI, online-port, and grading-service balance; use an explicit not-enough-for-one message for remainders below the cost. This prevents the three surfaces from drifting or claiming a usable zero or rounded-up attempt whenever accounting units change.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
