---
id: REF-LEARNING-WORKFLOW-ISSUES-COURSE-VISUAL-LOD-MUST-RANK-ROUTE-PROXIMITY-AS-A-COST
title: "Course visual LOD must rank route proximity as a cost"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-02
last_reviewed: 2026-09-02
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

# Course visual LOD must rank route proximity as a cost

## Guidance

When course visual LOD scores a prop as distance*10+hash and sorts descending before truncation, it preserves the props furthest from the route. If the learner camera stands on the route, the result is an apparently empty green course even though logical props exist. Treat route distance as a cost (negative score or ascending sort), keep the deterministic hash only as a tie-breaker, add a regression assertion requiring a visible territory prop within two route hexes, and confirm the change with the real learner-camera screenshot because the distance guardrail is not visual proof.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
