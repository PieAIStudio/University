---
id: ARCHIVE-ADR-0008-2026-09-07
title: ADR-0008 Measurement History Through 2026-09-07
type: archive
status: archived
canonical: false
owner: human
created: 2026-08-28
last_reviewed: 2026-09-07
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

> Historical decision and measurement snapshot. Read the concise current
> [ADR-0008](../adr/ADR-0008-one-locked-technique-per-island-element.md) first.
> Successive amendments below describe different implementations and fixtures;
> old techniques and counts are not simultaneous requirements or current passes.

## Context

The procedural map keeps being re-decided at the level of _what technique draws
this thing_. Grass alone has been rewritten three times, twice in opposite
directions. The last reversal happened because a reviewer rejected a donor port
on visual grounds without ever measuring its cost; when the measurement was
finally taken it settled the question in one line.

The measurement, taken 2026-08-28 on the 41-lesson pressure course:

|                          | per instance | instances       | triangles   |
| ------------------------ | ------------ | --------------- | ----------- |
| our five-leaf clump      | 45           | 16,000          | **720,000** |
| elemental-serenity blade | 1            | ≤112,500        | ≤112,500    |
| three-stylized blade     | 5–7          | caller's choice | —           |

`island-grass.ts` already recorded the whole scene at 777,008 triangles, so
**92.7% of the frame's geometry was grass**. For contrast the entire shipped
Kenney kit — fourteen models including every tree, rock and building — is 2,518
triangles. Trees were never the problem and two rounds were spent on them.

Nothing in the repository recorded which technique had been chosen for which
element, or which alternatives had already been tried and rejected.
`docs/policy/shared-rules/donors.md` records what we are _allowed_ to take from
each donor; it does not record what we _took_. Source comments record reasoning
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
  lands _after_ the grass, not beside it.
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

| projection | baseline triangles | baseline draw calls | source measurement used by the new lock                                                                                                     |
| ---------- | -----------------: | ------------------: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| course     |            355,172 |                 305 | Kenney tree 114/402/246, bush 104; donor trunk variant max 384 + 12 × procedural PlaneGeometry 2 = 408 per tree; 12 cards × 2 = 24 per bush |
| world      |            438,964 |                 638 | no leaf instances; one donor trunk silhouette plus one 12-triangle canopy silhouette for the selected tree                                  |

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

## Amendment 2026-09-06: course terrain mesh triangles

Course islands now submit `buildIslandGeometry(..., "course")` instead of hex
tiles. That mesh is the existing continuous generator; it is now recorded in
the technique table. The indexed
triangle counts below were measured 2026-09-06 from the generated
`BufferGeometry` (not a live scene receipt, not a post-processing frame):

| lessonCount | seed         | course mesh triangles |
| ----------- | ------------ | --------------------: |
| 6           | `terrain/6`  |            **11,130** |
| 12          | `terrain/12` |            **11,328** |
| 24          | `terrain/24` |            **11,904** |
| 41          | `terrain/41` |            **12,720** |

Study/course ids for the fixture were `turing-pact` / `terrain-{count}`. The
count grows with the in-mesh soil path as the centreline lengthens; it is not
a second route draw. `island-technique-lock.ts` now has a `terrain` entry and
pins these four numbers. A later live-frame receipt (dressing + foliage) is a
different scope and must not overwrite this mesh measurement.

## Amendment 2026-09-06: measured solid foliage candidate

The ordinary 1440×900 course view after road and light corrections still shows
intersecting flat crown cards and fragmented shrubs. V5 decision K therefore
changes the course projection to compact rounded volumes while retaining the
registered donor trunks and the existing placement plan. The world projection
keeps its current silhouette and pays none of this additional crown geometry.

Measured directly with installed Three.js 0.185.1 before implementation:
`IcosahedronGeometry(1, 1)` emits **80 triangles**; detail 0 emits **20**.
Three shared detail-1 crown lobes plus the largest 384-triangle donor trunk
therefore bound a course tree at **624 triangles**, below the existing 900
ceiling. Three detail-0 lobes bound a shrub at **60 triangles**. Lobes share
one instanced field per vegetation kind, with standard scene lighting; the
world projection does not instantiate them. This replaces course alpha cards,
not the donor trunks or the source of placement coordinates.

For 74 trees the crown-only colour-and-shadow geometry rises from 3,552 to
35,520 triangles. This is a primitive budget measurement, not a live GPU or
whole-frame performance result. Final acceptance still requires paired normal
course screenshots and a labelled live scene receipt. The rounded-card trial
stays recorded as rejected because its flat overlapping discs remain visible
in the ordinary close and overview views, even after the light correction.

## Amendment 2026-09-06: clipped soil and learning medallion measurements

