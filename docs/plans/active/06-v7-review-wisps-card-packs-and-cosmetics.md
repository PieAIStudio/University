---
id: PLAN-V7-06-WISPS-AND-PACKS
title: "V7 · 06 Review wisps, card packs and cosmetics"
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
  - backend
related:
  - REF-WORK-QUEUE
  - ADR-0008
supersedes: []
superseded_by: null
---

# Task 06 · Review wisps, card packs and cosmetics

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html),
  "让人停不下来" mechanics 3 (card packs), 5 (wisps) and 10 (dressing up), the
  pack picture, and "还是不做的三件事".
- Wisp model: `glimmerwisp.glb` (159 KB, static, no clips) from the
  world-of-claudecraft donor described in task 01.
- Storage: cosmetics, fragments and pity counters are random outcomes and cannot
  be derived, so they must be stored — a University table in SwimmerBackend, per
  account, synced across devices; odds and pity counting run on the server,
  never in the browser. Writing the migration and its tests is in scope;
  applying it to the remote database needs the Owner's authority (see the
  [backend runbook](../../reference/execution/swimmer-backend-migration.md)).
  Stop before any remote apply and report.
- SwimmerAvatarKit already has colour, material and accessory options; this task
  adds an unlock table mapping cosmetic ids to them.
- Depends on `01-` (stones exist to host wisps) and `05-` (card faces and sets).
  If either was skipped, do the part that does not need it and record the rest.

## 1 Outcome

Cards that are about to be forgotten come back as wisps floating over lessons
already cleared, with a purple ring, and two minutes of review chases them away;
blue, purple and gold chests and a full streak week give card packs that contain
only cosmetics, with the odds and the pity rule printed on the pack page.

## 2 What the Owner said

> 「从玩家心理学出发，把手游让人上瘾的招数（包括抽卡）用在学习上……你不要介意上瘾……能增加就增加，不强求。」

Binding decisions (taken at the recommended options with the Owner's approval
of V7): O1 wisps yes; Q1 packs yes, cosmetics only.

## 3 What "done" looks like

- A wisp appears over a cleared stone when that lesson has review cards due;
  reviewing them removes it. The map's review count and the wisps agree.
- Packs hold three cosmetics each: card face, card back, avatar accessory, a
  small island ornament. Odds 70 / 22 / 7 / 1 (common / rare / epic / legendary)
  shown on the page; within ten packs at least one epic or better; within fifty
  at least one legendary; duplicates become fragments redeemable for a chosen
  item.
- Packs come only from learning: blue, purple and gold chests, the weekly boss
  (task 07) and a full streak week. There is no purchase path, no key, no paid
  currency anywhere.
- Cosmetics show on the avatar, on the island, on the avatar panel and on the
  completion card.

## 4 Out of scope

- Paid randomness of any kind, losing lives for wrong answers, guilt or fear in
  reminders — the three things V7 still refuses.
- Knowledge cards inside packs (Q3 was rejected): what you learned never
  depends on luck.
- Limited-time events (R1: later).

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Server-side tests for odds (statistical bounds over many draws), both pity
  rules, fragment exchange, and rejection of a client-supplied outcome.
- Browser spec: wisp present when cards are due, gone after review; pack page
  shows the odds text.
- Capture: island with wisps, a pack reveal, the pack page.

## 6 Delivery discipline

One task, one commit, one push; no remote migration without the Owner; stop if
the complete gate cannot go green; never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, the migration file and whether it was applied, captures.
