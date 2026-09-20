---
id: PLAN-INTERACTION-3D-PLAYLAB
title: Nine Learning Games and Selective Map Object Refinement
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-17
last_reviewed: 2026-09-19
domain: learning-experience
tags:
  - interaction
  - web3d
related:
  - ADR-0009
  - REF-CURRENT-WORK
---

# Nine learning games and selective map-object refinement

Owner authorized a separate experiment based on the committed interaction-first
lane. The course lane and its PRIMM work remain untouched; course content follows
`codex/interaction-first`, never this lane.

Owner authorized the merge on 2026-09-20 and the lane now lives on the mainline.
That authorization covers the code, the routes and the evidence — nothing else.
Publication, package release and changes to donor originals remain unauthorized,
and the retained finishes are still lab findings rather than an approved change
to the map.

## Scope and acceptance

The first three samples were `arcade:stack`, `arcade:invaders` and
`arcade:cloze-tetris`. Their garden upgrades remain live. Six separately named
versions now extend the experiment; see the current work below.
The route `/play-lab/toy-3d` and catalog share one entry adapter.
All are local, deterministic research games; completing one does not mark a
course mastered. No model call, external CDN or account mutation is needed.

The reference is the owner's bright miniature island: rounded solid shapes,
soft glossy highlights, readable contact shadows and a clear play area. This
is an extension of University's world, not a replacement UI theme. Scenery must
not obscure the material, movable object, destination or next action. Text stays
DOM; 3D picking, click/place and keyboard controls share the same state.

Use the existing Stage and its SwimmerRenderKit grade, environment and lifecycle.
Shared scenery, materials, blocks, sockets and feedback live in `packages/world`;
pure game rules have no renderer imports. No second terrain/map pipeline and no
copied grade shader. Share the finish and interaction parts, not an obligatory
scene composition. The garden belongs only to the three retained editions.

Kenney source is read-only. Reuse the already-vendored r01 stall, cart, lantern and
small rock, with the existing manifest's source hashes, pack licenses and texture
dependency. Mini Forest was visually inspected but is not imported. A combined
new-subset import command was safety-status blocked before executing; no retry
or alternate transport was used. Reusing existing assets is a separate, smaller
implementation that avoids donor copying altogether.
Runtime clones may normalize size and tune surface response; the cached original
model and map stay unchanged. The import manifest remains the authoritative asset
ledger; local hash-verification receipts do not replace it.

## Work

### Current: ten real island objects and evidence-led surface refinement

Owner rejected the wax identity, while accepting improvements to some rocks.
Retire the wax-island route and its scattering experiment; retain the original
commit and evidence. Extract selective soft-sculpted shading, not a world skin.
No existing game, island generator, donor source, clay lane or mainline changes.

The comparison uses ten actual map prop sources through the existing asset and
procedural-tree adapters. One original and three independent treatments share
camera, lights, scale, source color/maps and ground. Whole-collection switching
and a large synchronized object pair expose gains and regressions. Never weaken
the baseline, silently combine methods or report pixel differences as quality.

- [x] Verify ten map sources and record the baseline geometry/material contract.
- [x] Preserve soft-sculpted shading without internal-scattering or wax naming.
- [x] Research and test two more mechanisms; reject weak/harmful candidates.
- [x] Build the comparison, actual input and screenshot evidence, controls/phone checks.
- [x] Retire wax runtime/docs, verify source preservation and complete validation.

Retained after four pilots: physical edge rounding with weighted panel normals,
and material-aware finishing with original palette roles, connected-shell wood
direction, correlated roughness/relief and geometry-derived visibility/convex-edge
masks. The latter does not stack soft sculpting or bevels. AO-only was too subtle;
dense AO geometry was rejected for cost. Excess mineral relief and polygon edge
outlines on leaves were also rejected. The foliage exceptions remain visible,
rather than presenting every method as better on every object.

