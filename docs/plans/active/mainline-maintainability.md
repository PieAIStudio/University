---
id: PLAN-MAINLINE-MAINTAINABILITY
title: Mainline Maintainability
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-13
last_reviewed: 2026-09-13
domain: execution
tags:
  - refactor
  - verification
pinned: false
related:
  - REF-CURRENT-WORK
---

# Mainline maintainability

## Frame and contracts

Make the next correct change easier to locate: descriptive E2E names, one
worktree preparation command, a current-work index separated from historical
handoffs, and evidence-selected internal boundaries. Four independently verified
commits; no learner behavior, course slug, publication, brand migration or
renderer technique changes. Keep the catalogue role selector and conditional
multi-study skips. Baseline main `ab9c8df0`, clean and equal to origin; supplied
browser receipt 235 passed / 6 conditional skips. Discovery reconfirmed 241
default cases in 41 files (42 spec files including the separate island judge).

## Stages and evidence

- [x] Topology: rename specs by feature, wire oxfmt/oxlint, move live renderer
  integration assertions to the app while preserving world calibration, remove
  three confirmed dead launch entries. Verify + full default E2E before commit.
- [ ] Worktree preparation: extend `scripts/link-studies-into-worktree.mjs`,
  preserve private/test input, refresh generated inputs, isolate four ports;
  prove one command then verify + E2E in a new in-repository worktree.
- [ ] Documents: reconcile the 11 locked-study references, inspect handoff
  ownership/consumers/value, preserve decisions and evidence, pass docs:check.
- [ ] Internal boundaries: map ports/UI/server boundaries, choose a minimal
  behavior-preserving change or evidence-backed no-op, verify + full E2E.

## Decisions and unresolved items

Stage 1 receipt (2026-09-13): `pnpm verify` exit 0 (137 governed documents;
203 current local links). Default E2E exit 0: **235 passed / 6 skipped**, 18.6m.
The before/after discovery lists preserve all 241 case titles exactly. Focused
renderer integration/calibration: 3 + 13 passes. The calibration prop floor now
uses its own frozen population instead of the unrelated shipped population;
the stronger assertion passed. New lint coverage exposed eight existing
warnings; only unused bindings and equivalent string/regex syntax changed.
Local logs and discovery inventories are in `.scratch/mainline-maintainability/`.

Spec filenames are repository-private navigation, not execution ordering; case
titles remain the historical receipt IDs. All tracked exact filename consumers
move together. Public routes, package names and course IDs do not change.
Live catalogue integration belongs to the application that composes world;
frozen geometry calibration stays in world. A second catalogue or app import
inside a renderer test was rejected. No new package export is needed.

The three dead launch configurations are removed because their target
directories no longer exist. `courses-local-server` and `courses-authoring`
still use the existing sibling checkout: its replacement name is not yet
verified. Correct both after the owner rebuilds that lane under `.worktrees/`;
do not present a guessed future path as working. Independent CutoutStudio and
SwimmerUIKit repositories are untouched. Existing long-lived worktrees and
their isolation inputs are not cleanup targets.

Rollback is by stage commit (revert dependent stages in reverse order). No
source lesson or historical evidence is deleted. Full default browser receipts
must retain at least 235 passes, with the six multi-study cases conditional.
Final push must use the ordinary pre-push hook; no hook bypass.
