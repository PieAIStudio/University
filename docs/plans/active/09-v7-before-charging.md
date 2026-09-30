---
id: PLAN-V7-09-BEFORE-CHARGING
title: "V7 · 09 Membership page, cancellation, help and legal pages"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-30
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
  owns the current payment boundary: `PaymentPort` can accept a subscription
  portal adapter, but the actual browser transport still supplies none. A
  management control must not be shown merely because a fallback method exists.
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

## 8 Source continuation and retained release boundaries (2026-09-30)

This remains an **active** task, not a completed legal or commercial launch.
The executable page scope is implemented; formal policies, real cancellation,
a seven-day trial and its reminder still require approved facts and working
services. The payment gap's later Owner ruling remains binding: no permanent
"not on sale" banner, waitlist or forced registration. The page keeps the price
and upgrade entry, with a brief truthful result only when an unavailable action
is attempted.

The membership headline now uses the splash's exact `product.value.whyAi` key,
not a second copied string. AI grading and explanations lead the member benefits;
free courses, practice, review cards, chests and badges remain free. USD prices,
server quotes, order identities, wallet accounting and entitlements are unchanged.
The actual service still meters members' grading through the wallet. Therefore
this page must **not** advertise included/unlimited AI usage merely because §3
names the intended future offer. That service gap is retained, not solved by
removing its charge disclosure or silently granting free provider usage.

`PaymentPort.managementAvailability` distinguishes a connected portal from the
always-present fallback method. Management remains available when new sales are
closed and the portal exists; a read-only transport exposes neither its button
nor cancellation reassurance. One explicit press starts one request, the entry
is disabled until the result, and account changes remove pending/returned portal
links. Opening a portal is never labeled a successful cancellation or refund.
The adapter's existing account/HTTPS validation and purchase recovery remain.

The same router now owns `/help`, `/about`, `/about/privacy`, `/about/terms` and
`/about/refunds` in both modes. All remain under the Me door; malformed child
paths are not misread as courses. Me retains its actual feedback host and adds
FAQ/About destinations. Its email comes from current signed-in identity, while
its separate save status still comes from confirmed local/remote persistence.
Explicit locale choices survive these links and reloads.

Help explains six current behaviors from source: saving, completion, due review,
grading costs, management and reminder delivery. Each policy destination clearly
says that the formal document is unpublished. It contains no invented operator,
contact, jurisdiction, retention period, refund promise or consent checkbox.
These status pages make the missing documents visible; they **do not satisfy**
the formal-policy acceptance requirement.

### Focused evidence

The two added V7 unit tests first failed against the original code: the headline
still sold sync, and a read-only member adapter displayed subscription management.
After repair the focused core route/payment set passed **48 tests**, the first
UI set **52 tests**, and the expanded management/support UI set **29 tests**.
The latter retains the double-click/failure recovery and late-account-response
checks; earlier totals overlap and must not be added together.

`e2e/before-charging.spec.ts` exercises both locales and modes at 320px through
real Me, About, three policy status pages, reload, FAQ, feedback and membership.
The two explicitly labeled synthetic cases use the actual ProfileScreen,
PlansScreen and core payment port to verify two entries to management, one
request and sign-out isolation. They do not contact a payment provider and are
not evidence of a real account, transaction, cancellation or refund.
Together with the existing product-lightness/menu regressions, the retained run
finished **32 passed (3.1m)**, native exit **0** (`wc_job_mYaLA7SpdVNzdsdE`).
Actual captures are under `SCRATCH/e2e/before-charging/`; desktop Chinese,
phone English and the help page were inspected.

The resumed full verification first stopped at the older App integration
assertion expecting `/league` while the real Me link correctly retained
`?lang=zh-CN`. Its expectation now requires that exact route and locale; the
same badge-wall round trip and all seventeen badges remain checked. All six
original App progress cases passed. The unchanged final implementation then
passed the complete `pnpm verify` in
`SCRATCH/v7-execution/before-charging-resumed-verify.log`, `VERIFY_EXIT=0`
(`wc_job_x2HavC9C18xxsggh`). Only evidence/documentation and the existing open
experience-ledger descriptions were reconciled afterward; neither legal nor
real-cancellation debt is marked fixed. The normal pre-push is still required,
and its terminal receipt is the source-delivery boundary.

### Draft facts for Owner approval — not public policy text

| Document | Facts/questions that must be supplied or approved |
| --- | --- |
| Privacy | Who is the operator, and what public contact/address should appear? Which actual data categories, purposes, providers/processing regions, retention periods and deletion-request process are approved? What age/guardian rules apply? |
| Terms | Which entity supplies the service, which regions are served, and which governing law/dispute route is approved? What account, permitted-use, content/AI-output and service-change terms have been approved? |
| Refunds and renewal | Which channel processes a purchase? What refund window, eligibility/exceptions, contact path and response process are approved? How should stopping renewal, remaining access and refund-related entitlement changes work? |
| Trial and reminders | Which exact trial/billing/reminder implementation is approved and verified? Until then, the UI must not claim seven free days, a pre-expiry email or successful cancellation. |

After these facts are supplied, replace the unpublished status with reviewed
bilingual documents at the existing stable addresses, test their actual links,
and only then evaluate the separate payment/release gate. No production deploy,
course publication, legal approval or payment enablement occurred in this task.
