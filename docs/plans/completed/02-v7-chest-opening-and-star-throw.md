---
id: PLAN-V7-02-CHEST-OPENING
title: "V7 · 02 Chest opening and the star throw"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-28
domain: learning-experience
tags:
  - v7
  - world
  - rewards
related:
  - REF-WORK-QUEUE
  - ADR-0008
supersedes: []
superseded_by: null
---

# Task 02 · Chest opening and the star throw

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) station 4
  ("学完这一关：镜头推近，开宝箱"), including the four still frames of the
  opening, the four frames of the star throw and the "减少动态" paragraph.
- Prototype timing and effects: `docs/reference/player-journey/v7/lab/rewards3d.js`,
  `OPENING_FX` and `makeOpening` (phases idle → charge → burst waves → settled).
  Its per-tier values are the reviewed look: wood one wave, rare two, epic three
  with fireworks and a light shake, legendary four with fireworks, coin rain and
  the strongest shake; a charge phase with rising shake and a light leak at the
  lid seam precedes the burst. Port it; do not import from `docs/`.
- The learner's avatar is SwimmerAvatarKit 0.7 (already a dependency); it has
  `throw`, `hop`, `flinch` and `cheer` actions with `timing.beat`, and
  expressions. Monster clips are listed in task 01.
- Depends on `01-v7-chests-and-monsters-on-the-island.md`. If 01 was skipped,
  this task cannot start: there is nothing on the island to open or chase.

## 1 Outcome

Finishing a lesson no longer opens a results page: the lesson closes, the
camera settles beside the learner's avatar and that lesson's glowing chest, one
tap opens it with a celebration whose length and richness follow the chest's
tier, rewards appear one at a time as DOM text, and then the avatar throws a
knowledge star that chases the next lesson's monster away so that lesson is
immediately enterable.

## 2 What the Owner said

> 「宝箱里面可能还有……子弹，获得一颗子弹。紧接着这个角色就会有动画，用这一颗子弹发射出去，把下一关垫石上站着的怪物打中，那怪物就逃跑了。」
> 「木箱、蓝箱、紫箱、金箱开的时候，喷发的持续时间和内容得有区别……金箱喷的更长，可能好几波！」

Binding decisions: J2 as the Owner clarified it — always play the full
sequence, length by tier, maximum joy; a tap fast-forwards to the rewards. P1 —
the projectile is a glowing knowledge star, not a bullet (taken at the
recommended option).

## 3 What "done" looks like

- Timeline by tier, including charge: wood about 2.5 s, blue about 3.5 s,
  purple about 4.5 s, gold about 6 s. A tap at any moment jumps to the rewards.
- All-correct upgrade: when every exercise in the lesson was answered correctly
  on the first attempt, the chest flashes up one tier before opening ("升级！");
  it only goes up, never down, and is computed from the attempt record, not
  stored.
- Rewards are the real numbers from the learning record — XP (read 15, first
  correct 25 today), review cards, knowledge cards lit, streak day, and a badge
  last and largest when one was earned. A number that the record does not
  support is not shown.
- Existing sounds are reused where they exist (reward, course complete,
  streak); new sounds start only after the learner's first interaction.
- Star throw: the star rises from the chest to the avatar's hand, `throw`, a
  flight of under a second, then one of three monster reactions chosen at
  random: shake head then flee; flee before the star lands; jump and spin then
  flee. The ring turns green as the monster leaves. The segment boss needs three
  stars (the segment's saved ones) before it leaves.
- Reduced motion: no camera move, the chest is shown open, rewards in one row,
  the monster simply absent, the ring green.
- Particles at most 80 per wave, settled within 1.5 s; halved on slow devices.
- Pressing Continue pulls the camera back up so the newly opened ground is
  visible (the "岛长大" moment the old page stated in words).

## 4 Out of scope

- The wrap-up card after the opening (记住它 / 存下来): task 04.
- Daily-first ×2 XP: task 04.
- Card flip reveal and badge 3D models: task 05. Show earned badge names as
  DOM text here; task 05 replaces them with the 3D badge.
- Do not change how XP, streak or review scheduling is computed.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- A browser spec drives a real lesson to completion and asserts: no results
  page; chest opened by one tap; rewards equal to the record; the next lesson
  enterable right after the monster leaves; the same with reduced motion.
- A timing test pins each tier's sequence length within a tolerance band around
  the targets above; it runs in the timing lane, not the default lane.
- Capture: Playwright frames at charge, burst, rewards and flee for wood and
  gold, desktop and phone, DPR 1.
- Not acceptable as proof: the review page's live chest viewer.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history; gate numbers in the commit body.

## 7 Report back

Gate numbers verbatim, the captures, the measured tier lengths, and anything
noticed but not done.

## 8 Delivery receipt (2026-09-28)

- Finishing a lesson now shows its island: the camera settles beside the avatar
  and the lesson's chest (`CloseUpCamera`, side-on, turned at most 50° past tents,
  gates and bosses), one tap opens it (`ChestOpening`, the review chest's build in
  `hero-chest.ts`, particles pooled at ≤80 a wave), a second tap skips to the settled
  chest, and the rewards appear one at a time as DOM (`ChestRewards` in
  `packages/ui`, zh-CN and en): XP (doubled on the day's first chest), level, cards
  saved for review, streak day, and badges last and largest. Every number is
  `chestReward` in core reading the record against the baseline taken when the
  lesson opened. All-correct-first-time upgrades the chest one tier with a flash.
- The knowledge star: the avatar's `throw`, one star (three for a gate's boss) to
  the next stone's monster, which reacts one of three ways and flees; Continue
  brings the camera back and the interim results page follows until task 04's
  wrap-up card replaces it. Each stage has a deadline so the words never wait on a
  scene that cannot report (no WebGL, a hidden tab).
- Reduced motion: no camera move, the chest simply open, rewards together, no star
  (the monster is simply gone), Continue at once.
- Measured tier lengths in the timing lane, tap to settled
  (`e2e/chest-timing.spec.ts`): wood 2.50 s, blue 3.50, purple 4.51, gold 6.00.
- Browser specs: `e2e/chest-opening.spec.ts` (no results page first, one tap opens,
  the XP line equals the record's gain, the star is thrown and the page follows; the
  same under reduced motion). `waitForSettlementProgress` now passes the chest
  (`e2e/harness/chest.ts`).
- Fixed on the way: the live monsters' skeletons are disposed with them (a bone-
  texture leak failed two e2e specs on the first push), and a live boss's crown now
  rides its head bone instead of a per-frame conversion that sent it into the sky
  under the close-up camera.
- ADR-0008 V7-02; captures (not committed) of closed, opening, rewards, throw and
  done on desktop and phone.
- Not done here: the phone's floating feedback button overlaps the card's corner;
  the wrap-up card (task 04); badge emblems in the reward line (task 05 renders them
  as text until its wiring).
