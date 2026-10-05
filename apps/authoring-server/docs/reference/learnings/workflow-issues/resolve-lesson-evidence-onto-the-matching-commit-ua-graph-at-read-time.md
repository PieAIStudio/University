---
id: REF-LEARNING-WORKFLOW-ISSUES-RESOLVE-LESSON-EVIDENCE-ONTO-THE-MATCHING-COMMIT-UA-GRAPH-AT-READ-TIME
title: "Resolve lesson evidence onto the matching-commit UA graph at read time"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-16
last_reviewed: 2026-08-16
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

# Resolve lesson evidence onto the matching-commit UA graph at read time

## Guidance

Do not mint a course revision just to attach UA nodeIds to existing citations. At lesson-read time, resolve each evidence sourcePath against a ready analysis: prefer the bound analysisId, then the ready graph whose sourceCommit matches the citation, then newest-ready only if that graph skipped the file. Prefer file/document/config nodes over function children. Rewriting 41 manifests would reset completion; newest-ready alone would caption a pinned beginner course from a later commit.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