The later road implementation clips the authored soil ribbon against actual
terrain triangles. The earlier 11,130–12,720 mesh receipt above belongs to the
pre-clipping implementation and is retained as history. The same
`turing-pact` / `terrain-{count}`, seed `terrain/{count}` fixtures now measure:

| lessons |   top | clipped soil | cliff | total indexed triangles |
| ------- | ----: | -----------: | ----: | ----------------------: |
| 6       | 9,888 |        4,482 |   864 |                  15,234 |
| 12      | 9,888 |        4,053 |   864 |                  14,805 |
| 24      | 9,888 |        6,068 |   864 |                  16,820 |
| 41      | 9,888 |        5,877 |   864 |                  16,629 |

These are geometry counts, not full-frame measurements. The clipping introduces
no second terrain draw. Forty-seven CPU road regressions cover five route
archetypes at 6/24/41 lessons: emitted soil sits 0.002 above the terrain,
authored interior and near-edge samples have no holes, overlapping area stays
below 1%, and interpolated normals differ by less than 0.5 degrees.

V5 decision L replaces the solid coral hex lesson marker with a pale bevelled
medallion. The measured shared 14-segment lathe has **168 indexed triangles**;
the existing notched unit rings, extracted into `unit-sigil.ts`, have **48–50**
each. Rings are instanced by arc count, at most six groups; readable text stays
DOM. This records the upper marker candidate, not completed contact acceptance:
four terrain fixtures still fail rigid-body contact. A discreet continuous
footing is being measured to close those gaps; its cost and final contact
result must be recorded before the marker is accepted as complete.

## Amendment 2026-09-06: bounded marker contact and complete landscape assemblies

The medallion is now one **168-triangle** shared lathe, not the former four
carved-stone variants. Its 48–50-triangle unit engraving is a separate instanced
batch per arc count (at most six); the winding is tested to face +Y. A nonzero
absolute area had previously accepted a downward, invisible engraving.

The footing is one merged mesh per course. It splits its lower edge at the
actual drawn terrain's triangle boundaries and embeds it by 0.01 units. The
exposed-height ceiling remains **0.25**. For a failed initial stance, a bounded
25-plane search with at most three raises per candidate tries a better fit;
an unresolved stance becomes a shallow terrain-clipped inlay at the same
lesson position, radius and ID. The inlay retains the unit engraving and an
explicit face-to-lesson picking range. It does not remove the lesson, raise the
pedestal ceiling, add unit terraces, or catch and ignore an exception.

The expanded 120-case seed envelope caught two real 0.260/0.253-unit failures
before recovery was added. The envelope plus the existing contact/body tests
then passed 140/140; separate adversarial tests force and verify the inlay.
The later world package run passed 639 tests in 71 files. Those are geometric
and behavioral checks, not a claim about physical-phone frame rate.

The `delivery-budget.test.ts` fixtures use `turing-pact / foundations-before-zero`,
the default seed and explicit switchback, at the three counts below. They are
**different fixtures** from the `terrain/{count}` table above:

| lessons | terrain | merged footing | inlay | marker body + unit rings |
| ------- | ------: | -------------: | ----: | ------------------------ |
| 6       |  15,101 |            814 |     0 | 168 + 48–50 per lesson   |
| 24      |  18,078 |          3,292 |     0 | 168 + 48–50 per lesson   |
| 41      |  20,906 |          5,594 |     0 | 168 + 48–50 per lesson   |

One Node 24/M1 Max measurement on these fixtures took 172/147/179 ms for terrain,
259/358/389 ms for the cold dressing plan, and 162/242/321 ms for marker layout.
The cached plan returned in 0.31/0.12/0.12 ms. These are single-run CPU generation
measurements, not a frame budget or browser load-time promise.

The registered Kenney rock alternatives are 16 and 80 triangles. Neither has
the circular, consistently bevelled top needed for the existing unit engraving;
the 168-triangle generated body is retained instead of disguising a rock as a
lesson or loading a GLB for every node. The old solid orange hex top is retired.

The academy is a complete four-wall room plus one roof at a shared source scale,
not a line of walls with unsupported roofs. The camp is a tent facing a lit pit.
The registered bridge's decoded support pads and arched plank lower envelope
govern placement; its normalized model origin is not its walking-deck height.
Only real supported depressions admit it. The ordinary pressure island instead
uses its existing stone rest clearing, with the rejected bridge's reason retained.
The six-landmark-place budget counts semantic assemblies/outposts, not individual
walls in the same building; the 8,000-triangle ceiling still applies to each asset.

Course tree trunks are 0.68 of complete tree height so the donor branches stay
inside the three rounded crowns. Their geometry and 624-triangle tree ceiling
are unchanged. Trees now form separated groves with whole-crown clearance, and
lights belong to facilities. The rejected uniform coastal tree ring looked like
a fence in the ordinary view; adding more instances would reinforce that defect.

