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
