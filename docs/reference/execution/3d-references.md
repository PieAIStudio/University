---
id: REF-3D-REFERENCES
title: What The 3D Should Copy
type: reference
status: active
canonical: true
owner: human
created: 2026-08-21
last_reviewed: 2026-08-21
domain: execution
tags:
  - web3d
  - camera
  - art-direction
  - assets
pinned: false
related: []
---

# What The 3D Should Copy

Commissioned because the owner's verdict on the current 3D was that it is *「弄得
挺差的」* and asked which shipping product to model it on rather than nudging
values one at a time. Two researchers, deliberately given non-overlapping
briefs: one on camera, controls and readability, one on art direction, assets
and water. Their conclusions are recorded below, then **the claims that were
independently checked here**, because a licence a model asserted is not a
licence.

## The One-Line Answer

**Copy the feel of a map, not of an open world.**

Almost everything wrong follows from one decision that was made deliberately
for a different goal: the camera is a landscape shot, not a map shot.

## What The Camera Is Now, Measured

Measured from `apps/online/src/App.tsx` and `Stage.tsx` rather than guessed:

| | World map | Course map |
| --- | --- | --- |
| Projection | `PerspectiveCamera`, fov 45 | same |
| Polar angle from straight down | ~**68°** | ~**61°** |
| Above the horizon | ~22° | ~29° |
| Lowest the user may tilt | ~83° — nearly at sea level | same |
| Rotation | right-drag and two-finger both rotate | same |

For comparison, true isometric is 54.7° polar, and Mapbox's own 3D examples use
60°. At 68° with a 45° field of view, this is a holiday photograph of an
archipelago. It was built that way on purpose — the comment says the horizon is
in frame deliberately — and that is precisely the thing that reads as wrong on
a screen whose job is "where do I go now".

## Camera: What To Change

Not orthographic. Orthographic flattens height, and this product spends height
on meaning: islands grow settlements as courses progress, and one beacon marks
the next course. Removing perspective deletes that sentence.

| Parameter | Now | Target | Copied from |
| --- | --- | --- | --- |
| Field of view | 45° | **32–36°** | Mapbox GL JS default ≈36.87° |
| World map polar | ~68° | **52–55°** | between true isometric 54.7° and Mapbox's 3D examples at 60° |
| Course map polar | ~61° | **48–52°** | slightly more top-down, because 41 lessons snake away from the camera |
| Tilt range | free to 83° | **locked** — `minPolarAngle === maxPolarAngle` | Clash of Clans, Mario world maps, Apple Maps' 3D slider |
| Azimuth | free | **locked** | same |

Narrowing the field of view requires pulling the camera back or the frame
crops; distance scales roughly with `0.5 / tan(fov/2)`.

## Controls: Delete Rotation

`MapControls` binds right-drag and two-finger to rotate, and two-finger pinch
to `DOLLY_ROTATE`. On a laptop trackpad this misfires three ways: a two-finger
swipe arrives as `wheel` and zooms instead of panning, a two-finger tap is a
right-click and therefore a rotate, and any twist during a pinch turns the
world.

**Free rotation should be removed from a level-select map.** Five reasons, in
descending order of how load-bearing they are:

1. The eight-second test needs a stable "front". Duolingo, Super Mario 3D World,
   Candy Crush and Donkey Kong Country all refuse to let you turn the map, so
   the next step is always in the same place in your memory.
2. Labels are a screen-space problem. Every azimuth change re-lays out all 41.
3. The lit beacon has an orientation. Rotate far enough and it is behind its
   own island.
4. This canvas does not let you walk around in the world. The products that
   need rotation — The Sims, Cities: Skylines, Captain Toad — are ones you live
   inside.
5. Mapbox ships an official *disable rotation* example, and Apple Maps hides
   rotation behind the compass rather than on the trackpad.

Target bindings, copied from Apple Maps on Mac rather than Google Maps on the
web, because the owner named the trackpad as the problem:

| Input | Should do |
| --- | --- |
| Left drag / one finger | pan |
| Two-finger trackpad swipe | **pan**, not zoom |
| Pinch (`wheel` with `ctrlKey`) | zoom |
| Mouse wheel | zoom |
| Right-drag, ctrl-drag, two-finger twist | **nothing** |

`MapControls` can do the first cut by disabling rotation and changing `touches`.
`yomotsu/camera-controls` (MIT, 2.4k stars, actively maintained) is the upgrade
if two-finger `wheel`-as-pan and smooth fly-to are wanted — but not merely to
turn rotation off.

## The Overlapping Labels Are Not A Missing Library

Point-feature label placement is NP-hard, and the existing `placeLabels`
already does the three things production maps do: four-position candidates,
priority weighting, and hide-on-collision, capped at nine visible.

The bottom of a long course map still stacks, and the causes are specific:

- 41 lessons snake away along −Z, so distant rows compress into a line under a
  45° field of view. That is perspective, not a failed intersection test.
