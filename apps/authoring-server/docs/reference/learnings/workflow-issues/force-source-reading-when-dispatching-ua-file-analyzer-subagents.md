---
id: REF-LEARNING-WORKFLOW-ISSUES-FORCE-SOURCE-READING-WHEN-DISPATCHING-UA-FILE-ANALYZER-SUBAGENTS
title: "Force source reading when dispatching UA file-analyzer subagents"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-04
last_reviewed: 2026-08-04
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

# Force source reading when dispatching UA file-analyzer subagents

## Guidance

Symptom: a full Understand Anything 2.9.4 run produced 1478 of 1730 node summaries in the shape 'function NAME (path): implements a business logic fragment in this module, about N lines' — structurally valid, semantically empty, unusable for teaching. Verified root cause: a contract gap between two parts of the engine. agents/file-analyzer.md instructs the subagent to trust the structural extraction and not re-read source files, while extract-structure.mjs hands the subagent only name, startLine, endLine and params for each function — never the function body. A subagent obeying the instruction literally has nothing but a name and a line range, so a template is its only option. This is an interface mismatch, not subagent laziness, so re-running without intervention reproduces it. Proven fix: every dispatch prompt must carry an explicit override stating that the no-re-read rule applies only to re-extracting structure (names, classes, imports, which the script already provides) and that writing a summary requires reading the actual source; promote the file's own 'only re-read a file if you need deeper understanding for writing a summary' exception from optional to mandatory per file. With the override in place the template rate went from 85% to 0% across 766 files. Verify with refresh verify, which fails on a duplicate-skeleton ratio above 0.30, and check coverage separately — quality metrics cannot detect skipped files because a skipped file emits no nodes to score.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
