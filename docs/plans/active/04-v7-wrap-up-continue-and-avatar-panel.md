---
id: PLAN-V7-04-RETURN-REASONS
title: "V7 · 04 Wrap-up card, 涟's continue, and the avatar panel"
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
  - uikit
related:
  - REF-WORK-QUEUE
  - ADR-0012
supersedes: []
superseded_by: null
---

# Task 04 · Wrap-up card, 涟's continue, and the avatar panel

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 5
  ("收尾") and 6 ("第二天回来"), plus mechanics 6 (rest-day ticket) and 7
  (daily first chest ×2) in "让人停不下来".
- The avatar panel is a new SwimmerUIKit component (brand-kit-first); release
  it there, consume it here.
- Reminder email delivery is a backend gap recorded in
  [review reminders](../../reference/execution/review-reminders-backend-gap.md).
  This task stores the learner's consent and schedule intent; sending mail
  stays with that gap.
- Depends on `02-v7-chest-opening-and-star-throw.md` (the wrap-up follows the
  opening). If 02 was skipped, build the avatar panel and 涟's continue, and leave
  the wrap-up card for when 02 lands.

## 1 Outcome

After the chest, 涟 says one line that the cards are saved for review and shows
one card chosen by who the learner is; the next day 涟 opens with
"继续：第 N 关 · 开始" and the avatar panel shows the streak, today's lessons and
the week at a glance.

## 2 What the Owner said

> 「记住它，我觉得是直接就呈现出来……一句话，就是已经存入复习啦。」
> 「第三个屏幕是面对两种状态：一种是没有注册的用户，第二种是注册了、但没有花钱的用户。」
> 「继续第二节这种提示……我建议把它放在 NERVE 里面。」
> 「应该加在左侧那个面板里，而且得设计得好看一些。」
> 「只保留……说明栏只介绍选中的岛，这个要保留，其他的不一定……以简单高效来做。」

Binding decisions: A1 (continue lives in 涟), D1 (ask for an email after lesson 1,
skippable, ask again on day 3), K1 (one button "邮箱保存，有卡片时提醒我"; a small
"只保存，不要提醒" beside it).

## 3 What "done" looks like

- Wrap-up inside 涟's panel, island still behind it. Line one for everyone:
  "N 张卡片已存入复习。我们按记忆曲线，在你快忘的时候叫你回来。" Then:
  - no email yet → the save card (K1), "以后再说" suppresses it for the day;
  - email, not a member → "已保存，手机和电脑都能接着学", and at most once a week
    a member line about AI grading with the 7-day trial;
  - member → the one line only, collapsing by itself after about 4 s.
  "用自己的话讲一遍" is a small optional line at the bottom (no model call).
- Returning learner: 涟 surfaces by itself with "继续：第 N 关 · 大约 N 分钟" and
  "开始"; the camera opens on that lesson with its chest glowing; dismissing 涟
  leaves the chest glowing. The 2026-09-18 "不替你预选" rule is relaxed by the
  Owner's "简单高效"; the right-hand panel still describes only the selected
  island. The bottom hint "先点选，再进入。快捷操作：空格或「更多」" is removed.
- "开始" is keyboard reachable and has an accessible name.
- Avatar panel (dark, 3D avatar kept): flame and streak number at the avatar's
  lower right; a ring around the avatar for today's progress, turning gold when
  today's goal is met; seven day dots; rank emblem beside the name; level and
  XP; membership as the last quiet row. On phones the top-left avatar button
  carries the flame and number.
- Rest-day ticket: one per week, plus one for each 7-day streak; a day covered
  by a ticket does not break the streak. Daily first chest: the first lesson of
  the day gives double XP and its chest says "今日首箱 ×2". Both are computed from
  the learning record and the ticket balance; their rules live in
  `packages/core` with tests.

## 4 Out of scope

- Sending reminder emails.
- The rank emblem's 3D model (task 05); use the existing rank name until then.
- Membership purchase and cancellation flows (task 09).

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Browser specs for the three account states' wrap-up cards; the weekly cap on
  the member line; "以后再说" holding for the day; a returning learner's first
  screen offering "开始" and reaching the lesson in one tap.
- Unit tests for the rest-day ticket and daily-first rules at day boundaries
  and time zones.
- Capture: the three wrap-up cards and the avatar panel, desktop and phone.

## 6 Delivery discipline

One task, one commit, one push here (UIKit release first in its own
repository); stop if the complete gate cannot go green; never force-push or
rewrite history.

## 7 Report back

Gate numbers verbatim, UIKit version, captures, and anything noticed but not
done.
