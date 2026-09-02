---
id: ADR-0008
title: One Locked Technique Per Island Element
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-09-03
domain: architecture
tags:
  - 3d
  - donors
  - budget
pinned: false
related:
  - ADR-0004
  - SPEC-0001
  - REF-ISLAND-LOOK-CONTRACT
  - REF-ISLAND-ART-DIRECTION-V2
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
  the product owner has wanted since the first comparison. The measured
  implementation is capped at 408 triangles per course tree (384-triangle trunk
  plus twelve 2-triangle procedural leaf cards) against Kenney's 114–402, so it is
  affordable only out of the ~640,000 the grass rewrite returns. It therefore
  lands *after* the grass, not beside it.
- **Rocks stay an explicit comparison, not an automatic donor import.** The
  natural-rock rule is not changed by permission alone: Kenney's two shipped
  rocks are measured at 80 and 16 triangles, while `rocks.glb` is a 1,120-triangle
  assembled donor scene. The same course camera and the same foliage environment
  must decide whether that extra geometry buys a quieter silhouette.
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
- Tree trunks and leaf cards use the elemental-serenity projection below; rocks
  remain Kenney until the paired comparison below says otherwise. Buildings stay
  Kenney CC0. The natural assets are still placed from the one IslandField.
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

## Amendment 2026-08-29: painterly donor foliage, with the world projection kept cheap

The product owner changed the natural-element direction: Kenney remains for the
fantasy-town architecture, while trees and bushes use elemental-serenity's
painted-card construction. This amendment is written before the implementation
lock changes, with the source mesh counts measured from the checked-in GLBs and
the frame baseline captured on the 41-lesson `turing-pact / foundations-before-zero`
course at 1440x900, DPR 1, `post=off`, fixed seed and the same camera:

| projection | baseline triangles | baseline draw calls | source measurement used by the new lock |
| --- | ---: | ---: | --- |
| course | 355,172 | 305 | Kenney tree 114/402/246, bush 104; donor trunk variant max 384 + 12 × procedural PlaneGeometry 2 = 408 per tree; 12 cards × 2 = 24 per bush |
| world | 438,964 | 638 | no leaf instances; one donor trunk silhouette plus one 12-triangle canopy silhouette for the selected tree |

The six donor trunk meshes measure 288, 304, 384, 288, 384 and 384 triangles
(2,032 in the assembled `treeTrunks.glb`). `bushEmitter.glb` measures 192
triangles, but it is an emitter only and is never submitted to the renderer.
The foliage cards use the donor's `MeshSurfaceSampler` pattern: bush emitter
surface points provide the position and normal, and tree cards use the same
instanced `PlaneGeometry(1,1)` around the selected trunk crown. The fragment shader
keeps the donor's shadow/mid/highlight normal ramp. The unregistered donor alpha
PNG is intentionally not imported; a procedural UV leaf mask is shared by the
colour and custom depth shaders, so cut-out foliage casts a cut-out shadow
without adding an untracked media dependency.

The world projection is a separate screen-pixel budget: it retains the donor
trunk only as part of the tree silhouette and uses no leaf-card instances. The
course projection is the only place that pays for the 12 leaf cards per tree.
Neither projection creates placement noise; `island-dressing.ts` still reads
the compiled `IslandField`, so this amendment changes stages 3/4 (projection and
style), not stage 2 (the field/data source).

The course shadow pass keeps alpha-aware shadows on both instanced leaf fields,
but omits a second pass for the low-pixel trunk faces. The measured pressure
course therefore renders 340,880 triangles and 288 calls, below the original
355,172 and 305, while retaining the shadow/mid/highlight leaf treatment. This
is a render-budget decision, not a change to the donor trunk geometry.

The rock comparison was then run in the same 1440x900 course shot after the
procedural 2-triangle cards landed and the trunk shadow pass was removed.
Retaining Kenney produced 340,880 triangles and 288 calls; replacing the two
small rock references with the assembled donor `rocks.glb` produced 556,944
triangles and 280 calls (+63.4% triangles). The donor version also repeated
pale assembled clusters across the meadow, which read as noise next to the new
foliage, while Kenney's 80/16-triangle rocks stayed quiet. Kenney is therefore
retained; `rocks.glb` remains registered for landmark use but is not promoted
to the scattered natural-rock projection.

## Amendment 2026-09-03: separate scene geometry from post-processing counts

This is an audit amendment, not a renderer change. At HEAD `9cb6f79`, the real
delivery Vite page was measured at 1440×900, DPR 2, with the fixed course-design
shot:

```text
/turing-pact/foundations-before-zero?shot=course-design&seed=foundations-before-zero&freeze=1
```

With `post-processing` enabled, the settled `__lastStageSceneRender` receipt is
**41 draw calls / 81,278 triangles** for the course scene. A complete desktop
frame was measured by setting `gl.info.autoReset = false`, calling
`info.reset()`, and triggering `invalidate()`: **43 draw calls / 81,280
triangles**. The extra two calls and two triangles are the AO and grade
fullscreen triangle passes, not course geometry.

This resolves two stale scopes without rewriting their history: the older ADR
receipt of **340,880 triangles / 288 calls**, and the later contract snapshot of
**36,090 triangles / 45 calls**, belong to earlier renderer states. The current
lock remains unchanged because this hygiene round does not alter a technique,
material, scene, or budget test. Future reports must label whether they count
the scene pass or the complete post-processing frame; **43 / 81,278** is a
mixed-scope shorthand and should not be used as a precise receipt.
