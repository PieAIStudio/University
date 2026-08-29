---
id: REF-LEARNING-WORKFLOW-ISSUES-STRICTMODE-LEARNER-SMOKE-TESTS-MUST-ASSERT-NON-EMPTY-DRAWN-OUTPUT
title: "StrictMode learner smoke tests must assert non-empty drawn output"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-29
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

# StrictMode learner smoke tests must assert non-empty drawn output

## Guidance

A shared learner surface can render a real DOM/SVG node yet show a blank screen under React StrictMode with no error or warning: the first mount's cleanup may dispose a memoized drawing engine and the second mount may fail to revive it. Prevent recurrence with a fast jsdom client-mount smoke test that wraps the shared surface in StrictMode, asserts named learner-visible content, and for drawing surfaces asserts the drawn payload itself (for example an SVG path's d attribute is non-empty), not just node existence. If jsdom uses a synchronous requestAnimationFrame stub for a self-scheduling animation loop, add a re-entrancy guard so the test does not recurse forever. Prove the protection by temporarily breaking at least three covered components and observing focused test failures.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