Sources, build commands, primary research and adoption limits live in
`packages/world/src/prop-finish/README.md`. V5 `#prop-finish-lab` owns the experience;
ADR-0008 owns the scoped technique. All ten map source signatures are checked at
runtime; compact buffer SHA-256 and channel bounds fail visibly when stale.
Current UI includes four independent choices, synchronized object pair, ten-object
gallery, actual triangle costs, original source identity and no-grade/mask views.

Evidence: `.devspace-visual/interaction-3d/prop-finish/`, pilots 1–4 and
`acceptance-1/`. The first browser pass found a real recovery defect: viewport
pointer capture swallowed the retry button's click. Inputs inside recovery
controls are now excluded from stage capture. The keyboard test separately
needed to wait for its actual React update before comparing rotations; its
same-view/resource assertions were not relaxed. The combined 55-test comparison,
retained-game and catalog suite passed in `accepted/`. Subsequent screenshot
inspection caught narrow projected names collapsing to one-character lines;
a fixed screen-space label width corrected it. Gallery captures now also wait
for the actual resize/render rather than recording the prior canvas size.
The six comparison tests passed again in `final-comparison/` and, after canonical
asset serialization, `final-assets/`. An independent live review then found the
default gallery clipping a tree crown. Added headroom preserves all ten models;
new assertions project actual mesh vertices, not just DOM labels. The final
`closeout-browser/` run passed all **55** comparison/game/catalog tests (job
`b924f705-480c-462c-ba5a-8e5b860b1a6a`); the original 49 game/catalog tests remain
unchanged. Full `pnpm verify` then passed with unchanged source hashes (job
`a382c9f4-8746-40f5-8ce4-93bcbd8d4e82`, `closeout-verify.json` and `.log`).
Earlier full-gate failures, including physical-direction CSS corrected to logical
`text-align: start`, remain in `verify*.log`; they are not passing evidence.
This is the related browser scope, not the full unrelated product E2E suite.
The Owner walkthrough is `owner-review.md` in that evidence directory;
known costs and counterexamples remain visible rather than claiming a global win.

An independent Blender rebuild exposed only one-ULP differences in interpolated
bevel UVs. Derived UV serialization now has documented 1e-5 precision; two clean
builds match all 31 files exactly (`reproducibility-canonical.json`). The failed
pre-canonical comparison stays in `reproducibility.json`. Source and non-bevel
UVs remain untouched. `preservation.json` checks 212 existing game, map, avatar,
asset and course files against 1f971a93 with zero changes.

### Retired: matte-wax island and avatar slice (Owner rejected the wax identity)

The following is historical implementation/validation evidence, not artistic
acceptance or permission to ship a wax skin. Source checkpoint: `1f971a93`.
The new object refinement comparison replaces this active experiment.

That slice used `browser-ai/run-a-real-project-with-ai`, CourseScene and AvatarKit
with owned material/normal copies and authored-depth light-spreading approximation.
Its 11 unit and 53 related browser checks plus full verify proved technical
behavior, not a convincing wax identity. Owner subsequently rejected the style.
Only selective smoothing continues; runtime island/scattering/owner and old
translation entries are removed. Old bookmarks show a retirement notice.

Original captures, failure/recovery records, preservation and GPU receipts remain
in `.devspace-visual/interaction-3d/wax-slice/`, including `owner-review.md` and
`acceptance.json`; implementation is preserved at `1f971a93`. Do not cite these
as evidence that the new refinement comparison passed. The nine approved games
remain live and the catalogue stays 59 entries/9 games: neither look experiment
is another learning game.

### Previous accepted game-first scene expansion

Preserve all three accepted garden games at `e9267221` as live entries, not only
history. Add six separately addressable versions: cloud-flight, sorting-factory,
sentence-press, information-slice, evidence-wiring, process-train. New scenes are
composed for their mechanics; only the rounded/wax material language is shared.
The first three reuse the existing simulations with an explicit scene edition.
The other three adapt `arcade:slice`, `blocks:wire`, `blocks:rank`; retain their
sources and record all departures from their rules. No new branch, course change,
donor mutation, package release, merge or push is part of this work.

