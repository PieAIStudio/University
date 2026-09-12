---
id: REF-LEARNING-WORKFLOW-ISSUES-A-LIST-OF-KINDS-GOES-STALE-IN-EVERY-COPY-AT-ONCE-CHECK-IT-AGAINST-THE-WIRE-ENUM
title: "A list of kinds goes stale in every copy at once; check it against the wire enum"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-10
last_reviewed: 2026-09-10
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# A list of kinds goes stale in every copy at once; check it against the wire enum

## Guidance

Symptom: adding the eleventh activity kind (sort) left /play-lab offering ten, and three e2e fixtures pairing games with the wrong engine — all silently. Root cause: the same list was written out five times — LessonActivityKindSchema (the wire enum), FOUNDATION_MODES in LearningPlayLab.tsx, and three parallel arrays in the Playwright specs (labels, engine kinds, first-step locators) read by shared index. Nothing compared any copy to any other, so each stayed correct on its own and wrong together; a fixture list also only fails where something reads it, which is how e2e/P and e2e/R had both been red on their first click with a label ('因果接线台') the button stopped using. Proven fix: LearningPlayLab.test.tsx holds the page's shelf against LessonActivityKindSchema.options in both directions, plus asserts every offered kind has a fixture whose three tiers the engine accepts (isValidSortActivity); the spec's parallel arrays became a label-to-kind record so position cannot pair them wrongly. Verified: the guard is red before the fixture lands and green after, four attack edits each turn one guard red, and pnpm verify plus the full Playwright default project pass. Apply whenever a discriminated union grows a member: find every hand-written enumeration of it and point one of them at the runtime enum rather than at another hand-written list.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
