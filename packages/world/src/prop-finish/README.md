# Map-object surface refinement

This is a ten-object art comparison, not a world skin or learning game.
`/play-lab/prop-finish` replaces the rejected wax-island experiment. Old wax URLs
show a retirement notice; commit `1f971a93` and its original evidence retain that
experiment. No scattering, wax material owner or avatar override remains active.
The nine approved games, map generators and donor files are unchanged.

## What is compared

| Method                 | Mechanism                                                                                                                                               | Best inspected on                                       | Limitation                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Original               | Actual map adapter material and geometry, normalized for a shared studio                                                                                | All ten                                                 | Studio lighting is not the live island's lighting; compare within this page                      |
| Soft-sculpted          | Coincident-position normal averaging at 0.72, restrained matte response, suppression of fine normal perturbation                                        | Gray rock cluster                                       | Normals do not change the silhouette; can bend shading across structural panels                  |
| Physical edge rounding | Offline finite-width bevel, per-existing-connected-shell width clamp, three segments, weighted corner normals                                           | Gray rocks, fountain rim, doorway, hard prop edges      | Extra triangles; trees already have rounded forms, so use selectively and mainly near camera     |
| Material-aware finish  | Original palette roles, local grain direction, correlated pigment/roughness/shallow relief, geometric convex-edge pigment and indirect-light visibility | Gray mineral faces, wooden cart, wood/coating junctions | Not a measured physical material; foliage is deliberately restrained; no new geometry silhouette |

The last two methods start from the original, not the sculpted version. The
material-aware method explicitly combines **surface-role details and geometric
masks**; it does not secretly include the bevel or sculpted normals. Direction is
a deterministic longest-axis estimate for an existing connected shell, not
semantic AI recognition of every timber joint. No photographic texture is used.
A normal-map suppression blend is not the same as smoothing geometric faces:
the former affects perturbed shading normals, the latter is the normal-copy step.

## Source and ownership

`catalog.ts` is the ten-item source list. Seven Kenney objects use the existing
`AssetField` normalization, `preserveMap` decision and `courseFacilityTreatment`.
The two trees use `CourseTreeField` and its current generated geometries. The gray
rock group is `createMiniatureAsset("stone")`, used by `RemotePropsField` and by
course stone assembly; it retains that field's vertex-color material response.
It is not a substitute demonstration rock. The first moss-topped stone is the
actual nature-kit rock, not recolored to look like the gray assembly.

Kenney adoption, model source hashes, texture and CC0 license provenance remain
in `../island/kenney-r01-assets.json` and the existing asset registry. Derived
geometry below `apps/university/public/art/prop-finish/` retains those source
identities in each metadata file. University procedural tree/rock geometry stays
University-authored. Blender is a build tool, not runtime or bundled source.

The hidden original adapters keep ownership of their cached model and textures.
This page owns normalized geometry/material copies and treatment resources only.
Originals are always available; changing a method does not rebuild the source,
change its fit, move its features or write an account/learning record. One Stage
and one unchanged RenderKit output chain serve both columns and the ten-object
view. Key/rim/hemisphere lights and neutral pedestal are equal for both versions.

## Rebuild and checks

With this checkout's delivery preview running on an unused loopback port:

```sh
node scripts/export-prop-finish.mjs http://127.0.0.1:23220
blender --background --factory-startup --python scripts/prepare-prop-finish.py -- \
  .scratch/prop-finish/input.json apps/university/public/art/prop-finish
pnpm --filter @pieai/university-world exec vitest run src/prop-finish/refinement.test.ts
pnpm e2e prop-finish.spec.ts
```

The exporter captures actual committed map-adapter outputs, not a parallel model
loader. The offline tool never writes its input or donor directory. JSON stores
source signatures, recipe and buffer SHA-256; Float32/Uint32 geometry is a compact
binary file. Runtime checks hashes, channel bounds and source signatures, and
fails visibly on stale/missing output. Atlas dimensions must match metadata.
Blender's derived bevel UV interpolation showed up to 1.2e-7 run-to-run float
variation while geometry, normals and other treatments stayed identical. Bevel
UV serialization is canonicalized to 1e-5 (at most 5e-6 UV error); this affects
only new bevel vertices, not source or material-aware UVs. Reproducibility still
requires exact file hashes, not tolerance-based approval of different artifacts.

Visibility uses 96 deterministic cosine-weighted rays per evaluated point, with
finite distance and origin bias. The RGB atlas packs indirect visibility in red
and true adjacent convex-edge proximity in green; blue is unused. Per-face UVs
are padded. It preserves original triangle count rather than subdividing a model
just to store more shading samples. Atlas seams can still require split vertices
and extra attributes: unchanged triangle count is not a claim of zero memory cost. Original albedo UVs are separate and intact.
The diagnostic checkbox shows these masks, not a beauty result. No direct sun
shadow is baked. `material-aware` attenuates indirect lighting only; on a future
world integration do not multiply another cavity AO blindly on top of it.

Tests cover all ten artifacts, checksum failures, invalid data, source UV/normal
ownership, material hooks and transparency. Browser tests cover actual controls,
same-camera source identity, warm resource switching, mobile layouts, no-grade
and masks. Counts are shown per object: the production budget still belongs to
the relevant projection; this laboratory does not authorize increasing it.

## Research and discarded trials

Primary references used, not copied library implementations:

- Blender: https://docs.blender.org/manual/en/3.0/modeling/meshes/editing/edge/bevel.html
  and https://developer.blender.org/docs/release_notes/2.80/modeling/ — physical
  bevels plus custom/weighted normals keep broad surfaces flat.
- Filament: https://google.github.io/filament/main/filament.html#occlusion —
  geometric visibility and the distinction between indirect and direct lighting.
- Adobe: https://helpx.adobe.com/substance-3d-community-assets/desktop/the-different-asset-types-on-substance-3d-community-assets/smart-material.html
  and https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/generators/mask-builder
  — material families and geometry-aware masks, not a universal noise overlay.
- Three: https://threejs.org/docs/pages/MeshStandardMaterial.html — compose into
  the existing metal/roughness response without another renderer or grade.

`pilot-1`: AO-only gave too little benefit on isolated convex surfaces. Dense
triangle subdivision also cost too much. Rejected as the second final method.
`pilot-2`: mineral relief looked sandy/cork-like and a tiny disconnected piece
limited all bevel widths. Reduce relief and clamp per actual connected shell.
`pilot-3`: bright curvature outlines made tree crowns look polygonal and wrong.
Suppress edge pigment on foliage, preserve the canopy and improve wood direction.
`pilot-4`: the retained physical bevel and material-aware treatments have distinct
benefits on gray rocks and hard/wooden props. Trees remain a counterexample to
blanket application. The active plan owns final validation and image evidence.

Do not move this complete laboratory into RenderKit. Reusable normal/asset
processing and product-specific role selection have separate owners. Before any
broad adoption, select the winning object/method pairs, rebuild that projection's
asset batch and measure its real view. No new global style preference is created.

When merging the parallel clay lane, explicitly keep this comparison canvas out
of its global WorldAppearance material pass. Otherwise even the left-hand
original would be overwritten and the comparison would become misleading.
This branch does not install or duplicate that other lane's global owner.
