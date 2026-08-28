---
id: ADR-0008
title: One Locked Technique Per Island Element
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-08-29
domain: architecture
tags:
  - 3d
  - donors
  - budget
pinned: false
related:
  - ADR-0004
  - SPEC-0001
supersedes: []
superseded_by: null
---

# ADR-0008: One Locked Technique Per Island Element

## Context

The procedural map keeps being re-decided at the level of *what technique draws
this thing*. Grass alone has been rewritten three times, twice in opposite
directions. The last reversal happened because a reviewer rejected a donor port
on visual grounds without ever measuring its cost; when the measurement was
finally taken it settled the question in one line.

The measurement, taken 2026-08-28 on the 41-lesson pressure course:

| | per instance | instances | triangles |
| --- | --- | --- | --- |
| our five-leaf clump | 45 | 16,000 | **720,000** |
| elemental-serenity blade | 1 | ≤112,500 | ≤112,500 |
| three-stylized blade | 5–7 | caller's choice | — |

`island-grass.ts` already recorded the whole scene at 777,008 triangles, so
**92.7% of the frame's geometry was grass**. For contrast the entire shipped
Kenney kit — fourteen models including every tree, rock and building — is 2,518
triangles. Trees were never the problem and two rounds were spent on them.

Nothing in the repository recorded which technique had been chosen for which
element, or which alternatives had already been tried and rejected.
`docs/policy/shared-rules/donors.md` records what we are *allowed* to take from
each donor; it does not record what we *took*. Source comments record reasoning
at the point of change, but they do not survive a rewrite — and a rewrite is
precisely the event they need to survive.

The cost of that gap is not aesthetic. It is that two AI sessions and a human
spend their budget re-litigating a settled question instead of spending it on
how well the chosen technique is used.

## Decision

Every visual element of the island has exactly one locked technique, one named
source, and one triangle budget. They live in
`packages/world/src/island/island-technique-lock.ts` as data, are asserted by
`island-technique-lock.test.ts`, and are summarised here in prose.

**A lock may only be changed by amending this ADR, and only with a measurement
in hand.** Changing the code without amending the ADR is a defect, and the test
is what catches it. Adding a technique nobody measured is the failure this
document exists to stop.

The lock's `rejected` list is as load-bearing as its choices. An option that was
tried and lost stays written down with the number that killed it, so the next
session does not spend its budget rediscovering it.

Both donors are MIT and both are already permitted for narrow technique
adaptation by `donors.md`. Elemental-Serenity's media was cleared by the product
owner on 2026-08-28, which changes two entries and not the third:

- **Grass stays our own geometry even though the GLB is now allowed.** A blade
  is three vertices; generating it costs one function against a fetch, a Draco
  decode and 1.2 KB, and it lets the LOD tier vary the segment count, which a
  fixed mesh cannot. Permission removed the obstacle and the answer did not
  change — which is worth recording, or someone will "fix" it later.
- **Trees become the donor's trunk-plus-leaf-card construction**, which is what
  the product owner has wanted since the first comparison. It costs roughly 900
  triangles a tree against Kenney's 114–402, so it is affordable only out of the
  ~640,000 the grass rewrite returns. It therefore lands *after* the grass, not
  beside it.
- **Landmarks become possible at all.** Bridge, camp, tent and rocks are large
  authored props, and a handful of large things is exactly the scale hierarchy
  the art reference has and this island lacks. They get their own ceiling
  because the thing that bounds the frame is their count, not their size.

`docs/policy/shared-rules/donors.md` is portfolio-shared and still records the
old "来源待确认". Updating it belongs upstream in ProjectGovernanceSystem, not
in this repository; only the product-local asset manifest is updated here.

## Consequences

- The grass blade becomes one generated tapered strip whose segment count is
  chosen by the existing LOD tier: a curved blade near the learner, a single
  triangle in the middle band, nothing at the aerial distance. One
  implementation, one parameter, both donors' techniques, no donated media.
- Trees, rocks and buildings stay Kenney CC0 and stay out of the argument until
  a measurement says otherwise. They are 0.3% of the budget.
- The archipelago underside is locked to silhouette, a value break, and one
  bright pixel. Structure is not renderable at the size that projection draws.
- `CLAUDE.md`'s 3D routing row points here, so the lock is loaded before any
  session touches the renderer.
- A future element with no lock entry is not "free to choose": it is missing an
  entry, and the way to add one is to measure, then amend.

## Amendment 2026-08-28: the grass rewrite shipped, and the tripwire caught it

The blade landed. `createIslandGrassClumpGeometry()` is now three vertices and
one indexed triangle; taper, wind bend, camera-facing Y rotation and
terrain-normal replacement all moved into the vertex shader injected through
`onBeforeCompile`, so the material stays `MeshStandardMaterial` and keeps the
island's existing lighting.

