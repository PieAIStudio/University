---
id: ADR-0008
title: One Locked Technique Per Island Element
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-09-11
domain: architecture
tags:
  - 3d
  - donors
  - budget
pinned: false
related:
  - ADR-0004
  - ADR-0009
  - SPEC-0001
  - REF-ISLAND-LOOK-CONTRACT
  - REF-ISLAND-ART-DIRECTION-V2
  - PLAN-CONTINUOUS-WORLD-DELIVERY
  - ARCHIVE-ADR-0008-2026-09-07
supersedes: []
superseded_by: null
---

# ADR-0008: One Locked Technique Per Island Element

Catalogue scope, reviewed 2026-09-13: the 31-island and long-course receipts
below describe their original pre-lock inputs or frozen calibration, not the
currently shipped catalogue. The [locked-package record](../../apps/local/course-proposals/locked/README.md)
owns the 2026-09-12 publication change. Do not reopen those packages to reproduce
a screenshot; current browser fixtures are selected by `e2e/harness/catalogue.ts`.
This catalogue clarification changes no technique, budget or original receipt.

## Decision and authority

Each element has one named technique, source, measured scope and tested budget.
The executable table and rejection list are
`packages/world/src/island/island-technique-lock.ts` and its adjacent test.
Change a technique only with a measurement, an amendment here and corresponding
lock/tests. A discrepancy is something to investigate, not permission to silently
prefer a stale number. [ADR-0009](ADR-0009-the-procedural-map-is-one-pipeline.md)
owns data flow; [V5 I–M](../reference/player-journey/v5/index.html) owns appearance
and interaction. The [delivery plan](../plans/active/continuous-world-delivery.md)
owns completion status. This condensation changes none of those contracts.

## R44 candidate: reference-led miniature archipelagos

The user-approved `飞岛群-参考-V1/ChatGPT生成A.png` (renamed from ChatGPT生成01.png) requires authored miniature
landscapes, not the previous four tiny trees and a single grey pavilion. R44 may
replace the remote prop projection with one cached, recipe-driven miniature kit:
shared natural forms, ground-following small accents and one recognizable focal
assembly. No full course GLBs, dense course field, per-course coordinate tables,
new content producer, output grade or per-prop light is introduced.

R44 raises the canonical root depth to 1.1–1.3 × maxHalf in both course and world,
retaining the same manifold rings, bounded kernel and triangle count. The prior
0.7–0.9 root read as a shallow bowl in the actual approved comparison. Catalogue
radii may grow up to 1.25 within the existing pairwise sky gaps; both islands obey
the same pairwise radius-sum limit and keep 0.9 units clear. Their original ordered
layout positions are retained. A globally enlarged layout and a new directional
group candidate were rejected in ordinary screenshots for clipping away the
reference composition (R44 world-r2/r3). This is not a screenshot-only zoom or a
per-course scale table. The unchanged close course distance remains 36.

Candidate ceilings: 4,800 opaque prop triangles per island (6,000 including small
water/contact surfaces) and six catalogue
base-pass draws including terrain, miniature props, water and contact accents.
Actual emitted counts, CPU planning and full Stage GPU work must be measured;
these ceilings are not acceptance receipts. Terrain and course identity continue
to come from the canonical blueprint. The prior 996-triangle R43 total cannot
describe a richer R44 island. Planet representatives retain their terrain-only
scope. The delivery plan is the only completion ledger.

### R44 direct refinement of the existing kit

The Web lead inspected the inherited real browser frames and retained the
deterministic miniature plan and complete rendered-footprint checks. The fir
now has one rounded two-tier lathed crown with non-degenerate pole triangles
and scattered-light crown normals (312 triangles including trunk, ceiling 320).
Broadleaf/autumn use 188 triangles and blossom 208; only the central lobe moves
to detail 1. The two-flower asset uses broad closed petals (208 triangles),
larger clusters and lower stems instead of tiny radial cones. These replace
their previous geometries; no parallel kit or additional per-object draw exists.

A shared foreground clearance puts tall trees beside the learner axis; fewer
but larger flowers/grass remain below it. Bounded focal search includes outer
shoulders and smaller complete assemblies rather than weakening ground-relief
or support tests. Named architectural/mineral styles must emit their actual
focal asset on the recipe fixture; natural grove/autumn scenes can use a pool
or canopy as the focal subject instead of forcing an optional stone.

Pool geometry now retains a broad blue centre, a bounded scalloped rim and a
wider cascade with three closed droplet volumes in the SAME water batch.
The pond's optional larger radius is still accepted only by the original
rendered-footprint range test. Crystals and exposed rock gain mineral value
variation through existing vertex colours, with no bloom or new light.
The 4,800 opaque / 6,000 scenery / 640 terrain ceilings remain unchanged.

The existing cloud generator has four more distinct smooth crown influences;
its closed topology, tessellation and conservative height envelope are unchanged.
Carrier placement still reads its actual centre support height. Background-only
scale and stable world anchors put modest clouds around the view, instead of
huge trays behind the islands. Shared cool emissive fill replaces the previous
brown-grey fill in the same material; domain and carrier regressions therefore
belong to this change too. Full-frame timing and current acceptance are recorded
below / in R44, never inferred from the absence of extra draws.

The shoal planner also reserves a default-approach root silhouette for a large
rear island beside a substantially smaller foreground neighbour. Equal peers
keep their previous compact grouping; only an unsafe candidate searches a new
local angle. If that fan is exhausted, bounded recovery around an existing
member keeps the small island connected to the SAME shoal. No course is omitted,
no per-course coordinates are stored, and progress/selection remain outside the
layout inputs. Tests retain the 3.5 neighbour-graph bound, physical gaps, study
order and stable positions across progress; they now additionally cover this
large-root clearance. The 1.25 maximum scenic growth still fits the actual
pairwise sky gaps rather than changing positions when a course becomes live.

The 60-shape geometry matrix keeps every shape/projection, vertex, face and
tolerance. Its hot validation loops now raise a contextual failure directly
instead of allocating a matcher for every successful scalar; coordinate keys
are cached only inside each immutable mesh check. The entire original matrix
passed in 17.39s in the isolated repair run (`direct-contract-repair.log`), not
by raising the 60s guard or deleting cases. The texture determinism check also
compares every emitted byte without recursively formatting two MiB-sized arrays.
These are test-harness costs, not renderer performance improvements.

### R44 direct-run measured receipts (2026-09-10, Mac-local clock)

Normal delivery route `/`, real turing-pact catalogue (31 course islands), dark
appearance, DPR1; a real course → world → picked miniature → course → world
round trip. Final receipts are `.devspace-visual/r44/direct-release/{1600,375}/receipt.json`.
The final T run passed both viewports; this does not pass the default authoring
suite or the complete repository gate.

| Scope | Before 1600×900 | Final 1600×900 | Before 375×812 | Final 375×812 |
| --- | ---: | ---: | ---: | ---: |
| Complete Stage draws incl. post | 32 | 32 | 31 | 31 |
| Complete Stage triangles | 86,522 | 90,960 | 83,113 | 87,551 |
| Renderer geometries | 37 | 37 | 36 | 36 |
| Renderer textures | 15 | 15 | 14 | 14 |
| GPU median ms | 1.246 | 1.869 | 0.596 | 0.460 |
| GPU p95 ms | 3.943 | 69.672 | 1.343 | 0.600 |

