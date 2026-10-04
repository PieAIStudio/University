---
id: PLAN-16-UIKIT-3-ADOPTION
title: "16 · University runs on UIKit 3.0, NerveKit 0.8 and a UIKit-3 AuthKit"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-04
domain: execution
tags:
  - uikit
  - nervekit
  - authkit
  - adoption
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 16 · University runs on UIKit 3.0, NerveKit 0.8 and a UIKit-3 AuthKit

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md).
- Depends on `17-deep-refactor.md`; do this after task 17, not before it.
- **State on 2026-10-04 (supersedes the hold of 2026-10-03).** The kits no longer depend on each other
  (Owner rule, 2026-10-03). Each one publishes on its own, and University adopts exact versions when it is ready.
  - **UIKit `3.0.0-rc.1`** is published on npm under the `next` tag; `latest` is still `2.14.0`. Pin
    `3.0.0-rc.1` exactly. A stable `3.0.0` is a later one-line bump, not a reason to wait.
    Migration table: `SwimmerUIKit/docs/reference/migration-3.0.md`. Its University items include
    `night → dark`, `GameAssetIcon → GameIcon` (save any colour illustration still needed first),
    `setClayAssetMode` removed, and the surface, font and display-component changes.
  - **NerveKit `0.8.0`** (source `9853bcd`, candidate SHA-256 `5239f14a…5239`). It has no UIKit dependency.
    The app passes UIKit controls through `NerveUIProvider` from `@pieai/swimmer-nerve-kit/ui`. Its settings
    fields became native controls styled by `--nerve-ui-*` variables, so map those variables to UIKit tokens
    in the app.
  - **AuthKit `0.8.0-rc.1`** (source `93eb970`, candidate SHA-256 `a653d898…4bce`). It has no UIKit or
    backend-client dependency. The app passes:
    - controls through `AuthUIProvider`;
    - `captchaTheme`;
    - the authentication client it already builds, so University ends with one backend-client version.

    University pins `0.1.9` today. Read AuthKit's migration notes for the `0.2`–`0.8` changes. Keep
    today's email sign-in, and keep every new account interface disabled; enabling them is task `15-`.
  - Publication of NerveKit `0.8.0` and AuthKit `0.8.0-rc.1` was approved by the Owner on 2026-10-04.
    Confirm each version from its registry before installing.
  - If any of the three is not yet published when this task starts, step over the task and record which one.
    A local tarball path never enters `main`.
- Superseded: the coupled candidates of 2026-10-02 (UIKit `3.0.0` tarball, NerveKit `0.8.0` against UIKit 3,
  AuthKit `0.8.0-rc.0`). They are kept in git history only; do not install them.
- The Owner's theme picks (2026-10-01):
  - pastel for younger learners, grey for adults;
  - tide liquid only on the one forward CTA per screen;
  - ordinary controls flat with a slight droplet edge;
  - danger keeps red text (red edge in the outline styles), never a red fill.

## 1 Outcome

After task 17 and the new publication prerequisites, University renders on the
decoupled published kits. Two visual changes are intended:
- adults see grey and younger learners can choose pastel;
- the forward CTA is tide liquid.

Every other learner behavior stays the same. Verify injected UI/auth interfaces
and all gates on the exact published versions. Local tarball paths never enter main.

## 2 What the Owner said

> 「UI 第二版：Q1=淡彩，Q2=灰阶，Q3=液体·潮汐，Q4=一点点」 (2026-10-01)

> 「university赶紧把这个和上UI。然后呢，就开始可以重构」 (2026-10-02)

## 3 Out of scope

- Turning on anything from the account center: SSO, recovery or deletion. That is task `15-`, which waits for
  the Owner. Moving to the newer AuthKit only keeps today's email sign-in working on UIKit 3.
- New features. University is in a feature freeze.
- Changing lesson content.

## 4 How it is judged

One adoption pass on the exact published versions; `main` never points at a local tarball.
- Apply the migration table and the injection wiring, then run every gate below.
- Capture before/after screenshots at 1280 px and 390 px, light and dark, grey and 淡彩, on these screens:
  - the map;
  - a lesson step;
  - the chest;
  - Me;
  - the house;
  - sign-in;
  - 涟's panel and its settings.
- Put the screenshots on one walkthrough page for the Owner.
- One commit, one push. The Owner's look review comes after the push. Adjustments he asks for are a
  follow-up, not a reason to hold the adoption.

| Gate | Command | Floor |
| --- | --- | --- |
| fast | `pnpm verify` | green |
| complete | `pnpm e2e` | must pass; count may not fall below task 11's final count |
| timing | `pnpm e2e:timing` | must pass; count may not fall below 40 |

The theme choice is stored like the existing light/dark preference, and it is offered next to it. Default:
grey. Option: 淡彩. Design note for the player journey: one line in the settings section, recorded in the same
commit.

## 5 Delivery discipline

- One commit and one push; the push runs the complete gate.
- Never force-push.

## 6 Report back

- The published versions adopted, the gate output verbatim, the commit, the walkthrough page path, and anything the migration table got wrong.
