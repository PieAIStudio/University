---
id: REF-LEARNING-WORKFLOW-ISSUES-FRESH-WORKTREE-FRESHNESS-CHECKS-MUST-DISTINGUISH-SKELETON-STUDIES-FROM-INITIALIZ
title: "Fresh worktree freshness checks must distinguish skeleton studies from initialized studies"
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

# Fresh worktree freshness checks must distinguish skeleton studies from initialized studies

## Guidance

When a repository tracks an apps/local/studies README and gitignore skeleton, checking only whether the directory exists makes check-export-freshness treat every committed recovery export as a real source and fail with ENOENT. Detect at least one valid child study.json before comparing; skip only when none exists, while keeping stale-source mismatches red when initialized studies are present.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
