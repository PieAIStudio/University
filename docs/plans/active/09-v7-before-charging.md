---
id: PLAN-V7-09-BEFORE-CHARGING
title: "V7 · 09 Membership page, cancellation, help and legal pages"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: product
tags:
  - v7
  - membership
  - legal
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 09 · Membership page, cancellation, help and legal pages

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 11
  ("考虑付钱") and 12 ("账号、设置和退订").
- Real charging is off by Owner ruling and production deploy is on hold until
  lessons 1–3 are samples; this task makes the pages true and complete, it does
  not turn payment on. [Payment gap](../../reference/execution/payment-backend-gap.md)
  records that `PaymentPort` has no cancellation path; a cancel control must not
  be shown until a real path exists behind it.
- Legal text needs facts only the Owner has: the legal entity, contact address,
  governing law and refund terms. Draft with every such fact marked as a
  question for the Owner; do not invent them. This task is independent and may
  be stepped over while those facts are missing.
- Account, wallet and payment UI come from SwimmerUIKit and SwimmerBackend.

## 1 Outcome

The membership page answers "why not just ask ChatGPT" first, sells AI grading
and explanations (not sync), states trial, reminder, cancellation and refund in
one line whose every promise has a working path, and 我 → 关于 / 帮助 hold
privacy policy, terms, refund policy, FAQ and feedback.

## 2 What the Owner said

> 「你要加的第三样，在我说的那个开屏动画里面就得提及，在开会员的那个页面也得提及。」

Binding decisions: C1 (sell AI grading and explanations), F2 (prices in USD).

## 3 What "done" looks like

- Top line identical to the splash: "直接问 AI，你得到一个答案；在这里，你学会怎么问、
  怎么判断，还能记住。"
- Member column: unlimited open-answer AI grading, "为什么错" explained, continue
  on phone and computer. Free column: all courses, chests and badges, review and
  practice, about four AI gradings a day after leaving an email. The two
  contradicting sentences about grading are gone.
- Trial, reminder the day before it ends, cancellation in 我 → 会员, refund
  policy — each linked to a real path or not shown.
- 我 → 关于: privacy policy, terms, refund policy; 我 → 帮助: FAQ, feedback.
- 我's first line says where progress is stored ("只在这台设备上" until signed
  in; the email after).

## 4 Out of scope

- Turning on real payments; production deploy.
- Inventing legal facts.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Browser spec: cancellation reachable from 我 within two steps when a path
  exists; no reassurance text on the page without its path; legal pages reachable
  from 我 in both locales.
- A list of Owner questions for the legal pages, attached to the report.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, captures, the Owner's open legal questions.