- Weights are study 2, course 1, **lesson 0** — the one name the eight-second
  test has to win with is the first one dropped.

**Install nothing.** The fix is information design, copied from Duolingo, Mario
and Candy Crush: number the nodes instead of titling all 41, always show the
current and next lesson plus the unit name, keep "show every title" as an
explicit mode, and frame the camera on about eight stones around the next
lesson rather than trying to fit 41 titles on screen.

Checked and rejected: `labelgun` (archived since 2021), `d3-labeler`
(abandoned 2017), `@d3fc/d3fc-label-layout` (annealing lets labels drift away
from their anchor, which for Chinese lesson titles means you can no longer tell
which stone a title belongs to). `rbush` (MIT, maintained) is the only one
worth adding, and 41 rectangles do not need an R-tree.

## Art Direction

Named references, with the one thing to take from each:

| Reference | Take |
| --- | --- |
| **Townscaper** | high-key pastel palette and sculptural contact shadows |
| **Islanders** | toy-scale feel; island-versus-water silhouette doing the layering |
| **Dorfromantik** | settlements visibly growing from wilderness — this product's exact metaphor |
| **Bad North** | high-contrast island silhouette plus height fog, making one island the focus |
| **Monument Valley** | two-tone lighting chord, warm lit face against cool shadow, no textures at all |
| **Forest** (focus app) | matte clay finish; abstract progress made physical |
| **Duolingo** | one node, unmistakably the next, winning by sheer area |

**The single biggest lever is colour harmony plus tone mapping.** In low-poly
there are no textures, so colour *is* the material, and four CC0 packs by four
artists arrive with four saturated palettes that fight. The repaint table in
`apps/online/src/world/kit.tsx` already exists to solve this; what it needs is
a deliberate six-colour system rather than per-pack corrections, plus
`ACESFilmicToneMapping`. No geometry changes and no GPU cost.

Then, in order: one directional light with a tight shadow frustum plus a
hemisphere light so nothing is dead black; two-tone shallow/deep water with
shoreline foam; `FogExp2` in the water's colour to dissolve the far plane.

**Do not add** SSAO, depth of field, or screen-space reflections. On a Retina
laptop those break the fill rate budget. Clamp `dpr` to `[1, 1.5]`.

## Independently Verified Here

Everything in this section was checked directly, because a licence claim a
model makes is not a licence.

| Claim | Verdict |
| --- | --- |
| `thaslle/stylized-water` — R3F stylised water, MIT | **Confirmed.** MIT, 70 stars, last pushed 2025-03. |
| `cortiz2894/water-anime-shader`, MIT | **Name is stale.** Redirects to `cortiz2894/stylized-components`, MIT, 322 stars. Real project, wrong name. |
| KayKit (Kay Lousberg) is CC0 with glTF | **Confirmed**, and worth adopting — CC0, no attribution, commercial use, ships OBJ/FBX/glTF. Note the working home is `kaylousberg.itch.io`, not the `.com` path that was given. |
| `labelgun` is archived | **Confirmed.** Archived, last pushed 2021-07. Do not add. |
| `yomotsu/camera-controls` MIT | **Confirmed.** MIT, 2.4k stars, pushed 2026-02. |
| `d3-labeler` licence unknown | **Correction: it is MIT.** The researcher said it could not find a LICENSE file and flagged the uncertainty rather than guessing, which was the right instinct. The decision does not change — last pushed 2017. |
| Quaternius, Kenney, loafbrr CC0 | Already verified in this repository's own licence register and enforced by `import-kit.mjs`. |
| Poly Pizza is mixed CC0 / CC-BY | Not re-checked. Treat as **unverified**: if anything is taken from there, check that item's own licence, and CC-BY needs an attribution page this product does not have yet. |

Two claims were reported with explicit uncertainty by the researchers
themselves — a Clash of Clans camera angle taken from a 2015 community
measurement, and the Mario world-map pitch, which was described rather than
measured. Neither is load-bearing: the recommended angles come from Mapbox and
from the isometric definition, both of which are checkable.

## Order Of Work

Ranked by visible improvement over effort. The first two are hours, not days,
and between them they are most of the complaint.

1. **Lock the camera.** Fix polar to ~54° world / ~50° course, field of view to
   ~34°, disable rotation, make a two-finger swipe pan. No new dependency.
2. **One six-colour palette plus ACES tone mapping** in the existing repaint
   table.
3. **Stop labelling all 41.** Numbers by default; current, next and unit name
   always; raise the lesson weight so the next lesson can never be the one that
   gets dropped.
4. Directional light with a tight shadow frustum, plus a hemisphere fill.
5. Two-tone water with shoreline foam — `thaslle/stylized-water`, MIT.
6. `FogExp2` in the water's colour.

Items 1 and 3 are also the two that no amount of art fixes, because they are
about what the screen is *for*.
