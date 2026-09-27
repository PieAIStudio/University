---
id: PLAN-V7-05-BADGES-AND-CARDS
title: "V7 · 05 3D badges and ranks, the card album and card faces"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - rewards
  - uikit
related:
  - REF-WORK-QUEUE
  - ADR-0008
supersedes: []
superseded_by: null
---

# Task 05 · 3D badges and ranks, the card album and card faces

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 9
  ("翻翻图鉴") and 10 ("段位和徽章"), mechanics 4 (sets), 9 (a head start) and
  11 (promotion ceremony).
- Prototype models: `docs/reference/player-journey/v7/lab/badges3d.js` (`RANKS`
  stone/bronze/silver/gold/obsidian with sunburst, ring, crystal, feather wings,
  crown, ribbon; `BADGES`, 10 existing and 7 new, with frames, icons and a
  locked grey). Renderers live in `packages/world`; `packages/ui` stays free of
  `three`. A badge shown inside DOM may be a pre-rendered image produced by the
  world package's renderer, or a small canvas owned by `packages/world`.
- The knowledge card is a new SwimmerUIKit component (tilt and glare after the
  React Bits profile card; frame, outline, three-tone shading and flip rhythm
  after the Owner's card reference folder `docs/reference/卡片-参考-*`, untracked and present only on the author's machine; its prompt text asks for edge-detected even outlines, a clean gradient with slow soft light behind the rarest reveal, soft light with no hard edges, and sound synthesized after the first click). Release it
  in UIKit, consume it here.
- Measured facts: ranks are by cards remembered three weeks later — 0, 10, 50,
  150, 400; the album has 281 concepts; the 「认识 AI」 lessons currently link no
  concepts, so finishing a lesson lights no card today. Marking concepts in
  lessons is course-writing work: raise it with the write-lesson workflow, do
  not edit lessons in this task.
- Depends on none of 01–04 for its code. Independent. The badge reveal inside
  the chest opening uses task 02's reward slot when present.

## 1 Outcome

"我 → 成长" shows the five ranks and all seventeen badges as 3D emblems (grey
with "还差…" when not earned), and the album shows the learner's own cards as
tiltable, flippable cards whose frame upgrades with memory — silver when new,
purple with a gem when remembered, gold with a crown and shine after three
weeks.

## 2 What the Owner said

> 「我想让玩家用户在用这个的时候感觉很好看，然后更视觉化一些，然后点进去之后他们能复习，他们也有收集感。」
> 徽章「也照参考视频做，多设计一些，放在合适的地方」。

Binding decision M1: the seven new badges ship together with the ten existing
ones. Every badge is earned by doing something, derived from existing records,
never stored separately: 一次全对, 挑战者, 跳级, 错题清零, 自己的话 (5 lessons), 三座岛,
两条路.

## 3 What "done" looks like

- Album defaults to the domain being studied ("AI 基础 · 已集到 3 / 25"), expands
  to all 281 in one tap; cards are grouped into sets per road segment, and a
  completed set grants its limited cosmetic entitlement (the grant itself is
  recorded by task 06's store; until 06 lands, show the set as complete).
- First opening shows two cards already collected ("提示词", "AI 是什么"), so the
  first segment reads 2 / N, not 0 / N.
- After a lesson, the lesson's cards flip one at a time, rarest last with a soft
  rotating glow behind it (sound synthesized, only after first interaction).
- Tilt follows pointer; on phones it follows device orientation only after
  permission, otherwise finger drag; reduced motion disables tilt and shine.
- Renames: "课堂笔记" → "我的笔记"; "防 AI 味儿" appears only in the build-an-app
  domain; "互动课件" moves from practice to the album.
- Rank promotion: when remembered cards cross a threshold, the emblem upgrades
  once with the wings-and-spin ceremony, then sits beside the avatar.
- Badges appear in four places: largest last in the chest rewards; the rank on
  the avatar panel; the wall in "我 → 成长"; the course badge on the completion
  card.

## 4 Out of scope

- Card packs, fragments and cosmetics storage: task 06.
- Editing lessons to mark concepts.
- The menu restructuring that moves 成长 under 我: task 08. Until 08 lands, put
  the wall where 成长 lives today.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Unit tests: each of the 17 badges' derivation from records, including the
  seven new ones' edge cases; frame tier from a card's review history.
- Browser spec: album default filter, expand-all count, flip reveal order,
  reduced-motion variant; `packages/ui` still imports no `three`
  (`pnpm boundaries`).
- Capture: rank row, badge wall, three card tiers, desktop and phone.

## 6 Delivery discipline

One task, one commit, one push here (UIKit release first in its own
repository); stop if the complete gate cannot go green; never force-push or
rewrite history.

## 7 Report back

Gate numbers verbatim, UIKit version, captures, and the concept-marking request
filed for the course-writing workflow.
