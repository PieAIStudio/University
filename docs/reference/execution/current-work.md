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

> **合成一套代码，已完成（2026-08-25）**：`apps/local` 与 `apps/online` 已合并为
> `apps/university` 一个浏览器应用，用 `vite --mode authoring | delivery` 区分。
> `apps/local` 现在只剩那台读磁盘的 Node 服务（4317），没有被改动。
> 经过、踩过的坑和验收数字都在 [One App Handoff](./one-app-handoff.md)。

Reversals live in `docs/adr/` as decision records with `supersedes` links.
Nothing on this page explains what a rule used to be — if you need that, an ADR
has it, and you only need it when you are about to argue a rule should change.

## Shape

```
apps/university  the product. One source tree, built twice:
                 --mode delivery   3D archipelago, progress, review   (9998)
                 --mode authoring  the same, plus #/studio and 4317   (9999)
                 src/ports/        the only place the two builds differ
                 src/authoring/    workbench only; eliminated from delivery
apps/local       the authoring Node server. Filesystem, CLI, no UI.   (4317)
packages/core    the domain model. No React, no fs, no network.
packages/ui      the learning surface and the app chrome, both modes
packages/world   the scene — both modes import it.              (ADR-0004)
                 packages/ui stays at zero three.
```

```bash
pnpm content && pnpm dev                       # delivery, 9998
pnpm --filter @pieai/university-app dev:local  # authoring, 9999 (needs 4317)
pnpm --filter @pieai/university-local dev      # the authoring server, 4317
pnpm start                                     # all three, labelled
```

`pnpm bundle` reads `apps/university/dist/delivery/**` and fails the build if
anything from `src/authoring/` survived into it. Tree-shaking is a belief until
something reads the output.

## Numbers, Counted Not Remembered

52 courses · 146 units · **560 lessons** (558 unique ids — two ids are claimed
twice) · 1,815 `[[evidence:]]` markers resolving to **1,597 anchors** · 281
concepts · 267 terms · 25 anti-patterns.

420 lesson-to-lesson links, 383 inside their own course and **five** crossing
one: the mesh does not exist yet. `[[term:]]` links: zero.

Tests: core 340 · ui 249 · world 128 · university 108 · local 406 = **1,231**.
Plus 13 browser walks (`pnpm e2e`), two of which (`G`, `G2`) exist only to
compare the two builds against each other rather than to check either alone.

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

- Courses are authored only by the `apps/local` CLI and the files on disk. One
  producer, always. Publishing is a separate, gated act (ADR-0002).
- Both shells sign in to SwimmerBackend and share one cloud learner document:
  account, progress, review, answers, marks, vocabulary, favourites, practice
  history and settings. Browser/SQLite state is only cache/outbox. The permitted
  divergences are the files in `apps/university/src/ports/` and nothing else:
  `GradingPort` (clipboard and the machine's AI host on one side, metered
  SwimmerAIKit on the other — ADR-0001) and `ContentPort`/`ReaderPort` (a
  loopback server reading the disk, or a published package).
- The disk stays the source of truth only for `apps/local/studies/` — registered
  private repositories and prose being written. It is not the learner-data
  source of truth.
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
  scene plus its authoring overlay. The standalone keyboard-complete 2D
  `CatalogSurface` is now shared by both shells; SPEC-0003 step 3 (retiring
  the authoring shelf from the landing) remains open because that is a product
  placement decision, not a reason to keep two catalog implementations.
- **One counter row.** Both shells call `universityCounters`; neither keeps its
  own idea of what belongs in it.
- **One remaining-count sentence.** The rail's `TodayCard` and the mobile
  `.nextup` overlay both call `todayMeta`; neither quotes the catalogue size.
- **Mermaid and external-link CSS.** The last `packages/ui` component styles
  that lived only in `apps/local` now live next to the component.
- **`courseShapeOf` in core.** The 2D catalog no longer imports "world" for a
  pure fold of lesson ids.
- **IdentityPort and ProgressPort.** Sign-in is optional and missing env is
  silent. Both shells bind the same cloud learner document when configured;
  browser/SQLite state is only cache/outbox. The adapter is wired and tested
  against a replaceable remote, but the SwimmerBackend owner still has to
  provision the real `university.progress` table and RLS.
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
- **One project, one scene.** `placeWorld` takes the project to show and puts it
  on the origin. Nothing else is in the scene, so the pan needs no fence. The
  vocabulary is 星球 / 课程系列 / 岛 / 单元 / 关 (v4 §05D).
- **An overlay reserves nothing.** The enter-course card is placed but does not
  push: opening it used to slide three neighbouring islands' names sideways.
