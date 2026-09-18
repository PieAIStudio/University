# Toy interaction parts

An isolated play-lab experiment, not a replacement course author or game engine.
`ToyScene` composes the existing `Stage`: one renderer, one RenderKit grade,
shared sky environment, context-loss handling and hidden-page suspension.

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
- `rules.ts`: pure, finite, repeatable local states. No course writes, model
  calls, rewards, network scoring or claim of independent mastery.

Readable labels are screen-aligned DOM. Small views use numbered pads with full
accessible names, paired with visible word/action buttons. Pointer ray/plane drag,
tap selection and keyboard 1/2/3 reach the same reducer. The simple DOM view remains
fully playable without WebGL. Continuous challenge is optional and suspends on
pause, source reading, errors, loading, hidden pages and an offscreen play table.
These are peaceful workbench adaptations of the selected prototype IDs, not
feature-identical recreations of the shooting or rising-stack rules.

Mini Forest was inspected as a candidate but is **not** part of this runtime.
These toys reference existing portable files, not `/Users/.../_donors`.

## Verification

`rules.test.ts` covers each complete round, retries, timeout, inactive clocks,
duplicate submission, invalid actions and reset. `assets.test.ts` verifies exact
model/texture hashes and the subset's byte budget. `e2e/toy-play.spec.ts` exercises
the rendered scenes, DOM/touch controls, both physical drags, context-loss
fallback/reopening and honest completion. `geometry.test.ts` ray-tests the open
slot and validates the bevelled base geometry. Real phone frame rates remain
unmeasured; viewport emulation is not physical-device performance testing.

Screenshots and measured frame/resource receipts belong in
`.devspace-visual/interaction-3d/`, not in source or a fabricated score. The
canonical scope/status is `docs/plans/active/interaction-3d-playlab.md`.
