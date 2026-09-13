---
id: PLAN-UIKIT-LIQUID-CTA-MIGRATION
title: UIKit Upgrade and Liquid CTA Migration
type: plan
status: active
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

- [ ] U1: Upgrade all three exact UIKit declarations from 2.4.0 to 2.6.1;
  inspect the 2.5.0, 2.6.0 and 2.6.1 published changelogs, install, then obtain
  separate complete verify/browser results before migrating call sites.
- [ ] U2: Measure native hit rectangles, DOM text and focused outlines during
  real pointer/keyboard presses in a minified consumer. Compare matte/glossy.
  Source inspection or a development-only preview is not this proof.
- [ ] U3: Delegate ordinary CTAs directly to the kit and retain only a thin
  destination trigger. Keep `LiquidCtaTransition.tsx` byte-for-byte unchanged.
  Remove the parallel button skin, not the five-phase product flight.
- [ ] U4: Compare course-start, lesson-footer, settlement, empty-state and plans
  surfaces at desktop/phone widths in light/night themes. Observe both reading
  confirmation orders. Keep real routes and explicit component fixtures distinct.
- [ ] U5: Attack every changed assertion for its intended failure, restore it,
  run complete verify and browser gates without lowering coverage, commit and
  push through the normal pre-push hook. Finish main clean and synchronized.

## Source inventory and boundaries

Current source has 17 button call sites in 15 files. Only one JSX button call
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
