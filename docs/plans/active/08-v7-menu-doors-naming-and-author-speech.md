---
id: PLAN-V7-08-MENU-AND-TIDY
title: "V7 · 08 Four doors, one name for a lesson, and no author speech"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - navigation
  - copy
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 08 · Four doors, one name for a lesson, and no author speech

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 3
  (the breadcrumb's first cell), 7 ("在产品里找路"), 8 ("复习和练习"), 10 (two
  everyday numbers), the small issues one to five, and the ledger "功能一个都没丢",
  which is the acceptance list for where every old entry goes.
- The learner surface is identical in both modes except the port answers and
  the author workbench; binding decision L1 makes the "实验室" row visible only
  in the authoring build, which is the workbench exception, not a new boundary.
- Learner-visible strings go through the repository's current i18n mechanism in
  zh-CN and en.
- Depends on none of 01–07. Independent; but run it after 05 if 05 is still
  queued, because it moves 成长 under 我.

## 1 Outcome

Every screen offers four labelled doors — 学习, 复习, 图鉴, 我 — on desktop and
phone (including the map), every old entry is reachable where the ledger says,
the product calls a lesson "第 N 关" everywhere, no computer-speak or author
notes reach a learner, and a release check refuses a planted author note.

## 2 What the Owner said

> 「别丢功能……有些面板，开了可能调一些 3D 的，这块以后肯定要删掉。但现在你删掉的话，我就调不了了。」

Binding decisions: B2 (four doors, 成长 folds into 我), G2 ("第 N 关"), E1
(planets without courses say "即将开放 · 开放时告诉我"), L1 (lab only in the
authoring build).

## 3 What "done" looks like

- Doors: 学习 (islands, find a course), 复习 (due cards, practise a few, mistakes),
  图鉴 (knowledge cards, words, favourites, my notes, interactive courseware),
  我 (avatar panel, 成长, membership, account, settings, help). Phone bottom bar
  has the same four with text, and it is present on the map.
- 设置 → 实验室 (authoring build only) holds the avatar workshop, the three
  courseware labs, island appearance tuning and the author workbench; URL
  parameters that open tuning keep working.
- Review page: due cards first with a time estimate; "再练几道" draws mistakes
  first, then only from lessons the learner has finished (today it draws from
  all content, so a beginner is asked about web layout); the free-grading-used-up
  moment is where membership appears.
- Naming: "节" → "关" wherever it means a lesson; "账号" everywhere (no "帐户");
  "快捷操作：空格或更多" removed.
- The breadcrumb's first cell shows the course name, not "…".
- Planets without courses: "即将开放 · 开放时告诉我" with an email capture.
- On phones the lesson medallion above each stone is half its current size,
  full only for the selected lesson.
- Author speech: internal lesson classifications, layout explanations and code
  identifiers are gone from learner text, and a check in `pnpm verify` scans the
  learner-visible strings and published catalogue text and fails on a planted
  author phrase.

## 4 Out of scope

- Deleting any lab or tuning panel.
- Course prose under `apps/local/studies/` — when the author-speech check finds
  text inside a lesson, file it for the course-writing workflow instead of
  editing the lesson; the check may carry a dated allow-list for those findings.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- A browser spec walks the ledger: every "现在在哪" entry is reached from its
  "改完在哪" location, in the delivery build and (for the lab) the authoring build.
- The author-speech check has a test that plants a phrase and sees it fail.
- Capture: both builds' menus, phone bottom bar on the map, review page.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history. Navigation specs that asserted the old
twelve entries are rewritten in the same commit and named in its body.

## 7 Report back

Gate numbers verbatim, captures, the allow-listed lesson findings.
