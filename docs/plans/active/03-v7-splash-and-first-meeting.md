---
id: PLAN-V7-03-SPLASH-AND-FIRST-MEETING
title: "V7 · 03 Splash, transition screen and 涟's first meeting"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - onboarding
  - uikit
related:
  - REF-WORK-QUEUE
  - ADR-0012
supersedes: []
superseded_by: null
---

# Task 03 · Splash, transition screen and 涟's first meeting

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 1
  ("打开 App：开屏动画") and 2 ("第一次见面：涟来打招呼").
- Brand-kit-first: the splash/transition screen is a new SwimmerUIKit component
  (`/Users/yuanfei/PieAI/SwimmerUIKit`, 2.10.0 in use today), released through
  that repository's own release entry, then consumed here. University does not
  keep its own copy.
- 涟 is SwimmerNerveKit 0.4 (ADR-0012). V7 relies on two things the kit already
  has: product cards inside the panel, and a guidance walk to real places on the
  map (at most six steps; this task uses one). Do not fork the kit; if it truly
  lacks something, change it there and release.
- Learner-visible strings go through whichever i18n mechanism the repository
  uses when this task starts (`packages/ui/src/i18n` today; SwimmerI18nKit once
  its adoption lands), in zh-CN and en.
- Depends on none of 01–02. Independent.

## 1 Outcome

A newcomer opening University sees rotating true selling points over a real
loading bar, taps once to enter an island that is already complete (music may
start with that tap), is greeted only by 涟 — one question per page — and within
three taps is standing at lesson 1 with its chest pointed out.

## 2 What the Owner said

> 「它在第一次打开的时候必须出现。然后在转场的时候，如果没有卡顿就不用出现。」「点击之后……音乐就能播放起来。」
> 「如果一些选择、智能的面板都在（涟）那里面的话，就更统一了。」「分页是 OK 的呀，分页反而降低了认知负担。」
> 「你要加的第三样，在我说的那个开屏动画里面就得提及……」 (why not just ask ChatGPT)

Binding decision I1: on the web, a tap enters every time; desktop and phone
apps enter automatically when loading completes.

## 3 What "done" looks like

- Splash: two or three selling-point lines per opening, one keyword lit in each,
  rotating across visits, from V7's list of seven. The line "当下最强的几家
  AI，在这里一起用" is withheld until the delivery build's AI grading is live.
  The why-not-ChatGPT line always appears on a learner's first opening.
- The progress bar tracks real readiness: island geometry, trees, avatar
  downloaded and first frame drawn. It never sits at a fake 99%. "点一下，开始"
  appears only at 100%. The existing loading principle "不强迫任何人多看两秒"
  still holds: no deliberate delay.
- Transition screen: same look, one line and the bar, no tap; shown only when a
  scene change (planet → island, lesson → island) is still not drawn after 2 s.
- The white welcome dialog is gone. 涟's panel carries: page 1 greeting and the
  two path cards (button inside each card), "不知道选哪个？我帮你选" and
  "我用过 AI，先测一下"; page 2 appears only for "帮你选" (two fixed questions,
  rule-based, no model call); page 3 is 涟 flying to lesson 1's stone:
  "这是你的第 1 关。旁边的木箱，学完就归你。" — one step, dismissable.
  "已有账号？登录" and "直接选课" stay as small text on page 1. Returning
  learners never see this sequence.
- On a phone the two path cards stack and the panel does not cover lesson 1's
  stone.

## 4 Out of scope

- 涟's "继续第 N 关" for returning learners: task 04.
- The membership page's copy of the why-not-ChatGPT line: task 09.
- Course-duration estimates ("大约 5 周") are shown only once measured; until
  then show the lesson count.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Browser specs: first open shows the splash and no welcome dialog; the enter
  control appears only when the scene reports ready; a fast transition (<2 s)
  never shows the transition screen and a throttled one does; a newcomer reaches
  lesson 1 in at most three taps; a returning learner sees none of it.
- Capture: phone and desktop, splash mid-animation, 涟 pages 1–3.
- Existing onboarding and welcome specs that asserted the old dialog are
  rewritten to the new behaviour in the same commit, and the commit body names
  each one; the pass count may not fall.

## 6 Delivery discipline

One task, one commit, one push in this repository (the UIKit release is its own
commit and release in its own repository first); stop if the complete gate
cannot go green; never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, the UIKit version released, the captures, anything
noticed but not done.
