---
id: PLAN-UIKIT-LIQUID-CTA-MIGRATION
title: UIKit Upgrade and Liquid CTA Migration
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-13
last_reviewed: 2026-09-13
domain: ui
tags:
  - dependency-upgrade
  - brand-kit
  - verification
pinned: false
related:
  - PLAN-AI-READINESS-ALIGNMENT
  - REF-CURRENT-WORK
  - POLICY-SHARED-BRAND-KIT-FIRST
---

# UIKit upgrade and CTA migration

The owner's attached `kit-upgrade-brief.md` authorizes this separate change on
main after the PGS alignment. The preceding phase passed full verify and the
226-pass/6-skip browser baseline. This task changes the implementation owner of
the button appearance, not the learner journey or the page-level flight design.

## Work and acceptance

- [x] U1: Upgrade all three exact UIKit declarations from 2.4.0 to 2.6.1;
  inspect the 2.5.0, 2.6.0 and 2.6.1 published changelogs, install, then obtain
  separate complete verify/browser results before migrating call sites.
- [x] U2: Measure native hit rectangles, DOM text and focused outlines during
  real pointer/keyboard presses in a minified consumer. Compare matte/glossy.
  Source inspection or a development-only preview is not this proof.
- [x] U3: Delegate ordinary CTAs directly to the kit and retain only a thin
  destination trigger. Keep `LiquidCtaTransition.tsx` byte-for-byte unchanged.
  Remove the parallel button skin, not the five-phase product flight.
- [x] U4: Compare course-start, lesson-footer, settlement, empty-state and plans
  surfaces at desktop/phone widths in light/night themes. Observe both reading
  confirmation orders. Keep real routes and explicit component fixtures distinct.
- [x] U5: Attack every changed assertion for its intended failure, restore it,
  run complete verify and browser gates without lowering coverage, commit and
  push through the normal pre-push hook. Finish main clean and synchronized.

## Source inventory and boundaries

This migration covers 17 CTA call sites in 15 files. Only one JSX button call
receives `destination`; two `LessonReadConfirm` branches forward that property
to it. The brief's three textual occurrences are not three independent button
implementations. Preserve both confirmation states and the shared destination
registry/layer rather than manufacturing three wrappers to match a count.

Read assertions in CTA/transition, lesson completion, plans and practice specs
before changing shared code. The existing disabled-label readability contract
remains a constraint, not something to delete when the markup changes. Published
kit props, class names and semantic theme tokens are the supported reuse surface;
do not reproduce its silhouette, filter or motion controller here.

Do not modify SwimmerUIKit, private studies, accounts, other worktrees, render
techniques or unrelated documentation. A genuine missing kit capability is an
upstream handoff, not permission for a replacement fork or a local kit patch.

Receipts: `.devspace-reports/pgs-kit-alignment-20260912/`.
Images, videos and minified consumer probes:
`.devspace-visual/pgs-kit-alignment-20260912/`.
Evidence files remain local; successful build/inventory alone is not a visual
verdict. The optional before-component capture encountered a platform
safety-status block and has not been claimed as executed.

## Desktop verification checkpoint

The upgrade-only `5123ce19` snapshot remained tracked-clean in the repository's
own `.worktrees/` directory. Its complete verify passed and its complete default
browser suite passed 231 tests with the existing six skips, retaining all five
review-clock regressions. Earlier failures and interrupted runs remain separate.

Browser account creation uses a task-owned official local Supabase Auth service,
never the shared online backend. The authoring server uses isolated study folders
without personal learner/vocabulary databases; only fixed course/source inputs
are linked for reading. This is real local integration, not production Auth,
payment, cloud-sync or a real-phone acceptance claim. Docker is temporary test
infrastructure, not a new University deployment requirement.

The minified bare kit sample holds 116.15625×40px native / 84.15625×22px text in
all four conditions, with zero pointer/keyboard rectangle drift and a stable
3px outline / 2px offset. The product fixture holds 115.203125×44px native /
83.203125×22px text, with its existing product 3px outline / 3px offset.
Glossy was selected after opening the same-condition matte/glossy comparisons.
Disabled product text retains opaque muted ink; it is not the bare kit's faint
disabled sample. Changed selectors and callbacks have preserved failure receipts.

Both real read-confirmation orders were exercised in paired immutable builds.
As in the old baseline, answering first navigates immediately to settlement and
leaves no cross-page flight; reading first retains the same-screen five-phase
flight and reaches land without completing an unanswered lesson. The real empty
favourites route has no optional action; the action and completed footer are
explicit component fixtures, not invented product routes.

The old unfinished footer was already 44px for coarse/touch input but only 40px
for a mouse at phone width. The scoped layout rule now keeps both at 44px;
the new two-mode browser regression first rejected the 40px mouse case and
then passed both modes. The original one-mode touch run was positive evidence,
not a red test. The final current-source full browser/verify and normal push
gates are recorded in the accepted delivery below.

The same visual review found old bright-on-bright settlement explanation text.
Only the two recap body-color declarations changed to the existing theme text
token; lesson content and workflow stayed intact. The actual browser first
rejected the old fixed bright ink, then passed both themes. New mouse/touch and
recap readability regressions join the default suite without additional skips.
The post-fix complete verify passed; the matching complete E2E and ordinary
pre-push receipts were collected separately rather than inherited from earlier runs.

## Accepted delivery (2026-09-13)

Code checkpoint `7efe2b54` passed complete `pnpm verify` and `pnpm e2e` with
235 passed / 6 existing skipped / 0 failed. The ordinary `git push origin main`
then ran the unchanged pre-push browser gate again, with the same 235/6/0 result,
and successfully advanced remote main from `2316755f` to `7efe2b54`.
The five review-clock tests, two input-mode touch-floor tests and two recap-theme
tests are retained; the six skips still require a second real published study.

The exact local before/after images, component fixtures, videos, keyframes,
source provenance, successful gates and effective negative-control errors are
indexed in `.devspace-reports/pgs-kit-alignment-20260912/desktop-delivery-evidence.md`.
The final documentation-only closure does not change the verified runtime code.
Temporary local Auth/test data and preview processes are delivery scaffolding,
not a new runtime or online deployment dependency. Production accounts, payment,
cloud synchronization and physical-device acceptance remain outside this delivery.