- [x] Six game-specific scenes and three additional playable mechanics.
- [x] Nine catalog entries with original three deep links preserved.
- [x] Actual gameplay, preservation, mobile/desktop and pause/restart checks.
- [x] Visual inspection, corrections and final project checks; ready for Owner trial.

Design lives in V5 `#game-first-scenes`. Evidence for this expansion uses
`.devspace-visual/interaction-3d/game-first/`; older acceptance is not counted
as evidence for the six new versions.

Live new IDs: `three:sky-invaders`, `three:factory-stack`, `three:press-words`,
`three:slice`, `three:wire`, `three:rank`. Original `three:invaders`, `three:stack`
and `three:cloze-tetris` remain the garden edition. The catalog identifies these
roles visibly and search can find the retained editions without a hidden archive.

The switchboard replaces the short one-pass connector with three circuits and
explicit checking/repair; it supports both cable dragging and click/keyboard.
The process train accepts any valid prerequisite order, including independent
photo/record checks in either order, rather than enforcing a single answer list.
The slicer has a finite 24-item deck and three wrong-cut limit instead of a
one-minute timer; ignored claims are never counted as independent correct answers.
These are declared gameplay changes, not claims of exact mechanical porting.

Inspected failure evidence remains in `pilot-1/` through `pilot-4/` and the
named screenshots. Early projection aliasing collapsed controls; a later
world-z versus view-plane mismatch hid physical lower tiles behind the case.
`board-projection.ts` and the physical-body ray regression now cover that issue.
The wire-drag test waits for the normal hover actionability check before using
screen coordinates; it does not force input or alter the simulation.

A later live 320px slicing check exposed two capsule labels overlapping as their
ballistic paths crossed. `CapsuleLabels` reuses `layoutTargetLabels`, preserving
font size, both targets and their physics; leaders attach to actual capsules.
The original collision is in `slice-crowding-observed.png` / `.json`, and the
Chinese/English crossing plus physical slicing regressions passed in
`slice-clearance-fixed/`. A missing local Vercel CLI on the connector PATH stopped
one test-server startup; it was an environment failure, not a passing test.


Acceptance after the capsule-label correction: full `pnpm verify` passed, then
the combined new-scene, retained-arcade and catalog browser suite passed **49 tests**.
Both exited 0. `game-first/closeout-recheck.json` records the exact validation job
identities and application commit; final browser artifacts are in `final-49/`.
The earlier 47-test run and its logs remain in `accepted/` as prior evidence.
This is the related browser scope, not the entire unrelated product E2E suite.
Ten protected source files still match e9267221; no tracked file was deleted and
no recovery/content package changed. The current walkthrough is `game-first/owner-review.md`.

The first verify failed in an old unconfigured-grading-service fixture that
inherited a public local service URL. The test now explicitly clears that
environment key, restores it afterward and asserts that fetch is never called.
Production grading, local credentials and service configuration were not changed.
The original failure and isolated recheck remain alongside the passing final run.

### Previous accepted gameplay correction at e9267221

The owner accepted the visual style but rejected replacing the original games
with sequential quiz workstations. Retain the approved shared Kenney/toy parts;
build three actual arcade loops and add a `3D组件` catalog category. Keep every
2D prototype and the separate course worktree untouched. The earlier receipts
below describe the superseded quiz interaction, not acceptance of these games.

- [x] Continuous shooting with movement, collisions, diving, ten waves and upgrades.
- [x] Falling classification pieces with real stacking, combo, loss and finite goal.
- [x] Rising sentence rows, six word tiles, physical placement, clearing and delayed review.
- [x] Shared embedded/standalone player, catalog group, local-only scores, pause lifecycle.
- [x] Real input, losses/wins, responsive screenshots and focused verification.

### Previous implementation and verification inputs

The actual arcade runtime is described once in `packages/world/src/toy-play/README.md`.
The approved garden, Kenney files, palette maps and shared Stage are retained.
Unused quiz-only renderers, routes and tests were removed; no 2D prototype was
deleted. New IDs `three:invaders`, `three:stack`, `three:cloze-tetris` identify
upgrades alongside, not instead of, their eight arcade inspiration entries.

