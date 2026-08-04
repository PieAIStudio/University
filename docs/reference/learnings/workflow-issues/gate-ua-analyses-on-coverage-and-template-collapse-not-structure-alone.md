---
id: REF-LEARNING-WORKFLOW-ISSUES-GATE-UA-ANALYSES-ON-COVERAGE-AND-TEMPLATE-COLLAPSE-NOT-STRUCTURE-ALONE
title: "Gate UA analyses on coverage and template collapse, not structure alone"
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

# Gate UA analyses on coverage and template collapse, not structure alone

## Guidance

Symptom: two separate UA full analyses of the same snapshot were accepted as ready and both were unusable as teaching material. One had 85% of function summaries template-generated; the other silently skipped 56 of 766 files including core world-runtime logic. Verified root cause: finalizeUaAnalysis only ran assertUaGraphComplete, which checks structural integrity — unique node ids, no dangling edges, every file-level node in exactly one architecture layer, valid Tour steps. Both defective graphs satisfied every one of those checks, because neither defect is structural. Proven fix: two content gates in server/ua/quality.ts, a pure function consumed both by finalize and by the refresh verify CLI verb. Coverage compares fingerprints.json file keys against graph top-level nodes as exact set equality; both files are already read by finalize so this costs no extra IO. Identify a top-level node by id === type + colon + filePath, not by type alone, because UA emits pipeline for yml, document for md and config for others. Template collapse strips code-like tokens from each function and class summary and counts distinct remaining prose skeletons; a duplicate-skeleton ratio above 0.30 fails. Measured separation on real data: the templated analysis collapsed 964 nodes onto 40 skeletons at 0.968, the healthy one produced 965 distinct skeletons at 0.000. Critical detail: strip only code-like tokens (camelCase, snake_case, paths, digits, ALLCAPS, dotted, kebab), never all ASCII — stripping all ASCII leaves an empty skeleton for every English summary and permanently rejects any analysis run with language en.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
