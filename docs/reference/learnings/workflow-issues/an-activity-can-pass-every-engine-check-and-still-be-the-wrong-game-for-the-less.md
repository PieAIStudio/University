---
id: REF-LEARNING-WORKFLOW-ISSUES-AN-ACTIVITY-CAN-PASS-EVERY-ENGINE-CHECK-AND-STILL-BE-THE-WRONG-GAME-FOR-THE-LESS
title: "An activity can pass every engine check and still be the wrong game for the lesson"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-10
last_reviewed: 2026-09-10
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

# An activity can pass every engine check and still be the wrong game for the lesson

## Guidance

Symptom: a 决策 lesson about 「做完 ≠ 对，能验收才交出去」 was given a hunt board — a 0-10 slider for 「你能说清结果标准的程度」 with a threshold at 7, where the rule says >= 7 and the implementation does > 7. Every gate passed: isValid on the payload, the counterexample reachable in range, the citation real, the prose pointing at it, the linter clean.

Root cause: hunt requires a numeric boundary, and the lesson has no number. The scale was invented to satisfy a required field. What the board actually teaches is an off-by-one bug, which is a real lesson but not that lesson's. This is precisely the failure activities.md names: 「玩法的必填字段这节课没有对应的真事…那是为了配而配。换一种，或者不配。」

Verified: replaced with a sort board built from the lesson's own boundary — 「可以交给它」 vs 「先别交」, with the tempting bucket carrying the distinction the lesson draws between 「我没做过」 and 「我没法判断」. Same gates, all green, and now the hand motion matches what the lesson teaches.

Guidance: no mechanical check can see this, and adding one is not possible — the engines validate that a board is solvable, not that it is about the right thing. The pipeline already reserves 'a human reads one lesson per course'; that step is what catches it, and it is the only thing that does. Read the activity together with the section it follows, and ask whether the reader's hands are doing the thing the lesson is about.

Frequency observed: 1 of 26 activities in one study, produced by four parallel agents each told explicitly not to force a fit.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