Ordinary desktop and narrow viewport captures were made at 1440×900 / 375×812,
light theme, DPR 1, with real mouse pan/zoom. They show the camp, complete academy,
route middle, endpoint and coast. A paired camera-side correction keeps following
lessons in the open viewport; the avatar marker faces the camera while the kit
retains ownership of gaze/blink/breath. On the pre-final composition snapshot the
scene receipt was 121 calls / 145,582 triangles; full Stage frames were 123 / 145,584
on desktop and 122 / 145,583 on narrow desktop simulation (the latter omits AO).
Both used Chrome/ANGLE Metal on an Apple M1 Max, not a physical phone. Final
release receipts belong in the delivery plan, rather than overwriting these scopes.

## Amendment 2026-09-07: remote catalogue projection alignment and foliage path distinction

The earlier 2026-08-29 amendment recorded the world projection's foliage as
"one donor trunk silhouette plus one 12-triangle canopy silhouette" (measuring
up to 396 triangles per tree) based on importing `treeTrunks.glb` into world
dressing. With the continuous distant island delivery implemented via
`RemoteIslandField` and `RemotePropsField`, the active catalogue and archipelago
views run a shared, low-cost procedural pipeline (ADR-0009). The global planet view
(`PlanetScene`) originally set `showProps=false` (leaving study islands bare);
this amendment records the activation of `RemotePropsField` in `PlanetScene` as well,
giving planet islands the same lightweight silhouette identities.

This amendment aligns the decision record with the active implementation and
distinguishes the two world-level foliage/props paths:

### 1. Active Remote Catalogue Projection (`RemoteIslandField` + `RemotePropsField`)

The actual distant views in `WorldScene` (catalogue archipelago) and `PlanetScene`
(global study picker) render all islands via shared, batch-instanced procedural
geometry with zero course GLBs:

| Element                | Locked Technique & Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                Indexed Triangles per Island |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------: |
| Terrain                | Shared `buildIslandGeometry(..., "world", radius)` continuous mesh in `RemoteIslandField` (352 top + 288 cliff, 0 route clips). Merged into 1 single `BufferGeometry` draw call across all catalogue islands.                                                                                                                                                                                                                                                                                                                            |                                     **640** |
| Landmark               | Up to 1 procedural stone pavilion silhouette in `RemotePropsField` (`createRemotePavilionGeometry()`): 12-triangle roof cone (`ConeGeometry(0.52, 0.36, 6)`) + 24-triangle plinth cylinder (`CylinderGeometry(0.38, 0.44, 0.38, 6)`). Positioned at hero anchor and heading `-hero.heading`. Candidate positions undergo bounded inward search (`[1, 0.85, 0.7, 0.55, 0.4, 0.25]`) and are omitted if not strictly inside terrain bounds. Anchor sampled on worldmesh elevation; ground slope remains across the base. Zero course GLB.  |                         **0–36** (up to 36) |
| Tree                   | Up to 2 to 4 procedural hexagonal cone tree silhouettes in `RemotePropsField` (`createRemoteTreeGeometry()`: `ConeGeometry(0.38, 0.72, 6)`). Placed against blueprint anchors with bounded inward candidate search; omitted if 5-point footprint does not fit strictly inside. Ground anchors match worldmesh height on the same triangle face, but ground slope still exists across the footprint (no claim of strict 0-gap / zero floating or universal 2–4 trees). Zero course GLB (`treeTrunks.glb` is not fetched or instantiated). |    **0–48** (12 per tree, max 4 trees = 48) |
| Props Total            | Up to 1 landmark + up to 2–4 trees in 2 global `InstancedMesh` draw calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                |            **0–84** (bounded upper ceiling) |
| **Island Batch Total** | **1 merged terrain mesh + 2 global instanced props meshes**                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **640–724** (terrain + props upper ceiling) |

53 islands is a synthetic test fixture (`test-fixtures`); the active production
catalogue currently contains 44 real courses. Across synthetic 53-island test fixtures,
the island terrain and remote props batches produce an upper ceiling of 3 GPU draw calls:
one merged terrain mesh (33,920 triangles) plus two global `InstancedMesh` batches
(53 landmarks = 1,908 triangles; 172 trees = 2,064 triangles; total remote props = 3,768
triangles). This 3-draw-call ceiling applies strictly to the island terrain and remote
props batches combined; it does NOT represent a full-scene count, which also includes
weather sky/clouds, learner avatars, selection rings, and post-processing passes.
Zero course GLBs are fetched or parsed for this projection.

### 2. Retained Callable Standalone World Foliage Capability (`IslandDressing` / `IslandFoliage`)

The older world foliage component path in `island-foliage-render.tsx`
(`WorldTreeSilhouette`, invoked when `IslandDressing` is called with `detail="world"`)
is retained as an active capability for standalone single-island inspection:

