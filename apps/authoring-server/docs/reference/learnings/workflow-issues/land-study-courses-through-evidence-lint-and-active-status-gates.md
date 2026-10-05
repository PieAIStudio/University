---
id: REF-LEARNING-WORKFLOW-ISSUES-LAND-STUDY-COURSES-THROUGH-EVIDENCE-LINT-AND-ACTIVE-STATUS-GATES
title: "Land study courses through evidence, lint, and active-status gates"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-08
last_reviewed: 2026-08-08
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

# Land study courses through evidence, lint, and active-status gates

## Guidance

When authoring a fixed-snapshot UniversityLocal course, require the proposal evidence checker to resolve every snapshot-relative anchor, require course create --dry-run to return outcome validated before applying, run pnpm lint:lessons immediately after activation, and finish with host status showing the course active against the clean pinned snapshot. If lint finds a lesson problem, use course open-for-edit plus course revise and course reactivate rather than editing learning storage directly. This sequence catches courses that are structurally created but not actually learnable, and keeps evidence ranges tied to the studied commit.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
