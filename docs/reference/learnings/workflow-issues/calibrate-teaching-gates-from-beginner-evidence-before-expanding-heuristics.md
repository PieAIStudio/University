---
id: REF-LEARNING-WORKFLOW-ISSUES-CALIBRATE-TEACHING-GATES-FROM-BEGINNER-EVIDENCE-BEFORE-EXPANDING-HEURISTICS
title: "Calibrate teaching gates from beginner evidence before expanding heuristics"
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

# Calibrate teaching gates from beginner evidence before expanding heuristics

## Guidance

When extending a course-proposal gate beyond structure, measure thresholds against real beginner-review counterexamples and positive controls first. Keep lexical teaching checks conservative and explainable: derive candidate terms from author-provided definition shapes, keep synonym-drift pairs in additive data, and expose each check's skip cost. This avoids turning uncertain jargon detection into a noisy hard gate that authors will bypass; use a small model or explicit author annotations later for the known blind spot of unmarked terms.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
