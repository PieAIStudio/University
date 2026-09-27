---
id: PLAN-V7-07-WEEKLY-BOSS
title: "V7 · 07 The weekly boss"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - retention
related:
  - REF-WORK-QUEUE
  - ADR-0010
supersedes: []
superseded_by: null
---

# Task 07 · The weekly boss

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) mechanic 8
  ("每周一只大怪"). Binding decision R1: the weekly boss now; limited-time events
  later.
- Questions come from the learner's own practice pool: only exercises from
  lessons this learner finished this week, deterministic grading first (the
  grading tiers in the root router still apply). ADR-0010 still holds: the
  system never adapts difficulty by itself.
- Depends on `01-` (monster on the island) and `02-` (the throw and flee). The
  purple-chest reward and pack use `02-` and `06-`; if `06-` was skipped, give
  the chest without the pack and record it.

## 1 Outcome

Every Monday a big monster stands at the island's edge; answering five questions
drawn from what the learner studied that week chases it away and opens a purple
chest.

## 2 What the Owner said

> 「从玩家心理学出发，把手游让人上瘾的招数……用在学习上……能增加就增加，不强求。」

## 3 What "done" looks like

- The boss appears on the course island the learner studied most that week,
  on free ground at the edge, never on a path.
- Five questions, only from lessons the learner finished that week; if fewer
  than five exist, the boss does not appear that week (never pad with unlearned
  content).
- Winning plays the star throw ×3 and opens a purple chest; losing costs nothing
  and can be retried; the boss leaves on Sunday night whether beaten or not.

## 4 Out of scope

- Limited-time events and limited monsters.
- Any model-graded open question.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Unit tests: week boundaries, question selection only from this week's
  finished lessons, the under-five rule.
- Browser spec: a learner with a week of finished lessons sees the boss, beats
  it and receives the chest.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, captures, anything noticed but not done.