The final scenery alone has 48,162 triangles in four non-terrain meshes,
75 tree instances, 28 focal assemblies and 275 natural companions. Terrain
remains 640 triangles/island. Full Stage includes the carrier, sky and post;
the 6,000 scenery / 6,640 terrain+scenery ceiling is not the observed average.

GPU samples: final24 per viewport, before25. Timer scope is the actual warm
Stage callback including shadow/post submissions; not DOM/compositor, other
canvases, FPS, VRAM, battery or physical-phone acceptance. The host reported
1-minute load226.44 during the final run, with wide desktop GPU tail latency.
These readings do NOT establish a speedup or accept smoothness. Keep the final
69.672ms p95 visible and repeat on a suitably controlled target; do not replace
it with an earlier favourable measurement.

Source-camera evidence is also scoped: direct-before→direct-r3 at1600×900 uses
the exact camera position [7.2311426906739555,36.442685642133334,50.72121314679985]
and shows the asset/material refinement independent of zoom. The final bounded
root-clearance layout has position [7.664428667293549,36.442685642133334,50.38881873243942]
with the same orientation/lens. Its final screenshot demonstrates the actual
new layout, not a falsely claimed identical-pose model comparison.

### R44 surface refinement candidate

The enlarged user comparison identifies three separate deficits: turf-edge
volume, readable vertical rock facets, and the uniform untextured meadow.
The candidate keeps the existing terrain topology and height sampler, reshapes
the first cliff band into a shallow turf rim, and separates its material edge
from the rock beneath. It may bake a bounded, mipmapped ground colour atlas
from the emitted terrain triangles and the actual miniature placement plan.
This is a colour/contact approximation, not a second terrain field, ray-traced
AO, a new teaching path, or a photographic texture transplant. One ordinary
MeshStandardMaterial map lookup retains the terrain draw and existing output
pipeline. Planet terrain-only representatives do not allocate this atlas.
Source guidance: Three.js MeshStandardMaterial map/bump/normal/displacement
contracts, https://threejs.org/docs/pages/MeshStandardMaterial.html . Only
geometry changes silhouettes; normal/bump maps change shading. Original donor
assets are not copied for this experiment. Atlas limits and measured results
must be recorded after the same-route comparison; R44 remains open meanwhile.

The surface-r2 desktop receipt (1600×900, DPR1, 31 real course islands) confirms
one 1024×512 RGBA Linear-sRGB atlas, 128-pixel cells with eight-pixel padding:
2,097,152 base bytes, approximately 2,796,203 bytes with mipmaps. This is texture
allocation only, not total GPU memory. Atlas preparation reported 577.2ms once
on this loaded Mac; cached plain-data tiles are independent of placement scale.
The live texture contains non-neutral texels (red channel 89–255), and its map
on/off comparison changes the actual ground pixels. The current shadow bake is
an elliptical canopy/contact approximation; a proposed projected-triangle
silhouette refinement was blocked before a successful application receipt.

The same receipt counts 32 complete-Stage calls, 91,372 triangles, 37 geometries,
16 textures and 17 programs. Scenery contributes 48,574 triangles; terrain
remains 640 per island. Against the preceding 90,960-triangle desktop candidate,
this adds one texture and 412 submitted triangles while preserving draw count.
GPU timer sample: 24 warm Stage samples, median1.884ms, p95 3.257ms; the diagnostic
temporarily switched the map and restored it before timing. This is not an
uncontended performance comparison, FPS, battery or physical-phone acceptance.
Current flower leaf cushions and thicker cloud volume remain candidates pending
updated asset/grounding/cloud regressions; earlier 208-triangle flower and cloud
envelope receipts describe their earlier snapshots, not these later changes.

### R44 follow-on: actual caster masks and a single cloud exterior

The surface atlas now projects the existing miniature asset triangles into a
temporary CPU light-space depth raster, compares against the drawn terrain's
height, and softens coverage. It is a static fixed-sun bake, not runtime shadow
mapping or ray-traced AO. It replaces the elliptical caster estimate. Contact
shade shares the same atlas; the former transparent contact mesh/material is
removed, leaving three remote scenery meshes plus the terrain batch. The atlas
dimensions and sampler count do not grow. Cold baking and complete Stage time
still need their own measurements; fewer submissions do not prove faster frames.

Clouds sample one smooth star-shaped exterior from four rounded influences,
not four overlapping rendered meshes. The same welded rings and poles keep
the original triangle counts. Surface-derived normals work at each LOD, and
carrier support reads the actual top vertex. V5 permits the rounded bank's
0.52 maximum vertical aspect instead of the old 0.35 flat-bank art constraint;
closed surface, outward normals, physical clearances and foot support remain
independently tested. The final shoulder-blend trial lacks its last test receipt
because a process-status read was blocked; R44 records this boundary and the
earlier verified measurements. No final aesthetic or performance acceptance.

### R44 final daylight study

A same-camera light-only diagnostic (`r44/light-study/`) found that the inherited
210-degree backlight kept the visible root in almost uniform fill. Repositioning
the EXISTING key to side-front daylight revealed the already-modelled facets;
neither geometry, exposure nor texture was changed in that diagnostic. It is not
final evidence because its baked shadows deliberately retained the old direction.

The adopted candidate uses a named catalogue preset in the same light rig:
50-degree elevation, 315-degree azimuth and 3.4 key intensity, with all existing
fill terms unchanged. Visible dome, its PMREM capture, direct lighting and the
static miniature shadow bake must read that same profile. The course defaults
remain byte-for-byte the previous values; this is not the rejected global
brightness/grade adjustment. No extra light, sampler, render owner, frame pass,
geometry or camera-following illumination. Final paired screenshots, clipping,
resources and regression gates determine acceptance, not the diagnostic alone.

### R44 final miniature and label closure

The final kit uses lower flower heads (248 triangles, height 0.185773) and five
shorter, wider fanned grass blades (40 triangles, height 0.2418). Fence posts are
six-sided tapered wooden cylinders, replacing square sticks: 96 triangles per
fence. These are shared kit changes; positions are regenerated under the same
full rendered-footprint and ground-range checks. Snapshot dimensions are measured
from emitted geometry, not relaxed support tolerances. The cloud shoulders use
the existing four-influence closed shell; a pinched-neck trial was rejected and
the original normalized-rim lower bound restored by changing the shape, not the test.

The catalogue sky changes only its horizon/nadir/fog palette; course and domain
skies remain unchanged. Scene light, static shadows and environment still share
the named catalogue preset. Current/adjacent captions can search bounded nearby
sky when their original column is blocked; collision tests and DOM leaders remain
authoritative. Domain pills use their measured full height, cached until text,
width or font readiness changes, to prevent selected/empty labels clipping.

The production base-pass set is now precisely terrain, merged trees, merged
scenery/banks, and water: at most four draws, no transparent contact duplicate.
The N browser gate checks the actual four mesh names and rejects duplicate draws.
Planet emphasis tests separately verify 1.1 selected / 0.82 peer scale and stable
resource identity; a progress-only snapshot waits until selection animation has
actually reached its endpoint. Earlier six-draw ceilings and equal-scale tests
describe superseded snapshots. Final current receipts and external dependencies
are recorded in the existing R44 delivery plan, not inferred from green subsets.

