---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-23
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
  - ADR-0005
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
packages/world  the scene — delivery already imports it.        (ADR-0004)
                packages/ui stays at zero three.
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

Tests: core 227 · ui 159 · online 32 · world 23 · local 444.

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
- 3D avatars come from `@pieai/swimmer-avatar-kit`. Capability the kit lacks
  goes upstream, not into a University fork (ADR-0005).

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

Done, and verified in a browser rather than by a passing suite:

- **Navigation skeleton.** Both shells wear one chrome from
  `packages/ui/src/shell` and `packages/ui/src/navigation`: web three columns,
  mobile six tabs, four counters, eight slots, real empty states. The context
  column collapses when a page has nothing for it.
- **Node popup and unit card**, including the anchored tail from frame C5.
- **`spineOrder`** for all four studies.
- **Capability sentences** — 146 unit objectives in the first person.
- **Path legibility** — nodes from 6% of viewport width to 14.8%, three states,
  one hue per course, unit boundaries, kind icons.
- **Evidence code in the delivery shell** (ADR-0003). 1,597 anchors baked.
- **One overlay layer.** Titles, kind icons and unit names share one avoidance
  pass. The invisible-but-clickable labels that ate the unit-strip button are
  gone with it.
- **The reading screen.** A ✕ and a bar over sections within the lesson.
- **`packages/world`.** SPEC-0003 step 1. The scene lives there; delivery
  imports it. Authoring does not, yet.
- **One counter row.** Both shells call `universityCounters`; neither keeps its
  own idea of what belongs in it.
- **One remaining-count sentence.** The rail's `TodayCard` and the mobile
  `.nextup` overlay both call `todayMeta`; neither quotes the catalogue size.
- **Mermaid and external-link CSS.** The last `packages/ui` component styles
  that lived only in `apps/local` now live next to the component.
- **`courseShapeOf` in core.** The 2D catalog no longer imports "world" for a
  pure fold of lesson ids.

Next:

1. **A loading state.** The canvas paints black before its first frame, which
   reads as a broken page. v3 screen 09 spends one of the 281 concepts on it.
2. **Islands in the sky** — sky layers, cloud, island underside, foreground
   frame, AO and colour grading.
3. **SPEC-0003 step 2.** Authoring takes the same scene plus its overlay.
4. The four ports; delete online's duplicate reader; separate read from
   answered.
5. Publish lane and entitlement (ADR-0002); Electron and Capacitor shells.
6. SwimmerBackend: accounts, payment, metered AI.

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
- **A control over the canvas can be in the accessibility tree and still be
  unclickable.** The canvas stacks above the overlay, so `element.click()`
  succeeds where a human click does not — and a test written with `.click()`
  passes throughout. This repo has shipped this twice now; the first time,
  course names were `aria-hidden` with `pointer-events: none` and the only way
  into a course was clicking a polygon.
- **A blank canvas is two different faults that look identical.** Read
  `globalThis.three` before touching the camera: no handle means the renderer
  never started, a handle plus an empty `scene` means the scene failed, and a
  handle plus a populated scene means you are early in the load. Only one of
  the three is fixed by moving the camera.
- **Two size heuristics fire on things that are fine, and both were
  measured before being left alone.** `packages/core/src/concepts/data/` is
  1.6MB of concept prose across six files, one of them 930KB — but a full
  `packages/core` typecheck including it is 4.3s, so the cost the size implies
  is not there. `apps/local/server/workflows/` has 34 direct children, over the
  grab-bag threshold — 17 single-purpose workflows and 17 colocated tests, not
  a junk drawer. Splitting either on the number alone is the anti-pattern the
  refactor methodology names first.
- **`backdrop-filter` over a live WebGL canvas breaks past roughly 260px
  wide.** The panel and everything inside it turns into a flat grey slab.
  `docs/reference/learnings/workflow-issues/` has the measurements. Panels over
  the scene are opaque now and should stay that way.
- **A shared component's stylesheet belongs in `packages/ui`, not in an app.**
  `scripts/check-shared-styles.mjs` ratchets this: 120 classes are already
  styled by exactly one shell, and only new ones fail. Nine components already
  ship their own CSS and both shells import it — copy that pattern rather than
  adding a rule to an app.
- **This file is pinned.** A commit touching it needs
  `Pinned-Override: REF-CURRENT-WORK` in the message. SPEC-0001 needs its own.

## Verification

Smallest relevant checks, then `pnpm verify`. Browser-visible changes also need
a real browser pass and a screenshot — fog, labels and camera have all shipped
broken with every test green.

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
pnpm boundaries    # module boundaries · kit portability · contrast · shared styles
pnpm verify
```
