# SwimInAI island export

This development-only exporter turns University's serialisable
`islandBlueprint` and `buildIslandGeometry` into assets that
`SwimInAI-Website` can load without importing University at runtime.

Run it from the University repository root:

```bash
SOURCE_DATE_EPOCH=1791417600 pnpm export:swiminai-islands
pnpm export:swiminai-islands:check
```

The first command writes `generated/` with four standalone islands (`break`,
`uni`, `dir`, `party`), one merged `swimmer-world.glb`, and markers/nav/stats
JSON. The merged world uses a compact 2x2 diamond layout, one vertical +Z
portal on each product island, one merged miniature dressing mesh, and curved
bridge meshes whose points are the same points written to nav JSON.
The second command regenerates into a temporary directory and compares every
GLB and JSON byte-for-byte. `SOURCE_DATE_EPOCH` fixes the informational
timestamp in `export-record.json`; it does not affect geometry.

The merged GLB contains the current website node contract: `ground`,
`portal_break_surface`, `portal_uni_surface`, `portal_dir_surface`,
`portal_swimmerparty_surface`, `spawn`, `hub`, the matching portal/front
markers, `bridge_break_`, `bridge_university_`, `bridge_directing_`,
`bridge_swimmerparty_`, `sign_anchor`, and `sun_dir`.

Decoration is baked through University's existing `remote-props`/miniature
layout and recipe mappings, with low-cost vertex-coloured meshes merged by
material. The JSON records the actual dressing blockers, walkable outlines,
portal bottom/center/front contract, bridge points, source asset credits, and
per-scene draw/triangle stats. No synthetic lesson nodes are emitted as
obstacles. The export record lists each file's SHA-256, fixed seed, recipe,
source modules, and the University commit supplied at export time
(`UNIVERSITY_COMMIT` can override it).

## Pure R3F renderer

Build the copyable library artifact with:

```bash
pnpm build:swiminai-island-render
```

The output is `render-dist/`: `swiminai-island-render.js`, its source map,
`swiminai-island-render.d.ts`, the four University surface textures, the
two aerial background plates, `render-blueprints.json`,
`render-navigation.json`, and `manifest.json`.
The entry is
`@pieai/university-world/swiminai-island-render.js` and its API is:

```tsx
<SwimInAIIslandRender
  blueprint={blueprint}
  detail="course"
  targetRadius={3.2}
  display={{ id: "uni", name: "University" }}
/>
```

`course` mounts `IslandRender` with University's surface detail/course atlas,
`IslandGrass`, and `IslandDressing`. `world` mounts the shared remote terrain,
miniature surface atlas, and remote dressing. The host owns Canvas, camera,
lights, Stage AO/grade, and the aligned external packages. The manifest pins
Three `0.185.1`, React `19.2.8`, React DOM `19.2.8`, R3F `9.6.1`, Drei
`10.7.8`, and SwimmerRenderKit `0.5.0`; all are external and must be supplied
by the website.

`render-blueprints.json` is the copyable serialisable input for this entry. It
contains complete `IslandBlueprint` objects for `center`, `break`, `uni`,
`dir`, and `party`, generated from the fixed `swiminai/plan-0002/*-v1` seeds
and the existing recipe catalog. It is generated with
`pnpm export:swiminai-render-blueprints` (or as part of the renderer build);
the generator remains a University development tool and is not bundled into
the website artifact.

`render-navigation.json` is the matching runtime navigation receipt. It is
generated from the same world-detail terrain, `planRemoteIslandProps`,
`miniatureMetrics`, pools, portal ground samples, and bridge surface endpoints;
the website consumes its `walkableOutline` and `blockers` instead of copying
decoration coordinates.

The manifest's declaration file is the public TypeScript contract; it includes
`SwimInAIIslandRenderProps`, `SwimInAIIslandDisplay`, `IslandBlueprint`, the
lighting/environment/sky exports, grade pass, look-metrics functions, and the
alignment constants. The aerial resources are copied to
`render-dist/sky-assets/` and their hashes are listed in the same manifest.

## Source reference fixture

The source-only comparison page lives at
[`reference.html`](./reference.html) with [`main.tsx`](./main.tsx). It imports
University source modules directly, freezes `blueprints.uni`, `detail=world`
(`?detail=course` is available for the course frame baseline), `targetRadius=3.2`,
camera `(10,9,16)` looking at `(0,0,0)`, `fov=34`, and viewport `1440×900`
at DPR 1. It uses the shared `MapLighting` course profile,
`WorldEnvironment`, `SkyDome`, aerial plate/deep sea, and `WORLD_GRADE` pass.

Run it with:

```bash
pnpm reference:swiminai-island
# open http://localhost:4321/reference.html?detail=world
```

After the frame is ready, Playwright or the browser console can call
`window.__swiminaiReferenceInspect()` for the actual camera, light list,
shadow-light count, scene+shadow draws/triangles, post draws/triangles, full
frame counters, grade and code metrics. Call
`window.measureSwimInAIReferenceLook()` for the repository's pixel
`measureIslandLookInBrowser` report; it samples the painted WebGL canvas and
returns the same `ISLAND_LOOK_CONTRACT` fields used by University. The source
fixture's image inputs are `packages/world/src/assets/generated/aerial-world-
plate-{2k,4k}.webp`, and the blueprint input is
`tools/swiminai-islands/render-dist/render-blueprints.json`.

The seed/contract receipt is [render-contract.json](./render-contract.json).
It reports geometry, dressing, grass, look-metrics and the fixed
`ISLAND_LOOK_CONTRACT` thresholds. Pixel brightness and key/fill values remain
Stage/browser capture responsibilities, so the receipt marks those fields as
`capture-required` rather than inventing measurements.