The final same-route `close-before` / `close-final` receipts (31 islands,
1600×900 and 375×812, DPR1, same theme/camera) measure the following complete
Stage frames. The narrow viewport is a desktop browser, not a physical phone.

| Scope | Before desktop | Final desktop | Before narrow | Final narrow |
| --- | ---: | ---: | ---: | ---: |
| Complete Stage draws | 30 | 30 | 29 | 29 |
| Submitted triangles | 88,486 | 87,714 | 85,077 | 84,305 |
| Renderer geometries / textures | 36 / 16 | 36 / 16 | 35 / 15 | 35 / 15 |
| GPU median / p95 ms | 2.094 / 2.553 | 3.002 / 5.950 | 0.612 / 0.697 | 0.788 / 1.913 |

Scenery alone is 46,564 triangles in three meshes, excluding 640 terrain
triangles per island. The shared atlas remains 1024×512 / 2 MiB base, about
2.67 MiB with mipmaps. Cold atlas preparation was 367ms desktop / 353ms narrow.
Timing scope is the warm Stage render callback, not DOM/compositor, FPS,
battery or total VRAM; final samples24/25, before25 each. The final timing
does NOT demonstrate a speedup despite fewer triangles. Keep these actual
readings visible and retain physical-device/performance acceptance separately.

### R45 retained refinement and R46 course landscape trial

R45 retains the five-ring root topology and 640-triangle distant terrain; smaller
middle-ring inward variation removes needle-like folds without changing the
height source. The layout reserves more of a large rear root's shoulder when a
small foreground course is nearby. Existing bounded same-shoal recovery and
course ordering stay intact. Four opaque sail panels raise the shared miniature
windmill from 140 to 188 triangles (radius 0.526131, normalized height 1), within
the unchanged 600-triangle asset ceiling, with no new scenery material or draw.
The attempted new hero/tree seats were rejected after real screenshots and
reverted; prior composition is retained. R45 evidence lives in the active plan.

R46 may add a course-only landscape layer derived from the existing dressing
plan, shared IslandField and actual course triangles: bounded decorative rock
outcrops, flora around established places and mixed tree silhouettes. Outcrops
are solid scenery, not a second navigable heightfield; their base conforms to
the already-rendered ground and no route/node is moved onto their tops. Reuse
the existing procedural miniature assets where their geometry is appropriate
at course scale; preserve donor buildings, source attribution and material maps.
Outcrops are selected after authored facilities but before natural vegetation
inside the canonical dressing plan. Natural placement consumes those reserves;
the renderer does not silently remove obstructing trees after drawing. The
course key's existing shadow intensity may be reduced to 0.76 to retain visible
understorey. R46's same-camera light-only diagnostic then found its large rock
fronts were hidden by the original backlight: the adopted `garden` profile keeps
40-degree elevation, uses 315-degree azimuth / 3.8 key intensity, and is shared
by the direct key, visible dome and environment-capture cache key. Original
`course` default (used by the planet) and `catalogue` values remain unchanged;
shadow resolution, fill terms and output grade remain unchanged. This is an artistic shadow-strength choice, not extra
ambient light or a new soft-shadow algorithm. API contract:
https://threejs.org/docs/pages/LightShadow.html .
Actual support, full footprint, route/marker clearance, finite geometry and
bounded draws must be tested before acceptance; trial budgets are measured,
not borrowed from R44 receipts.

### R46 retained course-scale forms and bounded geology

The course projection reuses the complete miniature tree family: a 312-triangle
fir and a 368-triangle broadleaf with four 80-triangle crown lobes. The distant
broadleaf remains 188 triangles. Two instanced form batches replace the former
six donor-trunk batches plus separate crowns; no tree is added on top of another
and the original conservative crown footprint remains the placement contract.
The donor assets stay attributed, but the inspector no longer reports their raw
GLB or the retired crown rows as current draws. Shrubs retain their tested
three-lobe terrain contact. New complete-tree counts include trunks.

Interior rock formations are three interlocking closed shoulders (288 triangles),
all embedded below the minimum height of their original proved footprint. A
fantasy-town recipe may replace one reserved rock volume with a 348-triangle
stone arch: closed piers and a continuous elliptical ring, real openings, no
duplicate internal joint faces, and no lesson/portal behavior. Its orientation
comes from the closest teaching path, not a stored screenshot coordinate.

An optional coastal spring is selected after semantic facilities and geology,
before small vegetation. Its basin and bank strips use the actual course terrain
triangles; the entire footprint must fit, the water must not climb, and shallow
head over small bed ripples stays within the same 0.26-unit depth bound. If no
safe site exists it is omitted. The cliff ribbon starts beyond the real outline,
not from an arbitrary point in empty sky. It is static stylized geometry, not a
fluid simulation. Banks join the existing rock draw; water adds one opaque,
two-sided draw and no texture, light, shadow pass, or render-loop owner.

Limits are explicit in the source: four geology reservations, 220 low flora
groups, at most 800 spring triangles and 50,000 triangles for the complete added
course landscape. Its three possible draws are rock/bank, low flora, and water;
full Stage shadows/post and GPU timings are separate evidence in R46. Geometry,
renderer counters and inspector counts are tested against the actual output.

## R47: bounded hybrid course materials and terrain-seated banks

The same-camera catalogue experiment did not justify another sampler at normal
viewing distance. Its candidate was withdrawn; R45's colour atlas, geometry,
placement and light remain. Images and source receipts are in the R47 directory
named by the active delivery plan, not a new permanent material pipeline.

For course terrain and geological scenery, `surface-material-detail.ts` extends
the existing StandardMaterial/terrain style adapter. One **shared 128×128 RGBA
scalar swatch** carries shallow height, related worn-surface roughness and tone.
It is authored here, not copied from the skill's photographic Ground103/Moss002
media. Model-locked continuous projection, repeat wrapping, trilinear mipmaps,
low relief and footprint fading replace unfiltered fine noise. The swatch is
non-colour data (`NoColorSpace`); the existing distant colour atlas remains
linear colour. No second output conversion, lights, screen AO or displacement.
Trees, flora, donor buildings and water are not forced onto this material.

The swatch costs 65,536 base bytes, approximately 87,382 including mipmaps,
shared by leases and disposed after the final owner. A three-float coordinate
attribute adds 12 bytes per participating vertex. Existing two opaque landscape
batches remain two; there is no extra terrain draw. These allocations are not
total VRAM, render-target memory or an FPS promise. Actual frames belong in the
plan; material mode 0 is an appearance control, not an unmodified-shader timing.

`course-rock-profile.ts` defines one 248-triangle closed bank per rock
reservation, replacing the R46 three-block 288-triangle form. Its 63 top-point
ground samples come from actual course triangles; the wide skirt, exposed front
step and uphill back slope join that ground, with the original embedded bottom
and full route/placement reservation retained. Grass/stone colour follows a
continuous slope mask, not one colour per triangle. It remains non-walkable
scenery, not a second terrain height source. Existing ruins and optional water
are unchanged. Groves may align with a nearby bank; large leaders and smaller
companions stay within the old maximum envelope. Low flora follows broken
route-facing edges rather than evenly surrounding every prop.

