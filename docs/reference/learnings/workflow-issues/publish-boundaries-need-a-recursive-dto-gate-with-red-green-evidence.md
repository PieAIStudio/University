---
id: REF-LEARNING-WORKFLOW-ISSUES-PUBLISH-BOUNDARIES-NEED-A-RECURSIVE-DTO-GATE-WITH-RED-GREEN-EVIDENCE
title: "Publish boundaries need a recursive DTO gate with red-green evidence"
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

# Publish boundaries need a recursive DTO gate with red-green evidence

## Guidance

At a publish boundary, build the customer course JSON from explicit per-shape public field lists (course, unit, lesson, card, exercise, evidence, asset, capture) and drop unknown fields by construction; do not rely on deleting a known blacklist. The delivery gate must recurse through both object keys and string values, because author-machine routes such as file-manager:<source-root> are values and camelCase names such as referenceAnswer defeat naive [^a-z] word-boundary regexes. Verify the gate by injecting one forbidden key and one forbidden value into a generated package and recording a failing test, then removing the injection and recording the passing test. Apply this whenever authoring recovery data is transformed into learner-delivery JSON.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