- **One app** (was 10). `apps/university`, built twice from one tree. Was two
  apps whose difference set had shrunk to two ports while the drift rate had
  not moved. The delivery build's duplicate lesson reader is gone, one `View`
  parses one address for both, and four review-port factories are two. The
  count that made it the right time and the traps paid for are in
  [One App Handoff](./one-app-handoff.md).
- **ContentPort, and the duplicate reader deleted** (was 6). `ContentPort` and
  `ReaderPort` are where a lesson's text and its evidence come from; both live
  in `apps/university/src/ports/` beside `GradingPort`, and the directory is
  the complete list of what the two builds are allowed to disagree about.
- **The two learner features are out of `#/studio`** (was 12). 知识笔记 is the
  library's fifth collection in both builds — empty on the delivery side until
  11 ships notes with the package. 分级测验 is on the course island, asked only
  of a course with no progress, and `ROUTE_STARTS` is keyed by course id so a
  second course is data rather than a branch.
- **A stone under the rail is a stone nobody can click.** `frameCourse` aimed
  at a damped fraction of the absolute x four stones ahead; on a serpentine
  road that yawed the camera 15° and put 「开始」 at x=1115 of 1440, under the
  right-hand panel. The eye and the target share a lateral position now.

Next — **the order is set by
`docs/reference/player-journey/v4/index.html` §10, not by this list.** V4's
first item is ReaderPort, because until the delivery shell stops carrying its
own lesson reader every new feature has to be written twice.

1. **Provision the University learner row in SwimmerBackend** — *needs the
   owner.* Register the app, create a `university` schema that is neither
   `core` nor `public`, add one `progress` row per user with `document jsonb`
   and a guarded revision, scope RLS to `auth.uid()`, and verify a real sign-in
   from a real address. The browser adapter and fake-remote tests are ready;
   this external migration and staging rehearsal are the remaining authority
   boundary.
2. **The 19 seconds after the canvas mounts.** Of the 28.4s to first frame on
   throttled 4G, roughly 19 are `loadGraph()` fetching 52 course JSON files and
   the kit's GLBs. The JavaScript half is solved; this is data, and it is now
   the whole wait.
3. **SPEC-0003 step 3.** Decide whether to retire the authoring shelf from the
   world landing after every row in the overlay table is visible there. The
   separate course catalog is already shared; this remaining item is only
   about landing placement and authoring context.
4. **The light theme cannot work yet.** 270 raw colour literals are invisible
   to the contrast checker, which only reads token pairs. Until they are
   tokens, no amount of contrast fixing makes that theme usable.
5. **A persisted record of a wrong answer.** 错题本 (v3 16) has nothing to
   count: wrong picks live in component state and vanish with the question.
6. **Separate 「读完了」 from 「答对了」.** `progressSourceOf` still derives
   `exercisesPassed` from `progress >= 1`, which is a proxy and reads as a
   circular one from inside a lesson screen: the flag the settlement is about
   to write is the flag it is asking about. The lesson reader works around it
   by reading the two facts independently; the read model should stop needing
   the workaround.
7. Publish lane and entitlement (ADR-0002); Electron and Capacitor shells.
8. Payment and metered AI, after 1.
9. **A quiet label under the rail.** Inside a 41-lesson course, twelve lesson
   names project into the strip the nav rail covers. They are `quiet`, so
   nothing is drawn there — but a keyboard walk reveals them on focus, and the
   reveal lands under an opaque panel. `placeLabels` cannot help: quiet markers
   skip placement by design. The fix is either a clamp out of the chrome's box
   or a camera that keeps content out of it, and it is worth measuring which
   before writing either.
10. **The UA graph reaches the delivery build.** 「打开 UA 项目地图」 exists only
    in the authoring build because it opens the local Understand Anything graph
    and a customer has no checkout. The fix is the content pipeline, not the
    build: export the graph with the course package the way evidence and cards
    already travel. The same pipeline is what fills the library's fifth
    collection on the delivery side — it shows an empty state until notes ship
    with a package. Until then this reads as a build difference and is not one.
11. **The picker's globe is not beautiful yet.** Framing, sky, the crease pass
    and the sea's edge are fixed; the sphere itself still reads as a mossy
    marble rather than a world. `docs/reference/生图重绘ui/` holds the target.
    Art direction, and it waited for the merge so it is done once.
12. **A level and an XP curve.** `packages/core/progress/xp.ts` scores events
    but there is no level concept and no accumulated total, so the avatar has
    no ring to fill. What a level costs and how the curve bends is a product
    decision; the rendering is small once it exists.

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