This amendment exists because the lock worked as designed. The rewrite was
authored on a branch, merged, and the merge failed
`island-technique-lock.test.ts` on the pinned `45`. Nobody had to remember that
the ADR existed; the test refused the merge until a fresh measurement replaced
the old one. The pin is now `1`, and it changes again only the same way.

Two numbers moved with it, both chosen by looking at the shot rather than by
argument:

- **Segment count is no longer the LOD knob.** The original decision said "a
  curved blade near the learner, a single triangle in the middle band". The
  shipped blade is one triangle in every band and the LOD tier varies instance
  count instead. The `near <= 6` entry stays as a ceiling, not as a shape: it is
  the budget a future curved near-blade may spend, not a description of what
  renders today.
- **Density is 80,000 desktop / 24,000 mobile, not the donor's 112,500.** That
  is roughly the old 16,000 clumps x five visible leaves, so the silhouette
  density the learner already saw is preserved while the triangle count drops
  from ~720,000 to ~80,000. The rest of the saving is deliberately unspent: the
  near-camera art pass decides where it goes, and spending it on more grass is
  the one thing this ADR exists to prevent.

The `island-field` merge landed in the same integration and is the reason the
density number is now safe to tune: grass, dressing and ground colour read one
compiled field, so raising or lowering grass no longer silently disagrees with
where the terrain is painted green.

## Amendment 2026-08-29: the card budget becomes a meadow mask

The 80,000-card ceiling paid back the old five-leaf clump's triangle cost, but
it preserved the wrong visual assumption: one card is concentrated at one
sampled point, while five leaves spread the same clump over a small footprint.
The fixed `course-near` capture used for this amendment is the 41-lesson
`turing-pact/foundations-before-zero` course at 1440 × 900, with the same camera
and seed used for the before/after evidence. Its baseline was:

| measurement | before |
| --- | ---: |
| live grass instances | 80,000 |
| grass triangles | 80,000 |
| island-surface adjacent-pixel gradient energy | 2.8635 L* / pair |
| scene triangles | 432,404 |

The amendment keeps the one-triangle card and changes how much of the shared
field it is allowed to occupy:

- **The course cap is 24,000 desktop / 7,200 mobile**, replacing 80,000 / 24,000.
  The cap is a ceiling rather than a target; at the shipped diorama density,
  the corrected one-card multiplier produces 17,640 desktop candidates. The
  mobile cap is the same 30% device ratio as the previous budget.
- **The one-card density multiplier is 1.0**, replacing 6.4. A card is one
  point sample, not five spatially distributed leaves, so multiplying the
  point count by the old leaf count was an overcorrection.
- **The shared-field cutoff is 0.68**, replacing 0.26, with the existing smooth
  acceptance rising to full acceptance at 0.90. A 256 × 256 sample of the
  compiled field found 87.63% of inside samples at or above 0.26 and 35.79% at
  or above 0.68. This is a mask over `IslandField`'s grass channel, not a new
  noise source; the route, shore, slope and safety checks remain in the same
  planner.
- **The root shadow endpoint is L* 36**, replacing L* 30. The ramp changes from
  `pow(smoothstep(0.2, 0.98, h), 0.5)` to
  `pow(smoothstep(0.08, 0.72, h), 0.72)`, so the shadow is concentrated near
  the lower root instead of consuming roughly half of every card's height.
- **The low-density ground endpoint uses a 1.0 field-to-soil mix**, implemented
  as a smooth `IslandField` grass-channel mask over the existing `DIRT` and
  `DIRT_LIGHT` vertex colours. This makes the same cutoff visible beneath the
  blades; it adds no texture, material, draw or independent noise field.

The geometry lock does not move: the generated card is still one indexed
triangle in the shipped near/mid implementation, and the frame triangle count
must not rise. The final measurement on the same capture is:

| measurement | before | after |
| --- | ---: | ---: |
| live grass instances | 80,000 | 17,640 |
| grass triangles | 80,000 | 17,640 |
| island-surface adjacent-pixel gradient energy | 2.8635 L* / pair | 0.8021 L* / pair |
| scene triangles | 432,404 | 370,044 |
| canvas pixels with linear luminance < 0.08 | 6.248% | 0.271% |
| non-grass island pixels | 22.678% | 36.259% |

For the last row, an island pixel is first required to pass the existing land
segmentation (`HSL hue 40–150° and saturation >= 0.10`, or warm hue <45° and
saturation >=0.12). Within that mask, a grass-colour pixel is `HSL hue 45–165°,
saturation >=0.18, CIELAB L* 36–88`; every other island pixel is non-grass.
The before/after gradient and segmentation were computed from the 1440 × 900
CDP PNGs, counting horizontal and vertical adjacent pairs only when both
pixels were in the land mask. The measured gradient reduction is 71.99%.
The before capture did not reproduce the earlier "near zero" bare-ground
claim: it was already 22.678% under this reproducible criterion. The change
still increases it to 36.259% and, more importantly, exposes the warm field-led
soil regions in the image.
