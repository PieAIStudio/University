---
id: PLAN-INTERACTION-3D-PLAYLAB
title: Three Shared Toy-Scale Interaction Experiments
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-17
last_reviewed: 2026-09-17
domain: learning-experience
tags:
  - interaction
  - web3d
related:
  - ADR-0009
  - REF-CURRENT-WORK
---

# Three shared toy-scale interaction experiments

Owner authorized a separate experiment based on the committed interaction-first
lane. The course lane and its uncommitted PRIMM work remain untouched. No merge,
push, publication, package release or changes to donor originals are authorized
by this experiment.

## Scope and acceptance

Fixed samples: `arcade:stack`, `arcade:invaders`, `arcade:cloze-tetris`.
New route: `/play-lab/toy-3d`, also linked from the existing catalog.
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
copied grade shader. One small composition is shared by all three variants.

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

### Owner-requested gameplay correction (current)

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

### Current implementation and verification inputs

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
