---
id: PLAN-MAINLINE-MAINTAINABILITY
title: Mainline Maintainability
type: plan
status: completed
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
- [x] Documents: reconcile the 11 locked-study references, inspect handoff
  ownership/consumers/value, preserve decisions and evidence, pass docs:check.
- [x] Internal boundaries: map ports/UI/server boundaries, choose a minimal
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

Stage 3 receipt (2026-09-13): `pnpm docs:check` exit 0, 137 governed documents,
219 current local links, no warnings. The two newly archived documents were
additionally parsed with the existing Markdown parser: all six local links
resolve (the ordinary links gate excludes archives). Current Work shrank from
135 to 109 lines by moving the completed overlap map, not deleting its rationale.
The original 11 slug-matching documents were confirmed: eight live references
were clarified; three already archived, explicitly dated records were retained
unchanged. Additional stale current denominators in publish-lane, prerender and
the original product review were corrected as historical measurements. No live
inventory is copied into a second catalogue; the runtime shelf observed here was
one study, four courses, nine units and 27 lessons. No slug/package was changed.

## Document disposition

The reviewed execution directory had 18 Markdown documents. Names below refer
to that original directory; ownership is retained. No original media was deleted.

| Document | Owner / remaining consumer and value | Decision |
| --- | --- | --- |
| `current-work.md` | human; task router | Condense; move completed overlap analysis into the archived course handoff, retain current decisions and next-step links |
| `liquid-and-difficulty-handoff.md` | human; former current-work entry, completed course/kit handoff, unresolved result-sink finding | Archive with all evidence and rejected trials; move history link out of active lanes |
| `3d-references.md` | human; related by completed island plan, original research/provenance | Archive; current camera/renderer choices already belong to V5 and ADRs, not this dated recommendation |
| `island-look-contract.md` | human; island-look-review skill and ADR links, ongoing measurements/negative knowledge | Keep path and evidence; distinguish historical thresholds from current tests/ADRs and correct current projection terminology |
| `island-art-direction-v2.md` | human; ADR/contract references, rejected hex/planet trials | Keep history; remove the conflicting claim to own current visual decisions |
| `i18n-strategy.md` | human; localization workflow and revision policy | Keep; old private-source file count is not a current shipping/cost denominator |
| `publish-lane.md` | human; delivery operators and prerender evaluation | Keep current workflow authority; explicitly date old inventory/build receipts and route setup to baseline |
| `addressable-lessons-prerender-evaluation.md` | human; pending publishing choice/cost study | Keep pending; do not reuse 579 historical lessons as today's decision denominator |
| `v5-journey-review.md` | human; current-work and product-design rationale | Keep; historical private identifiers do not describe shipped content, recommendations are not implementation proof |
| `swimmer-backend-migration.md` | human; adjacent unique SQL and backend operator | Keep pending; remote execution/RLS unverified, remove stale numbered-index pointer |
| `payment-backend-gap.md` | human; product/current-work, external payment authority | Keep; no evidence authorizes closing its service/owner-dependent work |
| `feedback-backend-gap.md` | human; current-work, external feedback delivery | Keep; current task does not verify remote service rollout |
| `review-reminders-backend-gap.md` | human; current-work/V5, sender/device acceptance | Keep; no sender/delivery proof obtained here |
| `commercial-model.md` | human; product/payment decisions | Keep; no authority to change business/charging policy |
| `local-device-testing.md` | ai-assisted; preview/device operators and current-work | Keep; route fresh setup to the tested command, preserve old device evidence and explicit unknowns |
| `product-completeness-review.md` | ai-assisted; product plan, original findings/images | Keep original evidence; old catalogue counts explicitly remain at their capture date |
| `product-before-after/before-after.md` | ai-assisted; product plan and user-facing comparison | Keep stable with original images; not a second current task list |
| `product-before-after/first-pass-comparison.md` | ai-assisted; later comparison's history link | Keep stable historical counterpoint; original before/after evidence cannot be regenerated as that past state |

## Internal boundary choice

Stage 4 selects the loopback bootstrap/session owner, not a generic HTTP
framework. Reader, grader and workbench depended on the entire content adapter
only to reach its shared opening/request token. `ports/local/bootstrap.ts` now
owns that existing cache, URL-tagged JSON read and the identical per-action
JSON/token headers. All consumers move together; no public port, request path,
payload, account/progress write, grader tier or observable UI changes.

Six characterization tests passed against the original implementation before
the move. They preserve shared pending/resolved promises, failure eviction,
late-failure versus refresh ownership, shared reader/grader token bootstrap,
token refresh on an already constructed reader, and per-action injected tokens.
After the move all 17 local-adapter tests, app typecheck and lint passed. Full
mainline verify/E2E remain the final acceptance, not inferred from that subset.

Map result: UI package metadata/source has no three or react-three imports;
existing server/browser boundaries remain governed by `pnpm boundaries`.
The ordinary mode switches cover ports, studio access and analytics metadata.
One source-access-oriented world annotation bypasses ports outside studio;
its source fact and unverified runtime condition are recorded in the active
[product plan](../active/product-completeness.md),
not silently fixed or certified by this behavior-preserving change. No physical
device, real multi-account backend, paid grading or airlock-enabled parity
acceptance was performed. The reader and grading wire contracts remain intact.

Final local receipt (2026-09-13): `pnpm verify` exit 0, including 281 application
tests (six additional characterization cases), 14 preparation tests and the
existing boundary/build gates. Full default E2E exit 0: **235 passed / 6 skipped**,
**18.6m**. A final discovery comparison preserved all **241 original case titles**.
The protected recovery/locked packages, core contracts, E2E catalogue selector
and entire CTA directory have no diff from `ab9c8df0`. Renderer production code
was not changed; only the named catalogue test ownership moved in stage 1.

## Closeout and recovery

All four local stages are accepted separately. The normal Git push/pre-push is
the remaining release operation; this local record does not assert its outcome.
The task's final delivery message reports the actual push result. Nothing was
deployed, no payment was enabled, and no hook was bypassed.

Intentional changes are developer-facing: feature-named spec paths, format/lint
coverage, one safe preparation command and four-port routing, current-versus-
historical document roles, and internal bootstrap ownership. Learner behavior,
public lesson identities, publication boundaries, grading tiers, header/payload
contracts, shared UI/renderer ownership and original decision evidence remain.

Rollback uses the four stage commits in reverse order. Documentation moves are
recoverable in Git. Preparation does not delete source inputs: a relocated
isolation root remains accessible at its old linked path; old shared content
links are retained as restoration receipts. Existing owner environment files
are never overwritten. Generated caches/configuration can be recreated by the
same preparation command; do not blindly remove private studies to roll back code.

The task-owned proof worktree was removed after copying its candidate patches,
failed and successful logs, browser evidence, screenshots and port settings to
`.scratch/mainline-maintainability/`. All pre-existing worktrees remain. The two
course launch entries still point to the verified existing sibling checkout;
the owner-led reconstruction must correct both once its actual new path exists.

Verified versus not verified: default real-browser regression and final static/
build gates passed; the active airlock world-annotation condition was only
source-audited, not browser-reproduced. The second real shipped study remains
locked, so its six cases remain conditional. No Windows/physical-phone pass,
simultaneous full-suite pressure test, real multi-account/RLS or paid-service
acceptance, legacy-worktree reconstruction/sync, or fresh upstream license review
was performed. Those absences are not green gates or waived requirements.

Learning closeout: no new learning document. Maintained baseline/E2E guidance,
the updated existing worktree learning and the new regression guards already
own the reusable guidance; the dated failed run belongs to this execution receipt.

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