## R48: field-backed surface colour and a shallow course sod edge

R48 retains the approved catalogue atlas, geometry, composition and lighting.
The course additionally consumes a 256×256 linear-colour texture derived from
the existing IslandField and actual dressing: lush pigment around trees/banks,
restrained wear around facilities, and protection of the existing road. It does
not bake directional shadows or multiply field AO a second time. Its alpha
modulates matte surface response. The shared R47 scalar swatch remains separate
non-colour data; no photographic Ground103/Moss002 assets are shipped.

`course-surface-atlas.ts` owns per-blueprint leases/disposal and bare-preview
fallback. The new texture adds 262,144 base bytes (about 349,526 with mipmaps)
and one terrain sampler, no geometry or draw. Real submitted materials are
observed by `e2e/harness/drawn-materials.ts`; source attachment alone is not a
draw receipt. Doubling the swatch frequency produced visibly wavy/noisy ground
in R48 landscape-r1 and was rejected; retained relief is quieter than R47.
The long-course colour-only diagnostic still showed repeated albedo waves with
relief disabled. The retained variant therefore also reduces swatch colour
strength and gates terrain microdetail by the actual forest-edge texture and
upward face mask. It does not spread that pattern across every clearing or the
vertical root. This is an observed albedo correction, not a claim that mipmaps
or weaker normals alone solved it.

The closed course bank gains one crest column: 70 terrain samples and exactly
276 triangles, including a thin physical lip and mineral flanks. Broad, lower
reservations replace narrow tall ones under the unchanged full-footprint,
height-aware route and node gates. The course cliff's existing first ring now
forms a nominal ≤0.42-unit sod edge rather than ten percent of the complete
root depth. Original radial contraction, all deeper root datums, top ground,
route geometry, node heights and total triangle count remain. The catalogue
keeps its original five-ring profile, including its first ring. Both projections
still use the same blueprint and canonical root depth; this is a near-detail
edge treatment, not a second navigable heightfield.

R48's full default browser run exposed a real texture-lifetime regression:
warm course returns accumulated one map (desktop 22→23, narrow 21→22).
Do not weaken the existing N warm-resource equality gate. Shared texture leases
must be acquired by a committed effect or actual shader compilation, not by a
render-time memo whose abandoned render receives no cleanup. The material
adapter now starts with empty texture uniforms, activates idempotently, and
releases/rebinds the same handles across effect cleanup/setup. A changed
blueprint owns a new material instance while retaining the shared GPU-program
cache key. Surface and rock lifetimes are committed separately from their
geometry lifetimes.

The unmodified N tests and four V course cases passed after that fix. The three
warm returns are exactly 80 geometries / 20 textures / 25 programs on desktop
and 79 / 19 / 24 in the narrow view. These are renderer object counts, not VRAM.
Abandoned-render and cleanup/setup regressions live in the adjacent texture
tests. The active plan retains the original full-run failures and the separate
post-fix checks; those must not be summed into an invented full-suite success.

## R49: coherent miniature craft, living shoulders and complete facilities

The R49 art pass keeps the original course routes, terrain, five-ring remote
roots and catalogue arrival. Its changes are shared generation rules, not
course-specific scenery coordinates. The active delivery plan owns the actual
visual verdict and measurements; the reference illustration is not a mesh or
an objective numeric score.

The miniature kit now uses a closed 44-triangle chamfered box for visible rails,
sails and masonry. Exact dimensions do not grow. The fir becomes a continuous
three-tier 408-triangle tree. A broadleaf's five growth volumes compile to one
closed radial crown, rather than five differently painted intersecting balls:
292 triangles at world detail and 432 at course detail, trunks included. Low
lanceolate leaves are 80 triangles per plant, not vertical triangular fins.
Every miniature remains below the unchanged 600-triangle per-asset ceiling;
the complete remote island remains within four base draws and 6,640 triangles.
The ground colour/contact atlas stays the only remote terrain sampler.

World background clouds use broader, brighter shoulders in the same two
existing batches. The avatar's carrier is excluded from this reshape and keeps
its foot-support contract. Arrival remains 62 units away. Normal world dolly
now spans 48–144, still 3×: arrival was previously also the minimum, preventing
the learner from actually inspecting the finished miniatures. No screenshot
camera, FOV change or new controls owner is introduced.

Course grove leaders may reach 5.15 units, with smaller companions selected
before their own footprint is checked. A late bounded search can try a younger
leader on a constrained site instead of relaxing clearance. Opaque crowns
must not swallow one another. A natural tree root reads its complete support
disk on the actual course triangles and records a downward contact offset;
the plan and scaled renderer use that same offset. Shrubs use three rounded
80-triangle lobes (240 per bush), with the same actual-mesh grounding algorithm
and a warmer field-derived palette. Low road verges retain their smaller tier.

Rock banks have 144 sampled top datums and 572 triangles in one closed shell.
Unequal steps belong to the exposed face toward the actual walk, while the back
returns to the existing slope. Small optional shoulder plants read the very
same emitted triangle datums; they do not create a walkable heightfield or an
invented course branch. Ambient flat donor slabs are selectively replaced with
the kit's solid rounded stones inside their old proved footprint, with fresh
height-aware path and root checks. Semantic resting/landmark stones remain.

Fantasy-town facilities may receive at most six safe, open courtyard fence
sections, within the existing landscape draw. The old flat stall is replaced
at its existing semantic placement by one complete first-party cloth-canopy
stall: the original 0.65×0.3655×1 source envelope, four terrain-cut posts, a
closed thin canopy, counter, books and a planted pot, below 1,200 triangles.
It replaces the donor body, not another facility stacked on it. Its shadow
belongs to the existing merged scenery mesh. The inspector excludes retired
ambient-stone/stall GLB draws and counts the actual emitted landscape.

The course colour atlas remains 256² linear RGBA. Its alpha now carries actual
facility earth coverage, with the teaching path protected; it is not opacity.
The existing scalar surface swatch remains 128² non-colour data. Roof and wood
craft marks are derivative-filtered, normalized-model-local changes to committed
material clones, preserving the original donor maps and all source resources.
No extra image sampler, render loop or output conversion is added for those
marks. The same-camera shadow-only comparison retains garden shadow intensity
0.64; key/sky, catalogue, planet, exposure and shadow-map sizes are unchanged.

## R50: fitted ownership, layered groves and finished learning places

Replacement eligibility is not proof of a rendered replacement. Renderer and
inspector now consume `courseReplacementIds(courseLandscapePlan(...))`: only
successfully fitted stones, stalls and complete academies retire their donor
placements. An incomplete academy or rejected support retains its original
registered geometry. Tests cover the exact partition and rejected terrain;
the old batching and whitelist tests pass without weakening their assertions.

Grove separation uses 32 vertical bands measured from the actual two tree
meshes, rather than comparing both crowns at their maximum radius regardless
of height. The two CPU envelopes are bounded and contain no GPU resources.
Recovered smaller leaders own their companions' growth scale. Long courses
have twelve route beats and at most two terrain-derived upland groves; these
read the existing height/grass/rock field and preserve a broad clearing, not a
new random annulus. All route, node, footprint and actual-tree-root gates stay.
Optional small crowns on rock shoulders use the bank's actual triangle sampler
and remain inside the geological reservation, with the full combined-height
route clearance. They share the existing merged landscape draw.

