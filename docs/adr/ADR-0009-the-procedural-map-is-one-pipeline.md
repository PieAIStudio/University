---
id: ADR-0009
title: The Procedural Map Is One Pipeline, Not Three Scenes
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-09-18
domain: architecture
tags:
  - 3d
  - procedural
  - budget
pinned: false
related:
  - ADR-0004
  - ADR-0008
  - SPEC-0001
supersedes: []
superseded_by: null
---

# ADR-0009: The Procedural Map Is One Pipeline, Not Three Scenes

## R56: owned views of the same canonical assets

Owner authorizes limited appearance geometry, not an alternative map producer.
The existing pre-frame appearance subscriber owns both material and geometry
leases. Only named near-field props derive a view from their existing source;
source positions, reservations, instances, learning nodes and avatar recipe stay
canonical. A source change invalidates its view, not the blueprint. Inspectors
report source and drawn IDs separately, and classic must recover the exact source
geometry/material. Ground and collision meshes are never displaced for clay.
The shared RenderKit owns the isotropic polymer kernel; the host owns role scale,
private terrain-uniform overrides and asset-view lifetimes.

## R55: appearance is not a second world

A validated classic/clay account preference selects presentation only. The same
blueprint, field, landscape membership, avatar recipe and progress flow remain
canonical. R54 short-turf relief is withdrawn without changing a single scenery
placement. Shared RenderKit surface response is applied by the host's material
ownership adapter across all existing viewports; it owns no camera or output pass.
Original materials remain recoverable and their textures remain source-owned.
The developer-only terrain color hypotheses are not competing account settings.

## R54: retain meadow identity through material compilation

The existing course atlas now preserves canopy/meadow/route/facility channels
instead of baking those causes into RGB. It still samples the same IslandField
and existing scenery; `surface-turf.ts` is only a fixed repeating material
swatch, never a distribution or height field. Low meadow beds also consume
that field and the canonical dressing reservations. Final plant membership,
positions and counts belong to `courseLandscapePlan`, and geometry/inspector
consume that same result. World and planet projections do not request these
course-only beds or material masks. The silhouette, source catalogue, course
IDs, support sampler and renderer ownership do not change. Technique and
measured budgets are in ADR-0008; acceptance remains in the delivery plan.

## R53 dense-domain correction: budget the overview, preserve the catalogue

The jointed rock geometry increased the cost of each tiny atmospheric island.
The unchanged four-domain / thirty-study browser fixture exposed 556,827 full-frame
triangles, over its 300,000 ceiling. A globe is a study selector, not the complete
archipelago: populated regions now share a target of thirty representatives per
domain, bounded by the existing per-region three/five viewport limit. Each populated
study retains at least its first canonical course even beyond that soft target;
empty studies consume no representative quota. The full course catalogue, every
study entry/hit target, ordering, region placement and course/series projections
are unchanged. No mesh is thinned, no study is hidden and no test budget is raised.

`atmospheric-regions.ts` owns the allocation for both the worker and inspector.
The cache key includes exactly the emitted course prefix: progress/label changes
do not rebake it, but a course or density transition does. Sparse domains keep the
same three/five miniatures as before. Independent unit cases cover sparse/dense
and empty studies, identity, ordering, actual index counts and cache transitions;
the normal complete Stage browser check remains the acceptance gate.

