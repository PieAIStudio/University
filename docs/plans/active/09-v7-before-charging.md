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

### Integration with the independently delivered game lane

Before this page candidate was pushed, remote `main` advanced from `cf6a1f62`
to `6302f5e2` through the other lane's 31 commits. The verified page work was
preserved as `29068f33`, then integrated by an ordinary merge; no incoming
game, lesson guide, catalogue or reference work was discarded or rewritten.
The sole textual conflict was the generated documentation manifest, rebuilt
from both sides. Core exports retain both the support routes and new game
content; interface contracts were regenerated from the merged catalogs.
The pre-merge verification above does not verify this integrated candidate.
Fresh complete source and normal pre-push checks are required below.

The combined source passed `before-charging-integrated-verify.log` with
`VERIFY_EXIT=0` (`wc_job_0e03fLLvUQEoJltD`). The ordinary push still owns full
browser acceptance. The phone purchase probe additionally presses the actual
unavailable CTA after scrolling and captures the real viewport; a fixed bottom
bar across a stitched full-page image is not itself evidence of a blocked click.
No ordering, billing, legal approval or service switch is changed by that probe.

The first integrated full push reached **472 passed (28.2m)** and one failure:
the authoring-English policy pointer left the browser on About, rather than
opening its policy address. The original standalone case passed unchanged
(**1 passed (50.5s)**, `E2E_EXIT=0`), so the exact full-suite timing is not claimed
reproduced. The retained page snapshot is in
`SCRATCH/v7-execution/before-charging-c75effe7-failure/`.
The policy walk now waits for the current About document's actual fonts, as the
existing reading-settings walk does, before measuring and pressing its link.
It additionally requires the exact localized policy URL and one trusted
down/up/click sequence on that original link. No re-click, route injection,
publication-state shortcut, assertion removal or timeout increase is used.
Focused browser verification and a fresh normal push remain required.

Both repeats of every support/management case passed the strengthened pointer
checks: **12 passed (3.3m)**, `E2E_EXIT=0`, in
`SCRATCH/v7-execution/before-charging-policy-pointer.log`. The unchanged original
six scenarios still cover both modes and languages; repetition adds evidence,
not six new product cases. Complete source verification and normal pre-push
acceptance follow this exact test and documentation candidate.

`before-charging-policy-verify.log` then completed the full `pnpm verify` with
`VERIFY_EXIT=0` (`wc_job_iiReB81yPi3ibiyq`). No product behavior, published lesson,
entitlement or legal-publication state changed during this test-only repair.

### Final integration with the new first three lessons

The Owner relayed the other lane's shared-course warning. Before another push,
`origin/main` was fetched and merged at `1f3e7a1fcb67a10845872091de1f305693fa5257`,
preserving the three local V7 commits. `pnpm content` then returned
`CONTENT_EXIT=0` in `SCRATCH/v7-execution/final-course-sync-content.log`.
The rebuilt shelf still contains 93 lessons in six courses, with all 131/131
repository snippets baked. Source/export freshness and revision checks pass.
The first three stable lesson ids now carry the message, emoji and long-email
lessons at revisions 15, 9 and 9 respectively; old photo prose was not restored.

The incoming photo-layout regression had become conditional on a currently
shipped photo lesson. Since the new step lessons are text-only, that would skip
the old guard. It now falls back to the existing shared PRIMM fixture and the
actual product renderer on an explicitly isolated page, not to a second lesson
producer. The original one-pixel viewport limit and real pointer check remain;
a step-relative comparison additionally prevents scroll anchoring from hiding
a layout shift. A negative control removes image-space reservation and detects
the movement. There are no skipped photo checks or paid model calls.

All three new lessons completed through their actual step engine in both modes
and languages, together with first-use guidance, policy/management navigation
and both image-layout controls: **22 passed (5.8m)**, `E2E_EXIT=0`, retained in
`SCRATCH/v7-execution/final-course-sync-focused.log`. The answers/portal are
explicit test transports, not live provider or cancellation acceptance. This
integrated source still requires its own complete verify and normal push;
pre-course-update receipts are not reused as the final gate.

That combined source then passed the complete `pnpm verify` with
`VERIFY_EXIT=0` in `SCRATCH/v7-execution/final-course-sync-verify.log`, including
both builds, current-source freshness, 42 registered component identities and
all source/style/content/documentation checks. The final ordinary push receipt
is `SCRATCH/v7-execution/final-course-sync-push.log`; source verification alone
does not establish its result.

### Resumed source and browser check (2026-10-01)

The remote was fetched again at `1f3e7a1f`; the local merge `f3193486`
already contains it, so the requested merge was a verified no-op, not skipped.
The subsequent `pnpm content` completed with `CONTENT_EXIT=0` in
`SCRATCH/v7-execution/v7-resumed-content.log`. Both published recovery exports
match their current authoring sources; all 93 lesson revisions and six courses
pass the content checks. No course was authored, republished or reverted here.

The previous full push ended with **6 failed, 4 interrupted, 353 did not run,
111 passed (15.5m)** and `PUSH_EXIT=1`. Its later narrow run was also red;
neither is replaced or represented as a successful gate. After the already
running lesson-format full suite ended, the unchanged accessibility, desktop
completion and authoring album subset returned **8 passed (3.4m)**,
`E2E_EXIT=0`, in `SCRATCH/v7-execution/v7-resumed-focused.log`.
That is narrower evidence, not proof of the former failures' exact cause and
not a substitute for the final normal pre-push. No timeout, comparator,
test count or product readiness condition was weakened.

