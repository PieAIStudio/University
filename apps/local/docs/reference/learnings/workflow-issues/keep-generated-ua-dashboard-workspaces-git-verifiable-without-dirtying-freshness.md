---
id: REF-LEARNING-WORKFLOW-ISSUES-KEEP-GENERATED-UA-DASHBOARD-WORKSPACES-GIT-VERIFIABLE-WITHOUT-DIRTYING-FRESHNESS
title: "Keep generated UA Dashboard workspaces Git-verifiable without dirtying freshness checks"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-14
last_reviewed: 2026-08-14
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

# Keep generated UA Dashboard workspaces Git-verifiable without dirtying freshness checks

## Guidance

When a local study page launches the official Understand Anything Dashboard against a finalized immutable snapshot, a source-only copied workspace is insufficient: the Dashboard's freshness check runs Git rev-parse and reports an unavailable commit. Recreating the workspace as a detached Git checkout with an alternates file pointing to UniversityLocal's immutable bare snapshot preserves commit verification without writing to the external study repository. Keep the workspace materialization marker under the .ua data path because a root-level marker is an untracked working-tree file and makes a fresh graph appear dirty. Reapply this pattern whenever a generated read-only source workspace is consumed by a Git-aware tool.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