The current R50 projection retains this pipeline. Upland groves read the existing
field; rock-rooted foliage reads the bank's actual emitted triangle datums.
Renderer and inspector consume the same successfully fitted replacement IDs,
not independent eligibility filters. Material detail and falling-water flow do
not move terrain or create another route. Choices, rejected experiments and
budgets are recorded in [ADR-0008](ADR-0008-one-locked-technique-per-island-element.md#r50-fitted-ownership-layered-groves-and-finished-learning-places).

## R52 amendment: one field, one deterministic form rule, one material owner

R52 does not add a fifth projection or a second producer. Course tree form still
comes from the blueprint's deterministic hash and the two existing tree
geometries; changing the split only makes the shared field's broadleaf layer
legible in clearings. Course ground still projects one terrain mesh through the
existing StandardMaterial extension and its shared 128² scalar swatch. The
lower-frequency sample changes only the material response across the existing
field. Routes, lesson IDs, facilities, roots, resource leases and the Stage
output chain stay owned by the same stages. R52's browser evidence and any
full-gate boundary are recorded in the active delivery plan, rather than
creating a parallel visual specification.

## Context

The product has three 3D surfaces: a global domain/region picker, a series
archipelago for courses, and a course island for lessons (V5 decision M).
They were originally built as three scenes, and every one independently
re-answered the same questions — where does terrain come from, where does
colour come from, how much geometry may this cost, who decides.

That is why the same argument kept happening in three places, and why the
island read as noise. Inside the island alone, three systems were each drawing
from their own random field:

- ground colour, from three sine waves in `colorForTop()`
- grass density, from a separate grid-interpolated value noise
- decoration placement, from uniform random scatter that read neither

Measured against the real 41-lesson `foundations-before-zero` blueprint across
7,949 in-island sample points, the correlation between the ground-colour field
and the grass-density field was **r = 0.31**. The two were very nearly
independent. About a third of the island's area had the terrain painted green
where no grass grew, or grass standing on ground painted as bare rock. No
amount of tuning any one of them fixes that, because the disagreement is
structural.

The commercial requirement makes this worse rather than better. The author
writes a course; the island, the archipelago node and the planet cluster must
then generate themselves, with no per-island hand tuning, because there is no
level editor and there is not going to be one. Three scenes that each invent
their own answer cannot deliver that.

## Decision

The procedural map is **one pipeline with four stages**, and every 3D surface
is a projection of it rather than a scene of its own.

### 1. Blueprint — what the world *is*

`IslandBlueprint` is pure data derived from course content: route, outline,
terrain parameters, seed, theme slots. No geometry, no colour, no three.js. It
is the only thing authored content directly determines.

### 2. Field — the single source of truth

`IslandField` compiles the blueprint into one cached raster: a height grid plus
mask channels for route, meadow, shore and rock, plus baked AO. Grass,
dressing, terrain colour and landmark placement all **read this one field**.

This is the load-bearing rule. A system that needs to know "is this point
grass" asks the field. It does not roll its own noise. The r = 0.31 above is
what a second opinion costs.

### 3. Three projections — budget spent by screen pixels, not world size

The same field is drawn three ways, and each way gets its budget from **how
many pixels the element actually occupies**, not from how big it is in world
space:

- **Course** — the low camera, close to the learner. This is where triangles
  belong, because this is where a triangle is more than one pixel wide.
- **World** — an island is about 40px across. It gets a silhouette, one value
  break, and one bright pixel. Nothing else is legible at that size.
- **Planet** — a domain owns a sphere and studies own atmospheric regions with
  tiny representative course islands. Those islands retain the canonical
  blueprint; the domain sphere is a container, not a competing course field.
  The detailed domain/region contract is in the amendment below.

This principle has already killed real work in both directions. A 569-line
mechanical underside chassis was discarded because the underside it detailed is
~8px tall in the projection that draws it. The course camera was brought down
to 68 degrees for the opposite reason: the things near the learner had been
paying for detail nobody could see on things far from them.

### 4. Style — the one file a non-programmer touches

`IslandStyle` holds colour, texture groups, and sun/sky. It is the artist-facing
surface. Changing how the map looks should not require reading a renderer.

R48's course colour texture reads the existing field and the canonical dressing
plan. Its tree/bank/working-place marks have real scene owners, not a second
noise-based ecology. `course-surface-atlas.ts` is a material compilation stage;
it must not edit the blueprint, route, positions or terrain height. The distant
catalogue never requests this course texture. Representation budgets and the
near sod-edge treatment remain in ADR-0008.

### And the technique lock, which is the fifth piece

ADR-0008 governs the orthogonal question: *what technique draws each element*.
This ADR governs where data comes from and how much it may cost. They compose —
the lock says "grass is one billboard card", this pipeline says "and it reads
its density from the field, and it spends its budget at the course projection".

### R49: support belongs to the actual owner, not the screenshot

The miniature bevel/crown compilation is asset geometry, not another island
field. Course grove sizes and conservative clearances belong to the canonical
dressing plan. Full-tree roots record their actual terrain contact offset there;
the renderer does not relocate or silently remove a failing tree.

Optional courtyard borders derive from existing facilities. The crafted stall
replaces an existing placement within its old footprint and cuts only its four
supports to actual ground, leaving one rigid countertop/canopy datum. Small
plants on a reserved geological bank read `courseRockTopPoints` and the same
triangles that its geometry emitter consumes. This scenery-local support must
never become another navigable terrain sampler or modify lesson routes.

`course-landscape-plan` explicitly records these scenery replacements and
companions; renderers and the inspector consume that result. The course atlas's
facility earth coverage is derived from real dressing and the existing field,
not a new random biome mask. Donor material treatments run only on committed
projection-owned clones and preserve the cached source maps and disposal owner.

## Consequences

- A new visual feature starts by asking which stage it belongs to. Something
  that generates its own noise field is a defect in stage 2, whatever it looks
  like.
- "Make it look better" is answered per projection, with the pixel budget
  stated. A change that helps the course view and costs the world view is not
  an improvement; it is a projection error.
- Per-island hand tuning stays impossible on purpose. If a specific island
  needs a fix, the fix goes into the blueprint rule or the style table, so every
  island generated after it gets the same benefit.
- `AGENTS.md`'s 3D routing row points here alongside ADR-0008, so a session
  reaches the pipeline before it reaches a renderer file.
- Stage 4 is the least finished. `IslandStyle` exists but colour decisions still
  leak into renderer files. That is the next structural debt, and it is named
  here so it is not rediscovered as a surprise.
- **`island-pipeline.test.ts` enforces the parts of this that can be
  enforced.** It asserts that grass and dressing both read `island-field`, that
  the field is compiled from the blueprint's sampler rather than from geometry,
  that no new island module grows its own value-noise lattice, and that the
  world projection spends zero grass budget. The exception list in that test is
  the honest one: `island-blueprint` perturbs the outline, which is stage 1, and
  `island-grass` caches a ground-normal raster derived from the same canonical
  sampler. A document does not stop a second random field from appearing; a
  failing test does. This is the same mechanism ADR-0008 uses, and it has
  already caught a real change once.

## Implementation entry points (2026-09-06)

This is a navigation map, not a second algorithm specification. Read the named
module and its adjacent tests before changing a rule.

| Change | Source entry |
| --- | --- |
| Course identity, outline, route and macro relief | `packages/world/src/island/island-blueprint.ts` |
| Shared masks, occupancy and ground samples | `packages/world/src/island/island-field.ts` |
| Drawn terrain and clipped soil contact | `packages/world/src/island/island-geometry.ts`, `surface-clip.ts` |
| Complete buildings, camps, bridges and natural clearances | `packages/world/src/island/island-composition.ts`, `island-dressing.ts` |
| Model provenance, measured dimensions and allowed replacement | `packages/world/src/island/island-asset-registry.ts` |
| Lesson body, engraving and bounded ground contact | `packages/world/src/grid/LessonMarkerField.tsx`, `medallion-grounding.ts` |
| Course/world composition and catalogue placement | `packages/world/src/Maps.tsx` (`placeStudyArchipelago`, shared with app and MapStudio) |
| Course dressing and foliage (course-only) | `packages/world/src/island/island-dressing-render.tsx`, `island-foliage-render.tsx` |
| Low-cost shared distant geometry and picking | `packages/world/src/island/remote-island-field.ts`, `remote-island-render.tsx`, `remote-props.ts` |
| Study aggregation and global framing | `packages/world/src/planet/PlanetScene.tsx`, `domain-layout.ts`, `domain-preparation.ts` |
| Actual scene instances versus raw GLB metrics | `packages/world/src/inspector/projected-metrics.ts`, `descriptions.ts` |
| Shared frame lifecycle and colour-pipeline owner | `packages/world/src/Stage.tsx`, `island/grade.ts` |

Remote rendering samples the blueprint's canonical terrain at its existing
world detail tier; it must not prepare the course's dense field, lesson contact
meshes or full dressing plan just to display or inspect a catalogue. Production
world draws are `RemoteIslandField` plus `RemotePropsField` only.
`IslandDressing` / `IslandFoliage` do not run at world or planet detail.
Inspector counts describe the projection currently drawn, with unknown values
explicit. VRAM remains unknown; standalone R35 Mac GPU timing in ADR-0008 is
not a value the inspector may pretend to measure on another device. The homologous-shape domain
worker reuses the same generators and has no early self-proof of cold-load
duration.

R38 adds explicit unlaunched domain metadata (AI foundations and AI media) to
the same catalogue, without synthetic studies. Named `surfaceStyle` presets
belong to that metadata; `globe-style.ts` supplies one set of linear material
stops to both the vertex fallback and worker texture bake. Changing the named
style invalidates the same bounded CPU cache, while a title/progress update
still does not. `domainPreparationKey` is shared by the client and hook so a
new palette cannot accidentally reuse the previous domain texture. No new
scene, coordinate table, content producer or output-colour pipeline is added.

R40 adds the AI-games domain with a named `lagoon` palette through that same
metadata contract. The fourth preset changes neither globe topology nor texture
resolution; it is exercised by the same vertex/bake equivalence tests. Route
descriptions now pass from the authored study manifest through both ContentPort
shelves into PlanetStudy and its DOM detail, rather than being invented in the
map or duplicated between modes. Renaming a route does not change its existing
course IDs. Course retirement and the new foundations source are content changes,
not rendering rules; the active plan records their exact acceptance scope.

The remote base cache is weakly owned by the blueprint, with an eight-entry
LRU for radius variants inside each live blueprint. A WeakMap alone does not
bound repeated preview resizes while that blueprint remains mounted. The four
learner states fit within this limit; a hit refreshes recency, and eviction
relinquishes only CPU-cache ownership without disposing buffers still held by
the mounted batch. The radius-churn regression first failed on the unbounded
map and now guards both eviction and preservation of a recently used shape.

`domain-preparation-client.ts` owns the worker and CPU-only bounded cache.
Each callback belongs to the worker that installed it; termination clears
handlers, and already-queued errors cannot cancel a later retry's jobs. A timeout
only cancels a still-pending request. R35's late-error regression first reproduced
the new-worker cancellation before this owner check; renderer resource disposal
and worker transport identity are separate lifetime contracts.

World carrier home and selected-course targets both sample the same cached
distant geometry. R35's production screenshot exposed that only the selected
state used the real island height; closing a card or returning to the series
put the avatar under the rock root. `world-carrier.ts` now resolves the existing
learner position against the actual placements for both states. The shared
`LabelProbe` reserves the actual world-avatar screen bounds using the existing
avatar visibility projection, so a course-name label cannot conceal its face.
No second camera, hand-tuned island offset, or new text renderer is introduced.
F/N browser guards raycast the drawn terrain and check actual DOM/geometry overlap;
the before/after failures are in the active delivery plan.


## 2026-09-07 amendment: domains own globes; studies own atmospheric regions

V5 decision M corrects the highest projection. A learning domain is a spherical
planet; each study is an atmospheric region containing representative course
islands. The existing study/course/lesson IDs, course production and progress
remain canonical. A planet is not a giant study island, and study count is not
planet count. The three learner surfaces remain global selection, a series
archipelago and a course island; global selection includes domain and region
selection without inventing another course route.

The app attaches explicit, read-only domain display metadata to existing study
records. Renderers never infer classification from titles or fabricate courses.
Unknown membership is visible as unclassified. Actual counts are folded from
real studies. This metadata can later come from the content producer through
the same interface. It does not create another lesson authoring path.

Peer planets are translated away from the world origin. Their orientation
and its acceptance measurement compare the camera and region relative to the
owning domain centre. R39's translated calibration exposed an origin-based
measurement that never converged although the actual region faced the camera.
`e2e/harness/planet-focus.ts` reads that real centre and retains the existing
angular precision and travel deadline; it does not change the rendered pose.

Sphere geometry describes the domain container, not a competing course terrain
field. Tiny atmospheric course islands still derive from the existing blueprint
and low-detail geometry. Domain/region plans are pure data, shared by the globe,
DOM selector and inspector. Large-scale sphere colour, cloud and atmosphere
layers use the same Stage/SwimmerRenderKit output chain. Current planar planet
receipts are historical measurements, not acceptance evidence for this amendment.
