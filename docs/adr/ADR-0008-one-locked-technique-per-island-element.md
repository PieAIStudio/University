---
id: ADR-0008
title: One Locked Technique Per Island Element
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-09-09
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

## Current course and series techniques

| Element | Choice and scope |
| --- | --- |
| Course terrain and soil | One continuous `buildIslandGeometry(..., "course")` mesh. Soil is clipped against actual terrain triangles, not a second height source or separate terrain draw. |
| Grass | Generated three-vertex, one-triangle blade; taper, wind, camera-facing rotation and ground normals in shader. LOD changes instance count. Near ceiling 6 is a ceiling, not the current blade shape; far draws zero grass. |
| Course tree/shrub | Registered donor trunks plus three rounded 80-triangle crown lobes: at most 624 triangles/tree (within the 900 ceiling). Shrub: three 20-triangle lobes, 60 total. Course alpha-card crowns are replaced, not retained as a second aesthetic. |
| Course props | Registered Kenney architecture and 16/80-triangle rocks; normal decoration ceiling 1,200 triangles/asset. Landmarks: at most six semantic places/assemblies, ceiling 8,000 per asset, not six individual walls. |
| Lesson marker | Shared 14-segment bevelled medallion, 168 triangles; separate +Y-facing unit rings, 48–50 each, at most six ring batches. Readable text stays DOM. |
| Ground contact | Merged footing splits at rendered triangle boundaries, embeds by 0.01 and retains exposed-height ceiling 0.25. Bounded stance recovery; unresolved contact uses a terrain-clipped shallow inlay at the same position/radius/ID, with engraving and picking preserved. |
| Buildings/camp/bridge | Academy is four walls and one roof at a shared scale. Tent faces its actual lit pit. Bridge checks decoded support pads and arched deck across the span, not the model origin or just its centre. Failed fit returns a reason and a meaningful fallback. |
| Fire and lighting | Effects belong only to actual lit campfire assemblies. No per-fire shadow lights. Reduced motion/pause contracts remain. Use the shared Stage/SwimmerRenderKit output chain, with one tone map and one sRGB encoding. |
| Series distant terrain | Canonical blueprint sampled at world detail: 640 triangles/island (352 top + 288 cliff, no route clips), merged across islands. Do not prepare a dense course field or load course GLBs. |
| Series distant props | Optional pavilion up to 36 triangles plus at most four 12-triangle tree silhouettes: 0–84 props triangles/island. Bounded inward fitting may omit props; a sampled anchor does not prove zero gap across a sloping footprint. |
| Batch accounting | Distant terrain + props have a three-draw batch ceiling and at most 724 triangles/island. This excludes avatars, sky, selection, shadows and post; it is not a full-frame promise. R35 GPU timings below have a separate scope; VRAM remains unmeasured. |
| Domain globe | Surface ≤ 5,000 triangles; merged clouds ≤ 7,000 triangles with 7 clusters and radial flatten 0.55; design ceiling 8 scene draws per populated domain including atmosphere and hit geometry. Representatives: desktop at most 5 / mobile at most 3 per study, from the remote 640-triangle base, no course props. |

Production world catalogue is `RemoteIslandField` plus `RemotePropsField` only.
`IslandDressing` and `IslandFoliage` are course-only; they do not accept a world
detail and do not load donor trunks for the catalogue. The former 396-triangle
single-island world foliage path (donor trunk + cone) is a rejected second
budget, recorded in the lock rejection list and in the
[measurement history](../archive/adr-0008-measurement-history-2026-09-07.md).
Do not mix that history with the active 640 + 84 / 3-draw remote budget.

Course overview uses the same `COURSE_DISTANCE = 36` camera with a different
framing range; it does not change that default.

## Domain globe and natural root

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

Natural roots share the seeded outline, five cliff rings and depth of 0.7–0.9
of maxHalf across course/world projections. Depth reports actual minY, not a
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
