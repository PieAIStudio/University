---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-22
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related:
  - ADR-0001
  - ADR-0002
  - ADR-0003
  - ADR-0004
---

# Current Work

The short, current handoff. **What is true now, never how it got that way.**

Reversals live in `docs/adr/` as decision records with `supersedes` links.
Nothing on this page explains what a rule used to be — if you need that, an ADR
has it, and you only need it when you are about to argue a rule should change.

## Shape

```
apps/local      authoring — filesystem, CLI, single machine   (9999)
apps/online     delivery  — 3D archipelago, progress, review  (9998)
packages/core   the domain model. No React, no fs, no network.
packages/ui     the learning surface and the app chrome, both shells
packages/world  the scene. packages/ui stays at zero three.   (ADR-0004)
packages/avatar 3D avatars, vendored from kindergrimm (Unlicense)
```

```bash
pnpm content && pnpm dev                       # online, 9998
pnpm --filter @pieai/university-local dev      # local, 9999
```

## Numbers, Counted Not Remembered

52 courses · 146 units · **560 lessons** (558 unique ids — two ids are claimed
twice) · 1,815 `[[evidence:]]` markers resolving to **1,597 anchors** · 281
concepts · 267 terms · 25 anti-patterns.

420 lesson-to-lesson links, 383 inside their own course and **five** crossing
one: the mesh does not exist yet. `[[term:]]` links: zero.

Tests: core 227 · ui 134 · online 24 · local 441.

**Re-run the script before quoting any of these.** Every number on this page
has been wrong at least once.

## Known Content Faults

`apps/local/scripts/check-lesson-links.mjs` reports both:

- **4 dangling `[[lesson:]]` links** — targets that do not exist.
- **2 duplicated lesson ids** — `fetch-not-clone` and `refuse-not-skip`, both in
  `university-local`. This is the worse one: nothing errors, the token just
  resolves to whichever lesson the lookup reaches first.

Fixing either means editing content, which is authoring work.

## Standing Constraints

- Courses are authored only in `apps/local`. One producer, always. Publishing
  is a separate, gated act (ADR-0002).
- Both shells sign in to SwimmerBackend and share account, progress, review,
  favourites, settings. `GradingPort` is the only permitted divergence:
  clipboard and AI coding host on one side, metered SwimmerAIKit on the other
  (ADR-0001).
- The disk stays the source of truth for `apps/local/studies/` — registered
  private repositories and prose being written.
- Readable text is DOM, never geometry. Web3D baseline rule 7.
- 3D owns the map and the rituals. Reading, answering, reviewing, account and
  payment are 2D DOM through SwimmerUIKit.
- All model calls go through SwimmerAIKit, tiered cheapest-first: deterministic,
  then structured small model, then metered open tutoring.
- Evidence is an opaque typed anchor rendered by a registered renderer. Adding
  a second kind is a new renderer, not a schema migration.
- Layout differs by CSS breakpoint inside one component tree. A second
  implementation is not a responsive layout.

## Design Before Build

`docs/reference/player-journey/v3/index.html` — **open it in a browser**, it
uses relative image paths. It supersedes v1 and v2 and covers every
learner-facing surface. Its evidence base is
`docs/reference/借鉴的App/duolingo-teardown/index.html`, 33 frames with stable
ids (`C5`, `E1`, `W2`) that v3 cites.

The instruction behind v3: **take Duolingo's structure wholesale and put our
content in it.** Slot count, slot position and flow are copied. What sits in
each slot is ours.

## Order Of Work

1. **Navigation skeleton.** Web three columns, mobile six tabs, four counters,
   all eight slots built, empty ones with real empty states. *In progress.*
2. Node popup and unit card. *Done, less the anchored arrow from frame C5.*
3. `spineOrder` and the three-cell spur window. *spineOrder done.*
4. **Capability sentences** — one first-person "after this you can —" per
   course and per unit. Pure copy, no code risk. Best inserted first.
5. Islands in the sky: sky layers, cloud, island underside, foreground frame,
   AO and colour grading. Needs `packages/world` extracted first.
6. The four ports; delete online's duplicate reader; hide navigation in a
   lesson; separate read from answered.
7. Evidence code in the delivery shell (ADR-0003).
8. Publish lane and entitlement (ADR-0002); Electron and Capacitor shells.
9. SwimmerBackend: accounts, payment, metered AI.

## Traps, Found The Hard Way

- **The camera lever is `COURSE_POLAR`, not camera position.** `Controls` pins
  `minPolarAngle` and `maxPolarAngle` to the same value and `MapControls.update()`
  recomputes position every frame from (target, distance, azimuth). You control
  distance and target. Nothing else.
- **Fog is computed from how far you can see, not how big the world is.**
  `Weather` takes an explicit `fog?: [near, far]` for this reason.
- **Label opacity goes through the `--placed` CSS variable, never inline
  `opacity`** — inline beats every non-`!important` rule and kills
  `.label--quiet`. Invisible labels must not compete for avoidance slots, and
  the per-frame reset loop keys on ids projected *this frame*, not on avoidance
  candidates.
- **`packages/ui` has no `"./*"` export wildcard.** Every sub-path is explicit.
  Typecheck, lint and tests do not resolve through `exports`; only Vite does,
  and it caches the workspace manifest — so "correct, all green, site 500s" is
  reachable. Restart the dev server after adding a sub-path.
- **`packages/core` must emit real JavaScript.** `apps/local`'s server is a Node
  process and cannot import `.ts` from a workspace package the way Vite can.
- **Type packages are workspace infrastructure.** `@types/three` inside an app
  breaks every `<mesh>`, because `.pnpm` resolves `three` by walking up to the
  root. `publicHoistPattern` is the fix.
- **The root `doc-gov` and `pnpm --filter … doc-gov` have different scopes.**
  `pnpm docs:check` uses the root one. Regenerate the manifest with
  `pnpm doc-gov scan`, not the filtered form.
- **Videos never enter git.** `.gitignore` excludes
  `docs/reference/借鉴的App/*.mp4|MP4|mov`.
- **This file is pinned.** A commit touching it needs
  `Pinned-Override: REF-CURRENT-WORK` in the message. SPEC-0001 needs its own.

## Verification

Smallest relevant checks, then `pnpm verify`. Browser-visible changes also need
a real browser pass and a screenshot — fog, labels and camera have all shipped
broken with every test green.

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
node apps/local/scripts/check-module-boundaries.mjs
pnpm verify
```
