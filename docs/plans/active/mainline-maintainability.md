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
- [x] Worktree preparation: extend `scripts/link-studies-into-worktree.mjs`,
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

Stage 2 receipt (2026-09-13): created a new detached checkout at
`.worktrees/mainline-worktree-proof` from stage 1 (`4e5126de`) and applied the
candidate patch, byte-compared with main. Inside it, **`pnpm worktree:prepare .`**
installed the frozen graph, linked **249** missing paths, projected three public
fields (values matched; no deployment token), and baked **131/131** repository
snippets. Tracked imported/lexicon files stayed byte-identical. Four listeners
55993–55996 were individually proven to belong to the new checkout. A busy-port
attempt refused without changing the manifest or terminating the running suite.

The first full browser run was **224 passed / 6 skipped / 11 failed**. The
synthetic planet spec independently derived its origin from the environment,
so the new saved port settings left it pointing at 18093. This was a missed
consumer in the new setup implementation, not an intermittent product failure.
The spec now imports the shared origin; a new source guard first failed on the
old derivation, then passed. The initial tail-only progress reports missed those
mid-log failures; subsequent monitoring counted the entire log. Original failure
log and error contexts are retained. The focused planet rerun passed **11/11**.
Final preparation tests **14/14**, repeated fresh-worktree `pnpm verify` exit 0
(including one real export freshness comparison), and full E2E exit 0:
**235 passed / 6 skipped**, **17.6m**. These are separate receipts, not summed.

The existing product worktree's nested real directory and valid root marker
were read-only checked; it was not moved or run. Relocation is proven with an
isolated marked fixture, preserving both bytes and the old access path. No real
learner surface or server root protection changed. Two full suites running
simultaneously, Windows and physical-device behavior were not tested here.

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
