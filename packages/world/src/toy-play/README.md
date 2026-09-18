# Toy interaction parts

Three actual arcade loops, using the owner's accepted toy art direction.
`ArcadeScene` composes the existing `Stage`: one renderer, one RenderKit grade,
shared sky environment and bounded scene objects. `ArcadePlayer` is the single
host for both the catalog's `3D组件` category and `/play-lab/toy-3d`.
All 50 pre-existing catalog entries remain; the new three have their own IDs.

## Shared building blocks

- `parts.tsx`: rounded block, ball, socket, parcel, tree, flower, bridge and garden.
  Geometry and palette materials are shared; no copied scenery per game.
- `geometry.ts`: bevelled toy bases and a word board with a real slot. Smooth
  corner normals preserve the manufactured-toy look without a second map generator.
- `assets.ts`: four exact entries in the existing
  `../island/kenney-r01-assets.json` ledger. No fallback aliases and no extra model
  bundle. The stall, cart and lantern are Kenney Fantasy Town Kit 2.0; the rock is
  Kenney Nature Kit 2.1. Both use CC0-1.0. The ledger preserves source filenames,
  SHA-256 hashes, license identity/hash and the referenced color-map dependency.
- `Donor`: clones the cached scene and owns its tuned material instances;
  never edits/disposes the cached original geometry or texture. The same palette
  map is used, with tuned roughness, light clearcoat and grounded bounds. The
  stall roof's stripes modify only its owned material in source-local coordinates.
- `arcade-engine.ts`: one fixed-step `ArcadeSession`, with real projectiles,
  matching-tool collisions, diving, ten waves/upgrades, falling classification,
  overflow, rising sentences, six-word inventory and delayed error practice.
  Frame transforms read the live state; React receives snapshots at 10Hz, never
  per pointer event. Local scores do not write course progress or cloud XP.
- `material.ts` / `arcade-content.ts`: bounded bilingual teaching examples,
  NASA's real photo/record and clearly identified source summaries. The new
  word game also practices transcription/translation and task requirements.

Readable labels are screen-aligned DOM. Sentence planks and their labels share
projected spacing; inventory chips occupy a camera-facing foreground plane with
the same screen datums as the six semantic word controls. Words remain readable
without shrinking touch targets when the camera or viewport changes. Pointer
drag, clicks, arrows, number keys and Space feed the same simulation.

The physical word faces remain cream in both page themes. Their overlaid text
uses the kit's light-surface ink pair, not theme-relative page ink (which turns
pale in night mode). Browser regression samples actual rendered canvas pixels
under the words after mesh/DOM alignment; a transparent DOM background alone
cannot establish contrast. The same ink rule applies while dragging a word.

Target annotations retain readable dimensions through `label-layout.ts`.
Nearer targets get placement priority; displaced labels have DOM/SVG leaders
back to the real bodies. Collision layout never changes the physics or hides a
target. The shared garden's tall scenery stays outside the spawn/movement area.

The simulation stops synchronously before the DOM/R3F pause commit,
so a stale render callback cannot add damage after Pause. Boot rendering remains
enabled until Stage's first-frame readiness signal; simulation stays stopped.
Hidden pages, focus loss, material reading and offscreen play stop progression.
The native game clocks are retained, with optional half-speed practice. WebGL
loss preserves the paused session and offers a new renderer or the original 2D
game, not an unrelated quiz fallback. Shared sound preferences are respected.

The owner rejected the earlier sequential quiz workstations. Their unused
runtime and tests were retired; their original evidence remains in Git and the
prior visual receipts. No original 2D research source was removed or rewritten.

Mini Forest was inspected as a candidate but is **not** part of this runtime.
These toys reference existing portable files, not `/Users/.../_donors`.

## Verification

`arcade-engine.test.ts` covers wins/losses, all ten waves, actual shot collisions,
upgrades, stacking, word supply, later practice, fixed-step equivalence and
suspension. `assets.test.ts` verifies the unchanged model/texture hashes.
`e2e/arcade3d.spec.ts` exercises live motion, pointer/keyboard/touch, actual
rounds, the 3D catalog, word dragging and interruption/recovery. Synthetic focus
and context-loss notifications are explicitly identified in the tests.
`geometry.test.ts` retains the shared bevel and reusable open-slot checks.
Touch viewport emulation is not a physical-phone performance measurement.

Screenshots and measured frame/resource receipts belong in
`.devspace-visual/interaction-3d/`, not in source or a fabricated score. The
canonical scope/status is `docs/plans/active/interaction-3d-playlab.md`.
