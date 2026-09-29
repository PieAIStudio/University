---
id: PLAN-V7-04-RETURN-REASONS
title: "V7 · 04 Wrap-up card, 涟's continue, and the avatar panel"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-28
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

## 8 Implementation receipt

The installed UIKit avatar primitives and Nerve 0.7 opening already cover this
task; no new kit release was needed. Product rules live in `progress/journey`;
the current owner, route and actual completion are enforced by `useJourney`.
The existing chest callback now hands off to 涟 on the island rather than a
second results page. A root return offers the next real lesson in one press,
keeps its ordinary chest glow after dismissal, and does not commandeer deep links.
The phone avatar opens the existing panel in a shared modal, including rest-day
balance/rules and the seven-day strip. Both modes share all of these components.

`reviewEmail` records only the explicit choice and timezone; the same preference
can be revoked in settings. Its timestamped merge is opt-out-safe and account
isolated. K1 continues through the existing password/verification account flow;
the small boundary copy states that fact before navigation. No email sender or
trial purchase is implied: live services remain gated under tasks 09 and the
existing reminder-backend gap. The member line describes only the current
membership boundary, not an unavailable seven-day charge/trial promise.

Evidence under `SCRATCH/v7-execution/` and `SCRATCH/e2e/v7-journey/`:

- Core invitation/rest rules: `19 passed`; controller/card/owner actions:
  `12 passed`; shared avatar panel: `6 passed`.
- Browser revisions retained their failures: the synthetic page initially
  bypassed Vite's HTML transform; the corrected fixture uses the existing
  `e2e-fixtures` lane. A member's empty optional card is intentionally unpainted;
  the visible opening sentence, rather than a fabricated spacer, is asserted.
- The full focused run showed `19 passed (5.0m)` with seven fixture/assertion
  failures. Six passed in `journey-regression-r3.log`; the remaining review
  clock case passed separately (`1 passed (55.3s)`). Installing the test clock
  before a live renderer, not halfway through a frame, prevents a fabricated
  negative avatar delta. Avatar return passed (`1 passed (42.7s)`) with its
  unchanged real target comparison.
- Guest completion, save-only, resume, phone-panel and all three account-card
  layouts have actual browser captures. Email/member fixtures use the real
  components but explicitly synthetic identity/entitlement/save facts; they
  are not live cloud, email or paid-membership acceptance. Real guest paths run
  the published lesson and grading, with external account traffic isolated.
- The old A/B/C completion helper now verifies the real stored revision,
  read confirmation, completed timestamp and displayed scheduled-card count.
  O1 tests the removal of persistent computer-speak while preserving on-demand
  help; recap remains accessible behind its explicit optional action. No old
  test is removed or skipped and no timing/visual threshold is relaxed.

Full source validation is retained in `journey-verify-r3.log` (`VERIFY_EXIT=0`),
including type checking, lint, all unit tests, builds, content and documentation
checks. The unchanged pre-push default/timing browser gate is the delivery
boundary: this locally completed candidate may not leave the machine or advance
the queue until that gate and the push succeed. Its receipt is retained as
`journey-push.log`; do not infer success from this document or a running wrapper.
Keep the owner reference directories untracked. No production, backend, course
or package release is part of this delivery.

### Full-gate correction before delivery

The first push of `a8b615a0` stopped with `3 failed`, `425 passed (20.5m)` and
`PUSH_EXIT=1`; the timing group did not run. A one-worker reproduction retained
all three failures, so they were not dismissed as contention.

At 872×286 the removal of the old sentence beside 涟 correctly centred the
droplet, but left no legal slot for a 203px course caption between the droplet,
scenery and both rails. Short landscapes now reuse the existing compact-caption
treatment at 140px maximum width. The full title remains in the DOM and selected
course panel, while font, status row, touch floor, collision gaps, scenery and
the existing bounded placement/leader algorithm remain unchanged. Shrinking 涟
instead was tested and rejected because it still did not leave a usable slot.
The corrected complete domain round trips report `2 passed (1.2m)` in
`journey-short-label-browser.log`; the placement unit file reports `33 passed`.
The ordinary success captures are under `.devspace-visual/astra-r40/domains-default/`
with `short-world-caption.png`, including both modes.

The authoring island-pick test also relied on a root visit staying on the world
map, despite the author's real legacy progress. V7 now legitimately resumes that
visit inside a course. The world-specific test reaches the same archipelago via
its real course breadcrumb without erasing learner data; all original pick,
cancel, carrier and geometry assertions remain. That case passed alone in
`journey-push-repro-fixed.log`. Its two remaining reds preceded the caption fix.

These are a follow-up correction commit, not rewritten history. Final validation
is recorded in `journey-gate-fix-verify.log`, and the subsequent unchanged push
gate in `journey-push-r2.log`. A running or failed receipt is never delivery.