The original five-member academy can compile into one complete timber/plaster
pavilion within its registered envelope. The front opening and glazed side
openings are cut into closed wall shells. Bevelled frames, fitted foundation,
gable ends and roof share construction datums; it is not another house added
beside the donor. Its 3,400-triangle ceiling remains below the existing 8,000
landmark ceiling. Whole-landscape 50,000 and existing opaque draw limits remain.

The thin course sod collar retains its living colour through the actual edge;
the next band owns the mineral crease. Course stone adopts a restrained cooler
family while the established catalogue root and canonical terrain stay intact.
The attempted stronger off-route terracing was rejected after real pages grew
lumpy contour bands and lost the first-course ruin. No terrain/route change
from that trial is retained. Larger catalogue focal assets keep every original
size as a safe fallback; course IDs, island positions and arrival do not change.

The existing supported spring adds bounded foam lanes and derivative-filtered
descending foam/roughness within its one StandardMaterial water draw. Basin,
channel, lip and falling support positions retain their original ownership.
Reduced motion resets its single time uniform to zero; no texture, light,
displacement or extra output pass is introduced. Total spring geometry is still
capped at 800 triangles. The desktop shadow-radius comparison retains 2.5;
radius 4 was visibly grainy and rejected. Mobile keeps its existing filter and
radius 1. Actual images, failed trials and measurements belong to the R50
directory referenced by the active delivery plan.

The one-course browser witness exposed a separate atmosphere defect: catalogue
fog distance scaled below the 62-unit arrival camera. `worldFogRange` now keeps
its far distance at least 186 units while preserving the original ratio on
larger fields. Actual `onAfterRender` receipts also found null fog after a
course→world handoff. The old property attachment could restore null over a
newly committed owner. `SceneFog` binds committed leases and removes only its
own lease; out-of-order cleanup cannot erase the next projection. This is scene
property ownership, not a new atmosphere pass. Regression tests and the actual
one-course round trip guard the density, rendered identity and return state.

The inherited E browser test directly assigned a camera pose and asserted the
old `minDistance > 48` constant. R49 intentionally made 48 the inspect stop.
E now reaches the declared stop through real wheel input and measures clearance
above the highest actual terrain/tree/landmark vertex. It neither nudges the
product stop to 49 nor relaxes physical clearance into a snapshot-only pass.

## R51: retained surfaces, explicit craft roles and complete evidence

The remote layout, arrival, atlas and cloud composition remain the approved
R49/R50 candidate. A sharper fir-profile experiment produced darker skirt
bands at ordinary viewing distance and was reverted; its images remain in the
R51 evidence directory. The retained fir stays at its prior profile and budget.

Course rock reservations retain their sites, footprint gates and 572 triangles.
Their existing profile now spends more of its width on a soil-bearing shoulder
and a short physical turf lip rather than two pale roof-like ramps. Plants and
small trees still sample that exact emitted profile. No teaching route, node
height, navigable ground or root-depth source is displaced for this change.

`surface-wear.ts` supplies one low-contrast, periodic scalar wear cause from
three fixed wrapped value grids. It replaces the former visibly directional
sine swatch, not the IslandField. Colour, shallow relief and roughness still
come from the same packed 128-square data texture. The R50 formula is retained
only in a gated test diagnostic that swaps texture bytes on the same compiled
material, with camera, geometry and light equality checked and restoration in
`finally`. The regular 0/1/2 material experiment remains a separate witness.

The complete academy and stall no longer lose material identity when merged
with plants. Builder-owned `craftSurface` coordinates and roles distinguish
timber, roof, plaster, cloth and glazing. Natural plants are explicitly role
zero and retain their original response. `craft-material.ts` extends the
existing StandardMaterial's colour and roughness inputs, sharing the already
leased terrain/rock swatch. It adds no image, draw, displacement, output encode
or second renderer. Model-local coordinates survive placement transforms;
footprint-filtered roof marks replace six subpixel seam boxes (264 triangles
removed). Tiny cloth/plaster surfaces do not receive unnecessary bump channels.
The merged flora buffer gains 12 coordinate bytes per vertex; exact submitted
buffer bytes and the unchanged shared texture identity are browser receipts,
not a claim about total VRAM. Acquisition is deferred to committed use and
release/rebind keeps the same uniform handles under StrictMode.

The V/W browser identity witnesses now read the blueprint's actual `node.id`
and `next`, reject empty/duplicate identities, and compare the real lesson DOM
projection. `lessonId` is a LessonPlacement field, not an IslandRouteNode field;
the previous V/W null arrays were not sufficient identity evidence. Decorative
`kind:` sprites are not lesson-node IDs and are excluded using the declared
`.label--lesson` role, not by dropping arbitrary failed matches. Existing
grounding, picking, geometry and warm-resource equality checks remain.

Runtime screenshots, the exact source fingerprint and all completed/failed
runs belong to the active delivery plan and its R51 evidence directory. A
successful technical gate is not the user's visual approval or a 95-point
objective score.

## R52: readable second tree storey and restrained low-frequency ground tone

R52 keeps the R51 course landscape ownership and rendering budgets intact. The
shared `courseTreeIsFir` hash remains deterministic and conifer-led, but its
existing split now leaves a readable broadleaf second storey in open clearings
instead of making a long lesson read as one repeated fir wall. This is a form
selection rule over the two existing course tree meshes; it is not a new tree
asset, placement table, draw or per-course override. Root support, route
clearance, upland-grove cap and the real course IDs remain unchanged.

The existing `surface-material-detail.ts` hybrid field now uses a lower-frequency
sample and restrained course-terrain tone (`0.24`; stone remains `0.32`) while
keeping the same packed 128² scalar swatch, StandardMaterial extension, model
coordinates and staged inspection modes. The course terrain texture scale is
`0.075`; this makes broad clearing variation read as a broad material response,
not repeated high-frequency waves. It adds no sampler, texture, displacement,
render pass, output conversion or geometry. Same-camera material studies and
the current V/U receipts are the evidence for this choice; the earlier images
and rejected high-frequency trials remain historical evidence, not renamed
successes.

The R52 browser witnesses cover the real 41- and 61-lesson courses, the 31-island
Turing archipelago, three additional course identities, desktop and 375-pixel
layouts, overview/walking/near views, wheel and drag traversal, route and
successor identity, material/resource identity, reduced-motion restoration and
the existing landscape bounds. CPU preparation, complete Stage GPU timing,
draw/triangle counts, texture/program reuse and physical-device performance are
separate measurements; no one is substituted for another. The active plan
contains the exact R52 evidence root and the true full-gate outcomes.

## Current course and series techniques

