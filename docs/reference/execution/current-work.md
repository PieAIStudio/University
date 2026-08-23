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
packages/world  the scene — both shells import it.              (ADR-0004)
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

Tests: core 252 · ui 192 · online 57 · world 35 · local 448. Plus 4 browser walks (`pnpm e2e`).

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

`docs/reference/player-journey/v4/index.html` — **open it in a browser.** It
supersedes v1, v2 and v3, and is an amendment rather than a rewrite: anything
v3 says that v4 does not contradict still stands. V4's law is that the shells
may differ in exactly one place, where the AI comes from.

`docs/reference/player-journey/v3/index.html` still holds the screen inventory
and the Duolingo mapping. Its evidence base is
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
  imports it.
- **Authoring overlay.** SPEC-0003 step 2. The local shell renders the same
  scene plus its overlay. The 2D catalog is still on the landing (no entry
  buttons) until every row in the SPEC table is visible in the new surface.
- **One counter row.** Both shells call `universityCounters`; neither keeps its
  own idea of what belongs in it.
- **One remaining-count sentence.** The rail's `TodayCard` and the mobile
  `.nextup` overlay both call `todayMeta`; neither quotes the catalogue size.
- **Mermaid and external-link CSS.** The last `packages/ui` component styles
  that lived only in `apps/local` now live next to the component.
- **`courseShapeOf` in core.** The 2D catalog no longer imports "world" for a
  pure fold of lesson ids.
- **IdentityPort and ProgressPort.** Sign-in is optional. Missing env is
  silent. Progress stays on the machine; merge is tested against a replaceable
  remote. University is not a SwimmerBackend consumer yet, so the real table
  is not wired.
- **`pnpm start`** opens both shells and says which is which; `--lan` puts the
  delivery shell on this machine's network address so a real phone can reach
  the layouts it was drawn for.
- **`pnpm e2e`** — four walks in a real browser, deliberately outside
  `pnpm verify`. It has already caught two things no unit test could: a review
  simulation that was a silent no-op, and new cards contradicting the screen
  that promised them.
- **A new card is tomorrow's work.** The settlement and the review empty state
  used to make opposite promises about the same two cards.
- **One empty-queue sentence.** Both shells call `reviewEmptyDescription`;
  neither writes its own, and neither says FSRS at a learner again.
- **Both shells have an icon.** `scripts/make-icons.mjs` writes favicon,
  apple-touch-icon, maskable icons and a manifest for each from `IslandIcon`,
  differing only in colour so two tabs can be told apart. `theme-color` too.
- **A label that does not fit is not placed.** Containment, not intersection —
  the four slots already offered a side that fits.

Next — **the order is set by
`docs/reference/player-journey/v4/index.html` §10, not by this list.** V4's
first item is ReaderPort, because until the delivery shell stops carrying its
own lesson reader every new feature has to be written twice.

1. **Register University in SwimmerBackend** — *needs the owner.* An app id, a
   `university` schema that is neither `core` nor `public`, one progress row
   per user, RLS scoped to `auth.uid()`, and a real sign-in from a real
   address. Everything on this side is written and tested against a fake, so
   this is the only step nobody here can take.
2. **The 19 seconds after the canvas mounts.** Of the 28.4s to first frame on
   throttled 4G, roughly 19 are `loadGraph()` fetching 52 course JSON files and
   the kit's GLBs. The JavaScript half is solved; this is data, and it is now
   the whole wait.
3. **SPEC-0003 step 3.** Retire the authoring 2D catalog only after every row
   in the overlay table is visible on the world landing without scrolling to it.
4. **The light theme cannot work yet.** 270 raw colour literals are invisible
   to the contrast checker, which only reads token pairs. Until they are
   tokens, no amount of contrast fixing makes that theme usable.
5. **A persisted record of a wrong answer.** 错题本 (v3 16) has nothing to
   count: wrong picks live in component state and vanish with the question.
6. ContentPort and EvidencePort; delete online's duplicate reader; separate
   read from answered.
7. Publish lane and entitlement (ADR-0002); Electron and Capacitor shells.
8. Payment and metered AI, after 1.

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
- **A control over live render brings its own ground.** No stylesheet knows
  what the canvas is drawing this frame, so `ghost` and any other transparent
  variant is wrong on top of one. The avatar-lab link shipped cream-on-cream
  this way. Same family as the `backdrop-filter` finding above.
- **Quiet is a colour, never `opacity` on a whole control.** Dimming the box
  dims its background too, and the text underneath interleaves with the label.
- **`tsc -p` has no memory; `tsc -b` and `incremental` do.** Plain `tsc -p`
  rewrites every output on every run, and anything watching `dist` reacts to
  all of it — forty HMR updates on a `pnpm start` over files nobody touched.
- **three deprecates by silently substituting.** `PCFSoftShadowMap` now warns
  once and draws `PCFShadowMap`; a `console.warn` in a dev log is the only
  notice that a rendering choice stopped applying. Read the warnings.
- **A test that greps prose forbids the prose.** The account panel's test
  banned the string 「登录」 to mean "no sign-in control", and so banned the
  sentence explaining that there is nowhere to sign in. Assert on structure.
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