- Unit tests confirm this path remains functional and independently callable.
- Proving callability via tests does not mean the real inspection entrypoint or active
  production views are using it; production distant views strictly use `RemoteIslandField`
  and `RemotePropsField`.
- It instances one selected donor trunk from `treeTrunks.glb` (max 384 triangles)
  plus one 12-triangle cone canopy (`ConeGeometry(0.42, 0.7, 6)`), capping
  isolated world trees at **396 triangles per tree**.
- It does not instantiate course crown lobes or bush lobes (`world = 0`).
- This capability is retained without deletion, but is explicitly distinguished
  from the remote catalogue projection above.

### 3. Measured CPU Generation and Planning Costs

In accordance with policy, costs are recorded only as measured CPU time on an
Apple M1 Max (Node 24 / Three.js 0.185.1):

- **World terrain generation (`buildIslandGeometry(..., "world")`)**:
  Single run direct CPU time: 6.45 ms (41 lessons) to 14.25 ms (6 lessons),
  generating 640 triangles (top 352, cliff 288, route 0) regardless of lesson
  count. In a 50-island catalogue test, total generation took 343.98 ms
  (min 3.81 ms, max 6.33 ms, mean 4.54 ms, median 4.48 ms, p90 5.17 ms, p95 5.25 ms).
- **Remote props catalogue planning (`planRemotePropsCatalogue`)**:
  Pure planning for a synthetic 53-island fixture took 47.55 ms total, generating 53
  landmarks and 172 trees (3,768 triangles) grounded on worldmesh elevations.
- **Base geometry caching**:
  `RemoteIslandField` caches base buffers via `WeakMap` by `(blueprint, radius)`;
  lift, selection, and dimming changes reuse cached vertex buffers without
  resampling procedural terrain.

No live GPU frame rates, full-field draw call counts, or physical mobile performance
claims are asserted; receipts reflect measured CPU generation and geometry counts.


## 2026-09-07 candidate technique: domain globe and natural island root

V5 decision M supersedes the global planar study-island composition. The
implementation under review uses one coarse coloured sphere per real domain,
large-scale continents, instanced cloud forms and a restrained atmosphere shell.
No globe-sized trees, course buildings, photographic Earth texture or additional
tone-mapping chain. Atmospheric representative islands consume the existing
640-triangle world projection without course props. Selection regions have
separate accessible DOM and hit areas; visibility size need not equal hit size.

Candidate limits before implementation: up to 5,000 triangles for each planet
surface, at most five representative real-course islands per study, and at most
eight scene draws per populated domain for sphere/cloud/atmosphere/islands/focus.
These are design ceilings, not measurements. Measure the completed 1/4-domain,
1/20/30-study fixtures, total scene and complete-frame costs before accepting
this technique or updating the actual inspector budget. Do not silently raise
existing course or world terrain budgets to pay for a globe.

Natural island edges reuse the existing terrain boundary and cliff rings.
First vary their depth, taper, centre and colour continuously from the seeded
outline/local terrain, keeping the same vertex/index capacity where possible.
Grass-to-rock transition must vary with terrain instead of a constant-width
sand stripe. The lower mass is an irregular geological root, not a standard cone
added below an untouched platform. Boundary topology, grounded props and the
course path retain their existing tests. A topology pass alone does not accept
its silhouette; matched near/side/far browser images are required.

The 2026-09-07 candidate keeps the 3,968-triangle globe but bakes its shared
3D land/ocean noise sampler to one 1,024 × 512 linear RGBA texture per domain.
Vertex-only colour was rejected after a real browser view showed blurred
continent boundaries. The base allocation is 2 MiB (about 2.67 MiB with mipmaps),
not a claim about total GPU memory. No per-frame surface noise or network asset
is needed. One merged cloud geometry remains below 7,000 triangles. Count the
atmosphere shell and transparent interaction volumes as submitted geometry too;
transparent hit targets are not free simply because they write no colour.


R22 rejected the 6–11 unit underside clamp after a complete-island browser
view still read as a thin plate. The blueprint now scales root depth to
0.7–0.9 of maxHalf (seeded), and both detail levels consume that same value.
Reported depth is measured from the actual mesh minY. The five cliff rings and
640-triangle distant terrain budget remain unchanged. Independent geometry,
blueprint, contact and remote/atmospheric projection checks passed 69 tests;
new normalized-depth checks subsequently passed in the 35-test targeted run.
These topology/cost results do not alone accept the final rock-face appearance.

R22 also narrows the continuous land/ocean colour transition and preserves
smooth transformed normals on radially flattened cloudlets. It does not add
cloud geometry, lights or tone mapping. Actual 4-domain / 30-series browser
fixtures expose the same PlanetStage and preserve island geometry UUIDs across
progress refreshes and domain selection. The camera encloses satellite forward
offsets as well as their screen-plane positions, avoiding portrait cropping.