| Element | Choice and scope |
| --- | --- |
| Course terrain and soil | One continuous `buildIslandGeometry(..., "course")` mesh. Soil is clipped against actual terrain triangles, not a second height source or separate terrain draw. |
| Grass | Generated three-vertex, one-triangle blade; taper, wind, camera-facing rotation and ground normals in shader. LOD changes instance count. Near ceiling 6 is a ceiling, not the current blade shape; far draws zero grass. |
| Course tree/shrub | R49 complete fir408 / continuous broadleaf432 triangles; two instanced tree batches. Shrub: three80-triangle lobes,240 total; exact scaled foot support remains required. No parallel retired donor tree draw. |
| Course props | Registered Kenney/semantic stones, with successfully fitted crafted stalls, academies and ambient stones replacing their source IDs. Unfitted replacements retain donors. Decoration ceiling 1,200 triangles/asset; landmarks at most six semantic places/assemblies, ceiling 8,000 per asset. |
| Course geological scenery and surface detail | Closed 572-triangle terrain-seated bank; ruin 348, optional supported spring ≤800. Shared 128² scalar swatch plus course-only 256² field/dressing colour texture. Two opaque landscape batches include fitted replacements, courtyard borders and optional rock-rooted canopy. No extra base draw. See R49/R50 above. |
| Lesson marker | Shared 14-segment bevelled medallion, 168 triangles; separate +Y-facing unit rings, 48–50 each, at most six ring batches. Readable text stays DOM. |
| Ground contact | Merged footing splits at rendered triangle boundaries, embeds by 0.01 and retains exposed-height ceiling 0.25. Bounded stance recovery; unresolved contact uses a terrain-clipped shallow inlay at the same position/radius/ID, with engraving and picking preserved. |
| Buildings/camp/bridge | Academy's existing four-wall/roof assembly owns one fitted pavilion or retains all original members; never both. Tent faces its actual lit pit. Bridge checks decoded support pads and arched deck across the span, not just its origin. Failed fits retain meaningful fallbacks. |
| Fire and lighting | Effects belong only to actual lit campfire assemblies. No per-fire shadow lights. Reduced motion/pause contracts remain. Use the shared Stage/SwimmerRenderKit output chain, with one tone map and one sRGB encoding. |
| Series distant terrain | Canonical blueprint sampled at world detail: 640 triangles/island (352 top + 288 cliff, no route clips), merged across islands. Do not prepare a dense course field or load course GLBs. |
| Series distant props | R44 named miniature kit, up to five trees, one focal assembly and bounded natural companions. Opaque geometry ≤4,800 triangles/island; including water and bank ≤6,000. Contact and caster shading live in the single ground atlas, not another mesh. Full world-triangle footprint coverage replaces centre-only placement. Exact counts come from actual mixed asset geometry. The older 84/356 prop budgets are superseded, not falsely retained. |
| Batch accounting | R44 terrain/miniature ceiling is four base-pass draws and 6,640 triangles/island. This excludes avatar, sky, selection and post; final complete-Stage measurements are separate. The same two existing cloud batches/instance counts remain; background placement reads the actual root floor. One ≤2048-sided RGBA colour atlas; physical-device acceptance and total VRAM remain separate unknowns. |
| Domain globe | Surface ≤ 5,000 triangles; merged clouds ≤ 7,000 triangles with 7 clusters and radial flatten 0.55; design ceiling 8 scene draws per populated domain including atmosphere and hit geometry. Representatives: desktop at most 5 / mobile at most 3 per study, from the remote 640-triangle base, no course props. |

Production world catalogue is `RemoteIslandField` plus `RemotePropsField` only.
`IslandDressing` and `IslandFoliage` are course-only; they do not accept a world
detail and do not load donor trunks for the catalogue. The former 396-triangle
single-island world foliage path (donor trunk + cone) is a rejected second
budget, recorded in the lock rejection list and in the
[measurement history](../archive/adr-0008-measurement-history-2026-09-07.md).
The previously accepted remote budget was 640 + 84 / 3 draws. The R43 candidate
above replaces its tree geometry; old counts and timings do not certify it.

Course overview uses the same `COURSE_DISTANCE = 36` camera with a different
framing range; it does not change that default.

## Domain globe and natural root

R43 remains a **partially verified worktree candidate**, not a release acceptance.
Remote crowns reuse the course lobe recipe at detail 0 (3 × 20 triangles) with
a five-sided closed trunk (20), within the existing global tree instance batch.
The pavilion's roof/base are vertex-coloured in its existing batch. The distant
terrain is unchanged at 640 triangles; no course models or dense fields are loaded.
Course groves request more trees and a 0.72–1.2-high shrub middle layer; actual
counts, contact, occlusion and device costs still need verification.

The corrective remote-props suite measured 53 explicit synthetic islands at
37.56ms for prop planning and 14,788 emitted prop triangles, excluding terrain,
blueprint creation, avatars, sky, shadows, post and GPU time. Exact geometry,
minimum sample composition, scaling and the original 60ms planning assertion
passed. This is one local CPU sample, not a cold-page or physical-phone promise.
Fast footprint rejection reuses the existing blueprint polygon predicate before
requesting rendered terrain height; it does not add a second field. Natural
course trees now have a 64-placement cap before semantic assemblies; route and
whole-footprint limits remain independent of the wider artistic grove envelopes.

Course overview fits actual terrain vertices plus conservative dressing bounds,
using their projected aspect to choose clear screen space. It keeps the original
lens and learning distance. The browser witness projects the actual terrain,
including its root, rather than requiring imaginary empty bounding-box corners
to fit. Final matched screenshots and the full gate remain in R43; the pilot's
desktop HMR interval is not a fixed-source acceptance receipt.

The globe candidate stores a land mask in the existing surface texture's alpha,
from the same sampled coastline. The opaque material consumes this mask for
subtle water roughness/value motion and explicitly restores opaque alpha; there
is no additional texture, water mesh or render pass. Peer scale, selected scale,
idle rotation and radial cloud breathing are candidates under the existing Stage
lifecycle. Runtime shader compilation, reduced-motion/return behavior, DOM
clearance and full-frame cost have not yet been accepted. R43 in the delivery
plan records the platform block while collecting test results. Earlier GPU
tables do not describe this changed candidate.

V5 M replaces giant planar study islands with domain globes and atmospheric
study regions. A study is not a domain. Actual IDs and explicit domain metadata
remain authoritative; unknown membership is not guessed. Empty domains keep
real DOM. Representative course islands use the 640-triangle projection, without
course props, at most five per study on desktop and three on mobile
(`planetRepresentativeLimit`). DOM/hit areas may be larger than the visible tiny
islands.

The candidate uses a 3,968-triangle sphere (ceiling 5,000) and a 1,024×512
linear RGBA surface texture from the same 3D land/ocean sampler. Base texture
allocation is 2 MiB (about 2.67 MiB with mipmaps). That is not total GPU memory;
VRAM remains unknown; R35 measures GPU time separately below. One merged cloud geometry stays below 7,000
triangles (7 clusters, radial scale 0.55). The design ceiling of eight scene
draws per populated domain still includes atmosphere and submitted invisible
hit geometry; it is not a measured GPU-time promise. No globe-sized trees,
photographic Earth asset or second colour pipeline.

`prepareDomain` in a module worker reuses those same generators. There is no
early self-proof that the worker makes cold load fluent. Shape caches exclude
progress/name-only changes. Cold generation risk remains in F05.

Natural roots share the seeded outline and five cliff rings. R44 raises their
canonical depth from 0.7–0.9 to 1.1–1.3 of maxHalf across course/world projections.
Depth reports actual minY, not a
nominal parameter. The distant terrain remains 640 triangles. Topology passing
does not accept the rock silhouette; near/side/far browser evidence is still due.

