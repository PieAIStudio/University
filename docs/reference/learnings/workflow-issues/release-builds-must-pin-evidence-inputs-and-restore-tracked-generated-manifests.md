---
id: REF-LEARNING-WORKFLOW-ISSUES-RELEASE-BUILDS-MUST-PIN-EVIDENCE-INPUTS-AND-RESTORE-TRACKED-GENERATED-MANIFESTS
title: "Release builds must pin evidence inputs and restore tracked generated manifests"
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

# Release builds must pin evidence inputs and restore tracked generated manifests

## Guidance

Symptom: a clean clone and a machine with apps/local/studies both built successfully but produced different servedBytes and imported.json. Root cause: the importer auto-baked snippets from an ignored private checkout and rewrote a tracked generated manifest. Verified fix: the delivery lane passes tracked recovery and lexicon paths explicitly, sets UNIVERSITY_EVIDENCE_MODE=none, derives import date from HEAD, snapshots/restores tracked generated manifests, and seals release.json plus SHA256SUMS. Apply when generated content must be released from a clean clone without committing generated files.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
