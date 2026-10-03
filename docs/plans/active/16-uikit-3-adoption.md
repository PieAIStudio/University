---
id: PLAN-16-UIKIT-3-ADOPTION
title: "16 · University runs on UIKit 3.0, NerveKit 0.8 and a UIKit-3 AuthKit"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-03
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
- Depends on: `11-test-catalogue.md`. Independent of `12-`, `13-`, `14-`. **All three candidates are ready (2026-10-03).**
- **The three candidates.** None of them is published yet. University's full gates are the
  consumer check before the Owner approves publishing all three together.
  - **UIKit `3.0.0`**
    - Tarball: `/Users/yuanfei/PieAI/SwimmerUIKit/.scratch/s6/final/swimmer-ui-kit-3.0.0.tgz`
    - SHA-256: `267c29288681e8d1b98955631afe00c6db24c852c817be73d28885e3970103b3`
    - Source: `1173a45`
    - Migration table: `SwimmerUIKit/docs/reference/migration-3.0.md`, with a University section that covers
      `night → dark`, `pastel` for younger learners and `grey` for adults, the tide CTA, removed parameters,
      AvatarLab types, and AuthKit's captcha dark check.
  - **NerveKit `0.8.0`**
    - Tarball: `swimmer-nerve-kit-0.8.0.tgz` beside
      `SwimmerNerveKit/.worktrees/codex-uikit3-candidate/.devspace-reports/uikit-3-candidate/final/HANDOFF.md`
    - SHA-256: `0f3a47d3ef61cc730678dc63430194583bac782638b7e62352ce263e2bbf2397`
    - Notes: `docs/reference/api/uikit-3-candidate.md` inside the package.
  - **AuthKit `0.8.0-rc.0` with UIKit-3 support**
    - Prepared by the account-center lane on 2026-10-02; AuthKit source commit `c375955`.
    - Tarball: `/Users/yuanfei/PieAI/SwimmerAuthKit/.devspace-reports/uikit3-compat-20261002/release/swimmer-auth-kit-0.8.0-rc.0.tgz`
    - SHA-256: `186aa52a845d6735ce984e61552a7bdc0901def77e6692e9f361e61f4898a76b`
    - UIKit dependency range: `>=2.6.1 <4`. The upstream lane tested UIKit `2.6.1`, `2.13.0` and the `3.0.0` candidate.
      Evidence: `SwimmerAuthKit/docs/plans/active/uikit-3-compatibility-candidate.md` and the candidate's `release/receipt.json`.
    - University currently pins `0.1.9`. Moving to `0.8.0-rc.0` crosses the `0.2`–`0.7` changes:
      the unified sign-in card, `methods` configuration, and optional security and SSO interfaces.
      Read AuthKit's README and changelog before migrating. Preserve today's email sign-in behaviour;
      keep every new interface disabled. Enabling any of them belongs to task `15-`, not this task.
- Why the order matters: NerveKit `0.7.0` and AuthKit (`0.1.9` and `0.7.0`) all cap UIKit below 3. Installing
  UIKit 3.0 alone fails, which is the kit-compatibility problem the Owner worried about.
- The Owner's theme picks (2026-10-01):
  - pastel for younger learners, grey for adults;
  - tide liquid only on the one forward CTA per screen;
  - ordinary controls flat with a slight droplet edge;
  - danger keeps red text (red edge in the outline styles), never a red fill.

## 1 Outcome

University renders on the three candidates. Two changes are intended:
- adults see grey and younger learners can choose pastel;
- the forward CTA is tide liquid.

Every other behaviour is unchanged. The full gates are green on the candidates, and then on the published
versions after the Owner approves.

## 2 What the Owner said

> 「UI 第二版：Q1=淡彩，Q2=灰阶，Q3=液体·潮汐，Q4=一点点」 (2026-10-01)

> 「university赶紧把这个和上UI。然后呢，就开始可以重构」 (2026-10-02)

## 3 Out of scope

- Turning on anything from the account center: SSO, recovery or deletion. That is task `15-`, which waits for
  the Owner. Moving to the newer AuthKit only keeps today's email sign-in working on UIKit 3.
- New features. University is in a feature freeze.
- Changing lesson content.

## 4 How it is judged

Two phases, because `main` must never point at a local tarball.

**A · Candidate check** — local only, nothing committed.
- Install the three tarballs; verify the SHA-256 values above first.
- Apply the migration and run every gate.
- Capture before/after screenshots at 1280 px and 390 px, light and dark, on these screens:
  the map, a lesson step, the chest, Me, the house, sign-in.
- Hand Claude the diff, the gate output and the screenshots. Claude reviews, then the Owner approves
  publishing all three packages.

**B · Adoption** — after publication.
- Switch to the exact published versions and repeat the gates.
- One commit, one push.

| Gate | Command | Floor |
| --- | --- | --- |
| fast | `pnpm verify` | green |
| complete | `pnpm e2e` | must pass; count may not fall below task 11's final count |
| timing | `pnpm e2e:timing` | must pass; count may not fall below 40 |

The theme choice is stored like the existing light/dark preference, and it is offered next to it. Default:
grey. Option: 淡彩. Design note for the player journey: one line in the settings section, recorded in the same
commit.

## 5 Delivery discipline

- Phase A changes nothing in git.
- Phase B is one commit and one push; the push runs the complete gate.
- Never force-push.

## 6 Report back

- Phase A: the diff summary, gate output verbatim, screenshot paths, and anything the migration table got wrong.
- Phase B: the published versions, gate output verbatim, and the commit.