Before pushing, the other lane advanced remote main to `99142f6d` with UIKit
2.14.0, the folded-breadcrumb repair and a same-frame comparison probe.
The local source and evidence were retained, then merged normally as
`5a0f1f65`. The exact installed UI dependency is 2.14.0. Another `pnpm content`
returned `CONTENT_EXIT=0` in `v7-integrated-content.log`; the complete
`pnpm verify` returned `VERIFY_EXIT=0` in `v7-integrated-verify.log`, including
all source suites, both builds, both current-source recovery exports, all 93
lesson revisions and documentation checks. The earlier waiting verifier was
interrupted before accepting an obsolete dependency snapshot, not passed.
This is the integrated source baseline for the next normal pre-push, whose
separate receipt is `SCRATCH/v7-execution/v7-resumed-push.log`.

### Latest upstream reconciliation (2026-10-01)

The Owner's course/source warning was checked again against the actual remote.
The new upstream tip `b46789f6` adds V7 amendment one and the first lesson-stage
implementation. It has been merged without rewriting either line of history.
The only conflict was in `current-work`: the amendment link from upstream and
the already-delivered weekly-crown / current task-09 entries are both retained.
`pnpm content` then returned `CONTENT_EXIT=0` in
`SCRATCH/v7-execution/v7-oct01-resumed-content.log`, baking all **131/131**
repository snippets. Both recovery exports match the current authoring sources;
all **93 lessons / six courses** pass the revision check. No lesson was edited,
published, rolled back or silently replaced by an old recovery package.
This is content-alignment evidence only. The merged stage changes still require
fresh full local and pre-push browser acceptance; previous green receipts do
not prove this new candidate.

The map-navigation and retained-questionnaire repro subsequently passed all
**11 tests (4.7m)** with native exit **0** in
`SCRATCH/v7-execution/v7-oct01-navigation-isolated.log`. It was admitted only
after competing check leaders had exited; another worktree later started a
short stage-timing run, so this is not claimed to be a machine-exclusive timing
measurement. An earlier overlapping attempt was deliberately interrupted and
is retained in `v7-oct01-navigation.log`, not counted as a passed run. The
original navigation assertions, timeouts and source were unchanged.

Before final verification, upstream advanced to `41b31eff` (the lesson-stage
sort/build/Make props). That separate work was also merged normally, then the
content build was repeated in `v7-oct01-stage-content.log`. These imported
stage changes are not presented as new work authored by the V7 delivery lane.
The complete verification and normal push still have to pass for the combined
candidate; do not reuse the earlier pre-stage full-suite result.

That combined source run completed with `VERIFY_EXIT=0` and
`SOURCE_UNCHANGED=true` in `v7-oct01-remote-aligned-verify.log`. While it ran,
the independent lesson lane published `019a4b69`, adding the stage's explicit
ready/still wrapper and one slowed-browser frame-budget test. This commit was
reviewed and merged after the running verification ended, rather than changing
the workspace beneath it. Content is rebuilt again after that merge; the final
gate must include the new timing test. A simulated slowed browser remains
distinct from a physical phone. The earlier wait-only logs never ran `verify`
and must not be counted as successful validation or as product test failures.

Final source acceptance for the resulting merge `ecdcdbce` is retained in
`SCRATCH/v7-execution/v7-oct01-stage3-verify.log`: `VERIFY_EXIT=0`,
`COMMAND_EXIT=0`, `SOURCE_UNCHANGED=true`. The admission check independently
read remote `019a4b69616aa55699f5b1997a0308198536e517` and verified that the
candidate contained it. All workspace checks, both builds, current content,
recovery freshness, 165 governed documents and the new stage source were
included. The final content rebuild is `v7-oct01-stage3-content.log`,
`CONTENT_EXIT=0`. The following ordinary push still owns full browser and
timing acceptance; source acceptance alone does not close this task's legal,
payment, reminder or deployment boundaries.

### Reproduced gate scope and the approved prototype retirement

The inherited `14922cb7` push was stopped after four observed failures, not
accepted: two authoring step journeys, a delivery map-node round trip and the
light-theme settlement walk. No aggregate pass count was retained. The raw
error-context directory was no longer present after cancellation; the saved
`final-14922-interrupted-failures/interruption.json` explicitly distinguishes
tool-readback summaries from the retained original course-entry screenshot.
After the other heavy check leaders ended, the exact four unchanged cases
passed **4 passed (1.7m)**, `E2E_EXIT=0`, `SOURCE_UNCHANGED=true`, in
`final-14922-four-repro.log`. This does not claim the earlier scheduling cause
was reproduced or that a four-case subset replaces the complete gate.

Before the next push, upstream advanced to `e66b2410`, the Owner-G3 removal of
superseded research prototypes and earlier 3D editions. It is incorporated by
an ordinary merge, not rewritten or silently restored. This deliberately
changes the browser inventory from **474 to 425** default cases: 21
`arcade3d.spec.ts`, 24 `purpose3d.spec.ts`, three `harness/prototype-click.spec.ts`
and four former `play-catalog.spec.ts` cases leave with their retired surfaces;
three current catalogue cases replace the latter four. All four failed/retested
V7 cases remain. The exact before/after identities are in
`final-retirement-test-inventory.json`; this count change is not described as
fixing red tests. The retired implementations remain in Git history and the
upstream interaction-components album preserves their screenshots.

`pnpm content` was run again after this merge (`final-retirement-content.log`,
`CONTENT_EXIT=0`), preserving 93 lessons, six courses and 131/131 repository
snippets. This new combined candidate needs its own complete source and normal
pre-push acceptance; no earlier pass is substituted for it.

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