R32 tightened that topology contract after an actual short-course screenshot
showed a root slit. Paired undirected edges missed a folded cap: rings used
40% of the offset while their cap used its full offset. All rings and their cap
now converge on one outline-kernel point; cant is a bounded angular rotation
around that point. Winding is consistent, never repaired by flipping individual
triangles. The new directed-edge regression checks the three actual course
counterexamples plus the 60-shape matrix. Radial mass and outward normals are
measured relative to the actual root axis, not world zero, which need not lie
inside an offset lower ring. Original variation/depth/triangle ceilings stay.

Unshipped theme accents no longer become arbitrary fallback props in course
outposts. R32 observed a requested crystal rendered as a fountain and enlarged
by the wrong aspect ratio. The planner retains only actually shipped, semantically
matched accent models; otherwise natural scenery/open ground remains. The registry
still records source provenance and legacy fallback mappings, but the new course
plan does not use those mappings to invent a market, light, or oversized pool.

R33 extends physical fitting to ordinary outposts. A model's semantic role cannot
change its footprint: a 0.7-high `rock_largeA` has a measured circumscribed XZ
radius about 1.729, not the old landmark guess of 0.42. Rigid extents come from
the existing measured table; crown envelopes derive from their shared lobe
recipes and jitter range. Missing measurements are not certified by a height
guess. Whole-footprint fitting clips the convex footprint against the same cached
top lattice and reads extrema across all intersected triangles, including internal
ridges. This CPU query does not build road clips, cliff meshes or GPU resources.
Finite spacing/ground searches still reject an entire unsafe outpost. The new
five-route footprint tests passed; independent emitted-mesh comparison and
rendered contact subsequently passed in R35. Overall release and device
acceptance remain in the delivery plan.

R35 strengthened the positive witness to every route/length pair, exposing four
empty short-course outposts that a per-route aggregate concealed. Simply widening
the large-rock search displaced an existing long-course grove (12 trees against
the unchanged >15 assertion). The accepted fallback preserves all normal-tier
placements and only attempts a compact rest when no ordinary outpost fitted and
no real bridge exists. Its seat rock, companion and shrub have heights
0.42 / 0.25 / 0.30; physical envelopes still come from the same measured models
and crown recipes. At most 320 whole-group candidates cover route shoulders,
including endpoints, once per cached plan. It neither scales buildings nor
relaxes the 0.25 contact, slope or clearance limits. The retained counterexamples,
every 5×6/24/41 positive case and all-or-none occupied-ground rejection pass in
`outpost-contact.test.ts`; the combined dressing/terrain suite is 33/33.

## R43 geometric clarity and verification scope

The remote crown candidate now uses bounded neighbouring candidates at the same
semantic anchors. Footprint rejection reads the existing canonical outline
predicate; only accepted anchors sample the rendered world height. The original
60ms/53-island props-planning guard remains, with a fresh 37.56ms witness and
14,788 prop triangles (maximum 18,868). This excludes blueprint creation, terrain
batch preparation and GPU work. The three remote batches and 996-triangle/host
construction ceiling are unchanged by this fitting correction.

The existing geological lobe mask now varies the inland start of exposed stone:
projecting headlands expose a broader shoulder and sheltered bays retain turf.
The field and both terrain projections still share that mask. Warm stone and
recessed-bay values use the same cliff lobes; topology, height, normals, 640 distant
triangles and Stage lighting/grade do not change. Ordinary screenshots and the
unchanged contact/topology matrix decide acceptance, not these constants alone.

Course overview retains its lens and default distance 36. Its fitting support is
now every rendered terrain vertex plus the conservative dressing envelope;
imaginary lower corners of a cuboid around the tapered root no longer spend
screen space. Free-space selection uses this subject's projected aspect. The
browser witness checks every emitted top/root vertex and the same opaque chrome
clearances, including breadcrumbs; the older eight empty-box-corner receipt is
not the new acceptance ruler. This is framing, not changing the island to fit a
diagnostic shot. Per-run acceptance and outstanding device evidence stay in R43.

## R38 amendment: authored edges, grouped placement and one cloud form

The user's 2026-09-08 ordinary screenshots reject the flat perimeter shelf,
horizontal rock bands, uniform catalogue scatter and separately visible cloud
balls. Passing topology and old browser receipts did not establish those forms.
V5 M records the revised appearance before implementation.

The candidate keeps the canonical outline/height field and the distant
640-triangle base. Coast relief reaches the edge; cliff rings describe continuous
vertical rock shoulders rather than independent horizontal slabs. No glued-on
donor rock shell, added terrain draw or second contact height is allowed.

Clouds use one continuous shallow cloud-bank mesh shared by catalogue,
carrier and globe (tangent-space projection). It replaces assembled sphere
chains; no ray marching, extra lighting or post pass. Candidate budgets stay
within the existing two catalogue cloud draws and 7,000 globe cloud triangles;
the final globe has at most seven separated banks (1,680 triangles), omitting
banks inside real region protection cones. It rotates with its globe instead
of drifting across a learning destination. The first 21-bank candidate still
read as a necklace of rice grains in the ordinary browser; its rejected image
is retained in `astra-r38/planet-candidate-rendered.png`. Catalogue cloud
draws remain two: 4,608 desktop / 1,200 mobile triangles versus 14,112 / 3,780
previously. A course cloud bank remains 36 triangles. These are cloud counts,
not the full frame. Complementary crown/belly buffers own their disposal.
Carrier feet, swept clearance, reduced-motion and 540ms travel remain unchanged.

Course richness first uses the registered natural/semantic assemblies and
cached placement plan. Density may increase within existing per-asset ceilings,
but whole-footprint 0.25 contact and clearances remain hard constraints. Full
Stage and physical-device costs, not raw instance counts, decide acceptance.
Measurements and rejected trials will be appended here; task state belongs only
to the active delivery plan.

R38's first additional donor candidates are Fantasy Town `stall-bench` (180
triangles, 14,168 bytes, source bounds 0.26×0.225501×0.94) and `cart` (608
triangles, 52,920 bytes, transformed bounds 0.893024×0.535501×1.34). They share
the existing colormap and CC0 pack. The explicit R01 whitelist grows from ten
to twelve files, not a whole-pack import; per-prop triangle ceilings stay.
Benches belong beside actual facilities and a cart beside a stall, fitted with
the existing whole-footprint query. A missing safe site omits the companion
without moving or breaking the original facility. New bounds are independently
checked against the imported GLBs; browser scale/contact and final frame cost
remain acceptance requirements.

R5's independent visual review rejected a remaining cover rim. The continuous
height shoulder now retains a non-zero boundary slope instead of flattening
at its last vertex. `coast-profile.ts` supplies the same geological lobe mask
to the terrain projection and field rock/grass channels, so exposed buttresses
reach the top without growing grass on a separately painted stone patch.
Top and cliff lip colours are exactly equal; sheltered shoulders share compatible
normals and actual creases above 60 degrees retain their face normals. Two
over-smoothed corner failures remain in the evidence; the original normal,
winding, 0.25 contact and 640-triangle distant limits were not relaxed.

The lower rings keep warm stone rather than using the path's brown soil as
their primary material. No light, grade or extra terrain draw was added.
R5's field/contact/route integration passed 100 focused assertions; the full
final verification, browser and device states belong to the delivery plan.