Gameplay changes include real falling/shot collisions, six available word chips,
complete-sentence reading before a row clears and later repetition of a missed
sentence. All inputs reach the same fixed-step simulation. Pause is synchronous
at the simulation boundary, not merely a React overlay. There is one host for
embedded and standalone play, with keyboard alternatives and shared audio settings.
Word planks and foreground chips are genuine lit meshes with readable DOM words;
viewport-derived datums prevent mobile controls from shrinking or overlapping.

The prior export-freshness problem was resolved by isolating test inputs, not by
changing any course or bypassing the exporter. The native recovery importer first
validated then restored this branch's two committed recovery packages into
`.scratch/arcade-campus`. The public-document study has no invented repository;
browser-ai uses its actual registered source and pinned commit. The existing
`worktree:prepare --studies-root` command selected that marked directory without
changing main's private studies, course worktree, tracked lesson bytes or guard.
The fresh check now confirms both exports match. Import/prepare receipts are
`gameplay-campus-ai.json`, `gameplay-campus-browser.json`, `gameplay-prepare.log`.

Current evidence uses the `gameplay-*` prefix under `.devspace-visual/interaction-3d/`.
Initial failures (post-pause simulation drift and projected mobile word overlap)
remain in pilot-1; the fixes were independently rerun. Pilot-3's zero-word-box
assertion was a premature DOM read after starting, corrected by waiting for the
six actual buttons before measuring them. None of these old failures or the
superseded quiz's passing tests is a current full-suite result.

Final focused browser run: **21 passed**, covering both modes, complete falling/
word rounds, keyboard/pointer/drag/touch, pause and context recovery, English
phone labels and retention of all 50 original catalog entries. The two extra
visual guards check real target-body visibility from both spawn sides and three
simultaneous mobile labels. The original caption-overlap failure and repaired
frames are preserved in `gameplay-crowding-before/` and `gameplay-crowding-after/`.
The stable final browser evidence is `gameplay-acceptance-final/`, with
`gameplay-e2e-final.log` and `gameplay-e2e-final.exit` (0). This is the default
browser lane filtered to this work and catalog integration, not a claim that
the unrelated full browser suite was rerun.

The first full `pnpm verify` passed. The final run after annotation/clearance
refinements is recorded separately in `gameplay-verify-final.log` and its `.exit`.
The current Owner walkthrough is `gameplay-owner-review.md`, not the historical
workstation brief. Source fingerprints live in `gameplay-source.json`.

Resumed walkthrough found a real night-theme regression: page-relative ink became
pale while the physical word tiles stayed cream. `contrast-before` reproduces
about 1.09:1 against actual WebGL pixels. The word/rack/drag labels now use the
existing light-surface ink pair; both themes and desktop/mobile frames were
inspected. Four contrast guards keep the 4.5:1 threshold and wait for real
mesh/DOM alignment plus a rendered frame before sampling. The earlier light-phone
sample taken before that frame is retained in `resume-final-browser`, an
interrupted diagnostic run rather than a pass. `contrast-after.log` records four
passing guards. Current closeout receipts use `resume-verify.log`,
`resume-browser-accepted.log` and `resume-exits.txt`: full `pnpm verify` passed
with `VITEST_MAX_WORKERS=2`, and all 25 relevant browser checks passed, each with
exit 0. The browser set includes both application modes, actual game input,
completion/retry, source/focus/context pause, catalog retention, touch layouts
and the four theme/physical-material contrast guards. It is not the unrelated
whole-browser suite. `resume-source.json` fingerprints the accepted source;
`resume-browser-accepted/` retains the final screenshots. Original 2D source,
course recovery packages and Kenney bytes are unchanged.

### Previous visual prototype (historical)