R5 Mac Stage GPU queries (same scope/method as R37 below) each contain 24 valid
non-disjoint samples. Source SHA-256 matches the production-browser receipt:
`cefd59cc80f23f2ae98e1cb96f6115b050b17d19760a16f39f487b27eb0cfdb5`.

| Projection | 1440×900 median / p95 ms | 375×812 median / p95 ms |
| --- | --- | --- |
| Real 41-lesson course | 2.322 / 3.106 | 0.698 / 0.976 |
| Real selected series | 1.177 / 1.861 | 0.383 / 0.502 |
| Three declared domains, two unpublished | 0.944 / 1.469 | 0.294 / 0.355 |
| Synthetic 4 domains × 30 series | 0.942 / 1.383 | 0.348 / 0.637 |

Raw queries: `.devspace-visual/astra-r38/gpu-r5.json`. This is not compositor
time, phone FPS or VRAM. The production navigation pass is not used as a cold
load benchmark; its first desktop run overlapped E2E preparation.

## R37 measured GPU scope, not a device-FPS promise

In R37 on 2026-09-08, fresh visible Chrome contexts on the Mac's Apple M1 Max / ANGLE
Metal renderer used `EXT_disjoint_timer_query_webgl2` around the actual unique
Stage render callback. Each row has 24 valid, non-disjoint queries, with no
screenshot or CPU profiler. This includes that canvas's shadows, scene, AO and
grade; it excludes browser compositing and other canvases such as the navigation
avatar. DPR is 1. Values are GPU milliseconds, not FPS or allocated GPU memory.

| Projection | 1440×900 median / p95 | 375×812 median / p95 |
| --- | --- | --- |
| Real 41-lesson course | 2.845 / 3.449 | 0.782 / 0.899 |
| Real selected series | 1.590 / 1.897 | 0.548 / 0.772 |
| Real one-domain catalogue | 1.219 / 1.241 | 0.277 / 0.613 |
| Explicit synthetic 4 domains × 30 series | 1.415 / 1.483 | 0.602 / 0.878 |

Raw queries are in `.devspace-visual/astra-r37/gpu-release.json`; the restored
temporary measurement wrapper remains `astra-r35/gpu-frames.mjs`. All earlier
R35 query files are retained, not silently overwritten.
These are final-source samples, not a claim of improvement over an earlier run:
the prior course p95 was 6.309ms on the same hardware. The final measurement
and production-browser receipt share the same source SHA-256. A separate
blank→course→blank scheduling control measured rAF medians about 50 / 50 / 33ms;
that delay is therefore not evidence that 3D GPU work itself costs 50ms. Do not
delete scenery to chase headless scheduling intervals. These Mac/viewport data
do not replace a current physical phone pass. CPU preparation profiles are
inclusive sampled scopes and must not be added together as exact wall time.

## Owner-authorized wax slice (isolated experiment)

The Owner explicitly permits reversible material/model overrides within the
interaction-3d-playlab worktree, not an overwrite of the approved games, shared
assets or the parallel clay work. `/play-lab/wax-island` consumes the real course
and the existing CourseScene/AvatarKit. No second terrain field, route, renderer
or color pass is permitted. Its finish experiment owns only material copies and
optional normal-only geometry copies; positions, indices and pick surfaces stay
unchanged. Classic restores the exact source identities.

RenderKit 0.3.0 owns the unchanged output chain but has no wax surface API. Until
this single-consumer experiment is judged, a slice-local adapter is the bounded
exception, not a copied brand package or second global appearance framework.
If accepted for product-wide use, move the response into RenderKit and register
it with the clay lane's appearance owner, instead of stacking two traversals.
No package publishing authority is inferred from this exception.

The physical distinction motivating the study is internal light spreading, not
clearcoat or transparency. The implementation may use a bounded per-light
scattering approximation with authored role thickness, not claim a measured
thickness map or full BSSRDF. Preserve original colors/maps, suppress plastic
lobes and high-frequency relief on owned variants, and leave eyes legible.
No baked glow, screen-space blur, texture download or translucent full-world pass.
Research: Three.js r185 `SubsurfaceScatteringShader.js` (Blinn-Phong reference,
not copied), and MeshPhysicalMaterial documentation (clearcoat/transmission are
separate effects). Same-camera actual output and resource receipts, not numeric
roughness alone, determine acceptance; the current plan records the outcome.

## Rejected alternatives worth remembering

| Alternative | Why it was rejected; do not generalize beyond this scope |
| --- | --- |
| Five-leaf volumetric grass | 45 triangles × 16,000 = 720,000, 92.7% of the then 777,008-triangle scene. More grass geometry was not the missing visual quality. |
| Course hex terrain / independent height fields | Ground, route and markers disagreed. Restore the single continuous pipeline, not per-course correction tables. |
| Course rounded alpha cards | Intersecting flat discs remained visible. Three solid lobes + trunk fit the 624-tree budget. Distant silhouettes are a different scope. |
| Donor assembled rocks instead of retained Kenney rocks | Paired historical shot cost +63.4% scene triangles and added noisy pale clusters. Permission to use an asset is not a reason to import it. |
| Rock model as a lesson pedestal | Existing 16/80-triangle rocks lack a consistent circular engraved top; the measured 168-triangle body serves that role. |
| Uniform coastal trees, disconnected building parts | They read as a fence or unsupported props. Fix whole-assembly footprint, purpose and crown clearance rather than add instances. |
| IslandDressing world donor trunk + cone canopy (396 tris) | Second renderer and second budget beside RemotePropsField. Production distant draws are remote field + remote props only. |
| Giant flat island as a planet; vertex-only globe colour | User rejected the first; actual browser view exposed blurred boundaries in the second. Domain sphere and shared sampled texture are the current candidates. |
| 6–11-unit root clamp / distant-only depth multiplier | Full-island view still looked like a thin plate or changed identity between views. Both details now consume the same seeded proportional depth. |
| Post-processing or brighter material as a geometry repair | Cannot repair floating contact, missing silhouette or contradictory placement; ordinary final-output screenshots remain the acceptance surface. |

## Measurement provenance, not competing budgets

The `terrain/{count}` fixture has 15,234 / 14,805 / 16,820 / 16,629 terrain
triangles for 6 / 12 / 24 / 41 lessons after soil clipping. The switchback
`foundations-before-zero` delivery fixture is different: terrain 15,101 / 18,078 /
20,906 and footing 814 / 3,292 / 5,594 for 6 / 24 / 41, with zero inlay in that
fixture. Do not combine them into one count. Tests and new receipts determine
whether these historical fixture measurements still hold after later edits.

Report seed, course/fixture, projection, viewport/theme/DPR and whether a number
is primitive geometry, a scene pass, a full Stage frame, CPU preparation or GPU
time. Resource counts are not GPU bytes; rAF intervals are not physical-phone
FPS. Screenshot capture and performance sampling are separate runs.

Full dated tables, commands, rationale and rejected trials remain in the
[measurement history](../archive/adr-0008-measurement-history-2026-09-07.md),
loaded only when a changed technique or fixture needs that evidence. Old numerical
receipts are not simultaneous requirements and never override the current lock.