- [x] Isolated branch at `8d91fb07`, preparation completed without generated diffs.
- [x] Inspect registered donors, pack previews, licenses and actual GLB texture links.
- [x] Reuse selected models; implement shared toy parts and three playable rules.
- [x] Desktop/mobile, error, completion, restart, pause, keyboard and renderer-failure checks.
- [x] Inspect actual screenshots, batch corrections, measure submitted resources.
- [ ] Run focused tests, `pnpm verify` and relevant/default browser checks; retain failures.

Keep iteration receipts in `.devspace-visual/interaction-3d/`. Report actual test
and visual evidence separately from unmeasured learning outcomes and phone FPS.

## Historical acceptance: visual prototype at 7fb5906a

The previous three quiz workstations were offered for Owner trial, not repository-wide
release clearance. Their walkthrough and failure chronology remain in
`.devspace-visual/interaction-3d/owner-review-brief.md`.

All 3,225 unit tests passed, as did type checks, lint, format checks and both
builds. `VITEST_MAX_WORKERS=2` used Vitest's supported invocation setting to
reduce contention; no assertion, timeout or file coverage changed. The full
`pnpm verify` then exited at export freshness: this worktree's local authoring
configuration reads the main directory's private study source, while its tracked
`understanding-ai` recovery package is the branch snapshot. They differ. No
course files, source binding, exporter or guard were modified to make it green.
The checks after that gate were run separately; the new plan was registered with
`pnpm doc-gov scan`, and the final documentation checks pass without warnings.

The broad default browser run was started but interrupted before completion; it
is not a passing full-suite receipt. The final focused run is
`e2e-toys-verified.log`: all 17 checks passed with exit code 0, including both
physical drag paths, 320/390 touch layouts, full rounds in both modes, and real
WebGL context loss/reopening. The receipt is in `final-exit-codes.txt`.
These old tests do not accept the later gameplay correction. The live-source
difference is now resolved through the isolated input workflow above; current
gates, not this historical record, decide the integration boundary.

Learning skipped: the verified material ownership and layout corrections are
already captured in this plan, the module README and the test/evidence files;
there is no separate new reusable lesson to publish.

## Historical workbench design (superseded)

The existing prototype IDs select three adaptations: a parcel sorter, a two-gate
boat route and a word-fitting workbench. These are not feature-identical ports
of the earlier shooting/rising-stack prototypes. Default play has no deadline;
an opt-in 25-second challenge offers continuous rounds and stops for errors.
The current data is a bounded Earthrise practice set, not a rewritten AI course.

`packages/world/src/toy-play/parts.tsx` owns the common garden, bridges, trees,
boxes, sockets, lamps and material cache. `geometry.ts` builds the bevelled toy
plinths and a word board with an actual opening. These are manufactured scene
props, not another generator for course islands. `ToyScene.tsx` composes those
parts around the same reducer; DOM buttons, pointer picking and ground-plane
dragging reach the same actions. All learner text remains DOM and bilingual.

The stall, cart, lantern and rocks reference the existing r01 manifest, including
its texture hashes and CC0 license records. The runtime owns only cloned
materials: surface roughness/clearcoat and a source-local striped stall roof
(`y >= .305` on the retained stall model, with antialiased UV-independent bands).
Cached geometry, the palette texture and the donor originals are not edited.
Round trees and interaction objects are procedural shared parts. No Blender,
texture bake, new asset download or separately released portfolio kit is needed.

The existing Stage owns the renderer, environment, grade, tone-map and output
encoding. A DEV-only `toy-post=off` query provides a raw-scene comparison; normal
play retains the shared render pipeline. The scene stops rendering offscreen,
when the page is hidden or when paused. Clock and auto-advance also stop while
reading source details. WebGL loss switches to the same rules and current task
in the simple view; opening 3D again must not erase the round.

On narrow screens, projected labels use large numbered controls backed by the
full labels next to the question. Feedback scrolls into the readable area and
the next item returns to the question. This is a responsive layout of the same
component tree, not another mobile game. Round completion reports first attempts
separately from corrected answers and never updates lesson mastery or XP.
