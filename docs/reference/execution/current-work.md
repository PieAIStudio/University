---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-27
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related:
  - ADR-0001
  - ADR-0006
  - ADR-0003
  - ADR-0004
  - ADR-0005
  - ADR-0007
  - REF-FEEDBACK-BACKEND-GAP
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
                 src/ports/        the only place the two builds differ:
                                  Grading, Content/Reader, SourceAccess
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

**53 courses · 150 units · 579 lessons** (577 unique ids — two ids are claimed
twice) · 1,815 `[[evidence:]]` markers resolving to **1,597 anchors** · 281
concepts (**138 carry a shared flow map**, 24 carry a style sample) · 267 terms
· 25 anti-patterns.

427 lesson-to-lesson links, 414 inside their own course and **13** crossing
courses: the mesh does not exist yet. `[[term:]]` links: zero.

Tests: core 378 · backend 1 · ui 274 · world 133 · university 143 · local 409 = **1,338**.
Plus 16 browser walks (`pnpm e2e`), two of which (`G`, `G2`) exist only to
compare the two builds against each other rather than to check either alone.

**Re-run the script before quoting any of these.** Every number on this page
has been wrong at least once.

## Known Content Faults

The old 4 / 2 note was an old output from a checker that still looked for the
removed `apps/online/content` tree. The source-based checker now reads each
study's latest lesson revision from disk and reuses the shared resolver. The
first real source run found 4 dangling links and **0** resolver-scoped duplicate
id groups. The four cross-course bare links were then revised through the
`apps/local` course workflow and exported into the recovery transport packages.

The current re-run reports:

- **0 dangling `[[lesson:]]` links**.
- **0 ambiguous duplicate lesson ids within a study/course**.
- Informational only: `fetch-not-clone` and `refuse-not-skip` each occur in two
  different `university-local` courses. Bare lesson ids resolve inside the
  current course, so these are legal scopes, not the old “first match wins”
  defect.

- **Lesson revision parity is now explicit.** Recovery exports carry each
  lesson's `latest.json.contentRevision`; the delivery course package and
  shelf preserve it, and `check-content-revisions` is part of `pnpm verify`.
  This intentionally changes read confirmation behavior: a confirmation is
  for the pinned lesson version, so republishing invalidates an older
  `readConfirmedRevision` while a confirmation for the current version remains
  valid.

The check exits `FAIL` for content faults, `PASS` for a clean source shelf, and
`SKIP` when a machine has no local studies shelf. It is now part of `pnpm
verify`; generated `apps/university/src/content/imported.json` remains outside
this report, but it is a tracked delivery manifest and is refreshed with the
recovery packages when source content changes.

## Standing Constraints

- Courses are authored only by the `apps/local` CLI and the files on disk. One
  producer, always. Publishing is a separate, gated act (ADR-0007).
- Both shells sign in to SwimmerBackend and share one cloud learner document:
  account, progress, review, answers, marks, vocabulary, favourites, practice
  history and settings. Browser/SQLite state is only cache/outbox. The
  permitted boundary differences are the files in
  `apps/university/src/ports/` and nothing else: `GradingPort` (clipboard and
  the machine's AI host on one side, metered SwimmerAIKit on the other —
  ADR-0001), `ContentPort`/`ReaderPort` (a loopback server reading the disk, or
  a published package), and `SourceAccessPort` (real checkout and UA actions
  locally, an explanation with a future desktop/manual/mobile path in
  delivery). Feedback is not a fourth one: both builds run the same ordered
  write path — the account backend first, the clipboard when it is absent or
  fails. The learner surface remains one implementation; an unavailable
  capability keeps its control and explains itself.
- The disk stays the source of truth only for `apps/local/studies/` — registered
  private repositories and prose being written. It is not the learner-data
  source of truth.
- Readable text is DOM, never geometry. Web3D baseline rule 7.
- 3D owns the map and the rituals. Reading, answering, reviewing, account and
  payment are 2D DOM through SwimmerUIKit.
- All model calls go through SwimmerAIKit, tiered cheapest-first: deterministic,
  then structured small model, then metered open tutoring.
- **The payload decides what may leave the machine, not the transport.** An
  English word the product itself chose is product material, so a browser's
  cloud voice may read it aloud. The learner's own writing, speech and private
  repository text are the learner's, and stay local by default. Learner speech
  input is a separate, still-open product decision and needs explicit opt-in;
  opening TTS never implies consent to it. Voice quality is four settings —
  自动 / 本机 / 在线 / 高品质 — stored in `preferences` like every other
  learner setting. 自动 is stored as a *request*, never as a resolved tier,
  and re-resolves premium → online → local on every use; storing the resolved
  value would strand a learner on the free tier the day they pay. 高品质
  renders disabled until the wallet exists, because a control that hides what
  paying buys is a pricing page that forgot to mention the price.
- Evidence is an opaque typed anchor rendered by a registered renderer. Adding
  a second kind is a new renderer, not a schema migration.
- Layout differs by CSS breakpoint inside one component tree. A second
  implementation is not a responsive layout.
- 3D avatars come from `@pieai/swimmer-avatar-kit`. Capability the kit lacks
  goes upstream, not into a University fork (ADR-0005).

## Design Before Build

`docs/reference/player-journey/v5/index.html` — **open it in a browser.** It
supersedes v1, v2, v3 and v4, and is an amendment rather than a rewrite:
anything v4 says that v5 does not contradict still stands. V5 adds the
read-versus-answer split, the 「讲一遍」 card, and the payload boundary for
TTS versus learner speech input.

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
  vocabulary is 星球 / 课程系列 / 岛 / 单元 / 关 (V5 §00, inherited from V4 §05D).
- **An overlay reserves nothing.** The enter-course card is placed but does not
  push: opening it used to slide three neighbouring islands' names sideways.
- **One app** (was 10). `apps/university`, built twice from one tree. Was two
  apps whose difference set had shrunk to three port boundaries while the drift
  rate had not moved. The delivery build's duplicate lesson reader is gone, one `View`
  parses one address for both, and four review-port factories are two. The
  count that made it the right time and the traps paid for are in
  [One App Handoff](./one-app-handoff.md).
- **ContentPort, and the duplicate reader deleted** (was 6). `ContentPort` and
  `ReaderPort` are where a lesson's text and its evidence come from; both live
  in `apps/university/src/ports/` beside `GradingPort` and `SourceAccessPort`,
  and the directory is the complete list of what the two builds are allowed to
  disagree about.
- **The two learner features are out of `#/studio`** (was 12). The existing
  知识笔记 stack remains an authoring content pipeline; the learner-facing
  feature is 「讲一遍」, a shared FSRS card described in V5. 分级测验 is on the
  course island, asked only of a course with no progress, and `ROUTE_STARTS` is
  keyed by course id so a second course is data rather than a branch.
- **One course island, two slots.** The panel was written out twice in
  `App.tsx` and the wide copy had grown a 分级测验 the narrow one never got, so
  the question 「我该从哪一关开始」 did not exist on a phone. `CourseIsland` is
  one component now; `wide` chooses the slot and nothing else.
- **On a phone the way out was under the tab bar.** `.picked` capped itself at
  `100dvh - 28px` — measured from the window, while the panel is positioned
  from the top of `.stagewrap` — so the cap computed larger than the panel and
  never bound. The exit is sticky and the bar publishes `--tab-bar-height`.
  The e2e assertion is `humanClick`, because the first one measured a bounding
  box and passed while the button was unreachable.
- **错题本, out of a fold rather than a migration.** See 5 below: the data was
  already there and already syncing.
- **The delivery package still ships no answers.** Adding 错题本 put
  `referenceAnswer` back into every course package and rewrote the comment
  explaining why answers are stripped. A read model dropping a field does not
  unsend the bytes. `correctAnswer` is nullable now and delivery says so;
  `no-answers-shipped.test.ts` checks the bytes, and its own first draft used
  `[^a-z]` as a word boundary and passed on `referenceAnswer`.
- **24 design styles are visible, not described.** One fixed mockup, 24 CSS
  skins, the CSS Zen Garden model — the constant is the product and the only
  variable is the style, which is what a page-per-style cannot teach. The DOM
  is identical for every skin; a skin that needs an extra element means the
  contract is wrong.
- **One `depthsFromPrerequisites`.** It existed byte-identically in
  `packages/world` and `apps/university/src/content/library.ts`. It is a pure
  fold, so it lives in `packages/core` for the same reason `courseShapeOf`
  does, and the 2D catalogue no longer reaches for the scene to get it.
- **A stone under the rail is a stone nobody can click.** `frameCourse` aimed
  at a damped fraction of the absolute x four stones ahead; on a serpentine
  road that yawed the camera 15° and put 「开始」 at x=1115 of 1440, under the
  right-hand panel. The eye and the target share a lateral position now.
- **Learner surface parity for repository access.** `SourceAccessPort` is the
  third boundary: authoring performs checkout, UA-map and layer-coverage
  actions; delivery keeps the same controls and explains the published-package
  boundary plus future desktop/manual/mobile support. `G` and `G2` now compare
  the world and lesson learner-control inventories, including a one-sided
  injection proof.

Next — **the order is set by
`docs/reference/player-journey/v5/index.html` §05, not by this list.** The
ReaderPort and duplicate-reader work from the earlier journey is already done;
the list below contains the remaining implementation and authority boundaries.

1. **Provision the University learner row in SwimmerBackend** — *needs the
   owner.* The executable SQL, env wiring, XP storage decision, four real-browser
   acceptance paths, and rollback are the single handoff in
   [SwimmerBackend learner progress migration](./swimmer-backend-migration.md);
   its only SQL source is [the adjacent migration file](./swimmer-backend-migration.sql).
   The browser adapter and fake-remote tests are ready; owner execution and the
   staging rehearsal remain open.
2. ~~**The 19 seconds after the canvas mounts.**~~ **Measured, and it is
   gone.** The old entry said 28.4s to first frame on throttled 4G, of which
   ~19s was `loadGraph()` fetching 52 course JSON files. `loadGraph` no longer
   exists — the generated shelf replaced that walk — so the number was quoting
   a function with no callers.

   Re-measured against `dist/delivery` on a static server, headless Chrome,
   time from navigation to the 「开始学习」 button being visible:

   | | domcontentloaded | 「开始学习」 visible | requests | transferred |
   | --- | ---: | ---: | ---: | ---: |
   | unthrottled | 218ms | **328ms** | 15 | 1.33 MB |
   | fast 4G, 9 Mbps / 60ms | 2,474ms | **2,966ms** | 18 | 2.59 MB |

   Two honest caveats. The static server sends **no compression**, so those
   bytes are the worst case a real host would serve. And this measures the DOM
   call to action, not the scene fully populated — headless has no GPU and the
   canvas never sizes, so a 3D first-frame number still needs a real display.
   What it does establish is that **a learner can start learning in about three
   seconds on 4G**, and that optimising this next would be optimising the wrong
   thing. Re-measure before anyone reopens it.
3. **SPEC-0003 step 3.** Decide whether to retire the authoring shelf from the
   world landing after every row in the overlay table is visible there. The
   separate course catalog is already shared; this remaining item is only
   about landing placement and authoring context.
4. **The light theme cannot work yet — but it needs far less than it looked
   like.** Surveyed 2026-08-26 across the nine files R3 left: 359 raw colour
   literals, of which **322 map onto tokens the kit already defines**, 8 need a
   genuinely new role, and 29 are fixed material that should stay fixed. The
   light palette is not missing: `swimmer-ui-kit`'s `:root` *is* the light
   theme and `night` only overrides it, so 78 of its 143 `--game-ui-*` names
   already carry a colour. What blocks the theme is the application layer
   writing colours instead of reading them.

   **117 of the 359 are fallbacks inside `var(--token, fallback)`** — and the
   fallback values are a dead cool-blue palette (`#0d1019`, `#151b2b`,
   `#9aa6bb`, `#5ec8c0`) from before the kit went warm. They never render,
   because the kit stylesheet always loads first; only the contrast checker
   sees them. Deleting them is a third of the problem removed with no visual
   change, and it dissolves four of the ten colour-drift groups outright.

   **Decided (2026-08-26): fixed material gets an explicit registry, not an
   exemption by category.** The checker counts `var(--x, fallback)` fallbacks
   as raw colours, so "leave the 29 alone" and "the checker only accepts
   tokens" cannot both hold. Each fixed colour — brand marks, the GitHub-like
   code reading surfaces — goes in a registry with one line saying why, the
   checker reads the registry, and anything outside it is red. Same shape as
   `scripts/check-canvas-registry.mjs`: a rule that is counted survives a
   refactor.

   The acceptance test is **not** "zero literals". It is "every colour that
   must change with the theme is a token". Naming is by role
   (`--surface-raised`), never by value (`--blue-500`) — a value name still
   has to be blue in the light theme, which defeats the point. The survey is
   `scratchpad/r5-report.md`; `packages/ui/src/entry/style-sample.css` is out
   of scope, because each skin there is a closed world that deliberately does
   not follow the theme.

   **And the remaining 213 are not engineering work.** Attempted 2026-08-26 and
   stopped as a verified no-op: of the 205 that the survey called class A —
   "a purpose the existing vocabulary can express" — **not one is byte-equal to
   the kit token that expresses it**, normalised on RGB and alpha. The
   classification was semantic, not numeric. This repository's stylesheet was
   written against its own warm palette and the kit later shipped a different
   warm palette, so pointing a rule at the kit's token changes the colour that
   renders. That is a design change wearing a refactor's clothes, and it is
   the same trap in the small that the whole programme avoided in the large.

   So what is left is a decision, not a migration: for each of the ten drift
   groups in `r5-report.md §3.2`, either the application adopts the kit's
   value (visible colour change, needs somebody to look at it) or the kit
   publishes a paired token at the application's value (brand-kit-first, so it
   goes upstream rather than forking a palette here). The eight class-B roles
   the kit has no name for — scrollbar thumb/track, idle status surface, prose
   code ink and surface — are already written up as upstream proposals in
   `r5-report.md §4`, with dark values, suggested light values and a reason
   each. **Nobody should touch the 213 until that choice is made**, and the
   ratchet holds the line meanwhile.
5. ~~**A persisted record of a wrong answer.**~~ **Done, and the premise was
   already wrong.** Failed attempts had been persisted and cloud-merged all
   along — `ExerciseAttemptRecord` carries the answer, the score and the
   revision, and all four grading call sites wrote them. Nothing *read* the
   failed ones, so the feature read as unbuilt when it was unsurfaced. 错题本
   is `#/mistakes`, a pure fold over the document with no new storage.
6. ~~**Separate 「读完了」 from 「答对了」.**~~ **Done.** The shared
   `ProgressSource` now receives the current revision and exercise ids:
   `exercisesPassed` comes from current-version passing attempts, while
   `readConfirmed` comes from the explicit current-version reading action.
   The lesson reader, settlement, map/catalog and 「今天」 all consume that
   answer. A current row with aggregate `progress = 1` but no current exercise
   passes remains in progress until both lights are on; pre-migration rows with
   no `readConfirmed` field keep their compatibility finish.
7. ~~**A publish lane that reproduces from a clean clone.**~~ **Done.**
   `pnpm delivery:build` takes an explicit recovery root, lexicon, evidence mode
   and version, then seals `release.json` plus `SHA256SUMS` under a versioned
   artifact directory. Vercel calls the same package-only lane while its Git
   deployment gate remains off. Details and clean-clone evidence live in
   [Delivery Publish Lane](./publish-lane.md).
8. ~~**Entitlement, and it starts by splitting one word in two.** 「published」
   and 「paid for」 are different questions and the code currently answers them
   with one. V5 keeps the prose open, so entitlement governs AI and sync only —
   but a learner should still only ever read a *published* revision. ADR-0002
   says course packages are served from the backend under entitlement; they
   are in fact public static files on Vercel. One of those two has to change,
   and which one is a decision, not an oversight.~~ **Entitlement skeleton
   landed (2026-08-26).** ADR-0007 supersedes ADR-0002: publication remains the
   content gate, the published delivery package is public static output, and
   `readEntitlements` governs AI and sync only. The shared billing config has a
   free baseline; paid tiers and prices remain unfilled.
9. **Payment, browser side complete (2026-08-26).** Payment is not a fourth
   mode boundary: it does not answer where AI, material, or repository access
   comes from. The shared `PaymentPort` reads the wallet/entitlement, generates
   and coalesces browser order ids, requests and queries channel-neutral orders,
   and refreshes entitlement after success. `PlansScreen` keeps the purchase
   control visible with a “待产品确认” placeholder and explains the missing
   server channel when clicked. Actual money-in remains a SwimmerBackend gap —
   shared order/webhook/atomic-settlement machinery, domestic and overseas
   adapters, and server-side `wallet_grant`; see [Payment Backend Gap](./payment-backend-gap.md).
   It is after 1 because taking money needs an account first.
10. **Metered AI grading, after 9.** **Local path implemented (2026-08-26); the
    launch gate remains.** `apps/university-grading` is the independent
    server-only Vercel function: the same `GradingPort` keeps tier-1 free and
    sends only `undecided` answers through JWT verification, wallet
    reserve/commit/refund, and structured SwimmerAIKit grading. Deployment,
    environment variables, wallet top-up/payment, and product pricing still
    belong to the release step; no model call has been made from this branch.
11. ~~**A quiet label under the rail.**~~ **Measured and fixed (2026-08-26).**
   In the 41-lesson course, the baseline sweep counted projected quiet labels
   under the rail at 768×900: 12; 1024×768: 6; 1280×720: 8; 1440×810: 4;
   1440×900: 7; and 1920×1080: 2. Mobile widths hide the rail. A direct
   boundary clamp would have caused five visible-label conflicts and seven
   quiet-pair conflicts among the twelve narrow-viewport labels; the
   collision-aware clamp resolved all twelve. The camera was rejected: at the
   allowed maximum distance it still left 12 under the rail, while the target
   shift that cleared the narrow rail put 27 under the right panel. `LabelProbe`
   now measures the rail box and moves quiet focus reveals outside it through
   `--placed`; `placeLabels` still intentionally excludes quiet markers.
12. **「讲一遍」与语音边界。** 当前决定（读完 / 答对分开、学习者复述进
    FSRS、TTS 四档）和仍开放的边界（ASR 必须单独选择加入）只写在
    [V5 用户旅程](../player-journey/v5/index.html) §01–04；这里不再复制一份。

13. ~~**The picker's globe is not beautiful yet.**~~ **Done, in four rounds.**
    Framing, flat shading, a warm key with a rim, stars and a horizon glow,
    and study markers that are landing beacons — a coloured pin standing on a
    lit contact disc, matched to a swatch on its row in the list, so the point
    on the globe and the row in the panel are visibly the same thing.

    The terrain reads as a world rather than a beach ball because the colour is
    quantised into **regions**, not per face. Randomness has a scale: per-face
    random is noise, region-random is terrain. The final split is measured on
    the sphere, not eyeballed — sea 40.05%, land 40.22%, sand 19.74%.

    The process is the reusable part. Rounds 1–3 each fixed the named problem
    and broke the colour balance, because the direction given was **relative**
    (「暖一点」, 「成片一点」) and a relative direction overshoots by
    construction. Round 4 gave absolute proportions and hex values and landed
    first try. Give an absolute when you have one.
14. ~~**A level and an XP curve.**~~ **Done, except the ring.**
    `totalXpForLevel(n) = round(35 * (n - 1) ** 2.2)`, and the two constants
    are anchored rather than chosen: one lesson is `XP_READ_LESSON +
    XP_EXERCISE_FIRST_TRY`, which clears level 2 — **the first lesson levels
    you up** — and reading the whole library once lands at level 20, leaving
    the rest of the curve to spaced review, which is what `xp.ts` pays for.
    Both anchors are tests computed from the constants and the real lesson
    count, so changing a score or adding courses fails the suite.

    No ring around the avatar: `@pieai/swimmer-avatar-kit` has no progress-ring
    capability and ADR-0005 says a missing capability goes upstream rather than
    into a fork here. It is a `Lv. N` badge and a linear bar, which is what
    `docs/reference/生图重绘ui/` draws anyway. **The ring is the open upstream
    request**, not an open item here.

15. **Review reminders, browser side complete (2026-08-27).** The shared
    settlement shows the real next-day card count only after a fresh lesson
    completion; the plain-language in-app prompt precedes the browser permission
    request, and only “好” reaches `Notification.requestPermission()`. Settings
    keeps the current permission/capability state, never re-asks after denial,
    and honestly says that an active subscription will not deliver until the
    server sender exists. The worker has no fetch/cache handler and is registered
    only after opt-in. Endpoint-keyed subscriptions, revoke tombstones and old
    document parsing live in the existing progress document; the sender,
    scheduler, VAPID secret and cleanup remain a SwimmerBackend gap — see
    [Review Reminders Backend Gap](./review-reminders-backend-gap.md).

16. **Feedback loop, browser framework complete (2026-08-27).** One learner
   control, one allowlisted context — lesson locator, content revision,
   current-lesson exercise-attempt count, login state, route and viewport — and
   one ordered write path shared by both builds: the account backend first, the
   clipboard when it is absent or fails, and an explicit failure that keeps the
   learner's words in the box when neither works. The three outcomes read
   differently on purpose; a copied note never wears a checkmark that claims it
   was received. `#/studio` groups real feedback by course and content revision
   and has a separate owner-only answer-aggregate interface beside it; missing
   feedback or answer data has an explicit capability/empty state.
   Deterministic grouping is complete; the destination table itself, the
   backend answer aggregate, offline fixed categories and any course edit
   remain future work. The SQL, owner RLS and hand-off sequence are in
   [Feedback Backend Gap](./feedback-backend-gap.md).

## Refactor Program

Structural work is a program, not a change. The audit behind it, the evidence
for each finding, and the order with its dependencies are in the artifact
published 2026-08-26; the order is repeated here because the order *is* the
argument:

| | | 状态 |
| --- | --- | --- |
| R0 | Delete dead code | **done** |
| R1 | Narrow the export surface | **done** |
| R2 | `packages/world/src`, 47 direct children into directories | **done** — 47 → 10 |
| R3 | Shared components' CSS back beside the components | **done** — 8 families, 830 lines |
| R4 | Split `App.tsx` | **done** — 1,384 → 757, six files |
| R5 | 359 colour literals into tokens | **done** — 8 left, and those are upstream kit proposals |

R4 is last because the first four are its safety net, not because it matters
least: it is the highest-churn file in the repository and the one where
`pnpm verify` has been proven unable to catch a fault. **Every step of R4 runs
`pnpm e2e`.** R5 depends on R3 — replacing literals while `styles.css` is
still one 4,896-line file is paving a moving road.

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
- **`cond ? { thing } : null` inside JSX is an object literal, not a child.**
  Hoisting `<TodaySection>` into a `const` and dropping `{todaySection}` into
  `{showMap ? … : null}` produced `{showMap ? { todaySection } : null}`. The
  brace was already open, so the second one built an object — and React threw
  「Objects are not valid as a React child」 on **every** screen. `pnpm verify`
  was green: typecheck, lint and 120 unit tests all passed, because nothing in
  the unit suite renders `App`. All 15 browser walks failed. This is the whole
  argument for keeping `pnpm e2e` outside `verify` and running it anyway.
- **Two files claiming the same class name is not automatically a bug.**
  `margin-note` had a full duplicate rule set in `lesson-reader.css`, predating
  the move; diffed selector by selector, every declaration was byte-identical
  to the moved copy. Cascade order cannot change a computed style when both
  candidates resolve to the same value — so the two rules should still be
  collapsed into one (still open, low priority), but they were never a source
  of drift.
- **A moved file's asset imports are invisible to typecheck.** Grouping
  `packages/world/src` into directories left three GLB imports in
  `island/generated-landmark.tsx` pointing at the old relative path.
  `tsc` does not resolve `.glb`, so typecheck, lint and 131 world tests were
  all green; only `pnpm build` failed. Same family as the `exports` trap above
  — the build is the only step that resolves what the bundler resolves.
- **A worktree without the study checkouts fails in a way that looks like
  broken code.** `apps/local/studies/` is gitignored, so a new worktree does
  not have it, and `mkwt.sh` links it in for a reason. Without it: four `pnpm
  e2e` walks fail on the authoring side with an empty shelf — which reads as a
  regression in whatever you just changed — and `pnpm content` silently bakes
  no evidence, so `imported.json`'s `servedBytes` come out kilobytes short.
  Both happened on 2026-08-26, the second one for the second time (`e04bcfa`
  fixed it once and recorded it only in the commit message). Check the symlink
  before believing an authoring-side e2e failure or any `servedBytes` number.

  **And the obvious way to link them does not work.** Per-study symlinks —
  `studies/buzz -> …/studies/buzz` — are invisible to the shelf, because
  `inspectStudyShelf` skips on `entry.isDirectory()`
  (`apps/local/server/studies/repository.ts:157`) and a `Dirent` for a symlink
  answers that with `false`. What works is linking the directory itself, as
  `studies/studies -> …/apps/local/studies`, so the root resolves through
  `realpath` to a place whose children are real directories. Measured both
  ways against `e2e/D.local-authoring.spec.ts`: per-study fails at 31s, the
  directory link passes at 4s.
- **A gate that walks the repository walks into the study checkouts too.**
  `check-canvas-registry.mjs` reported ten `<Canvas>` mounts belonging to a
  learner's own cloned repository. It passed everywhere it was written and
  tested, because those machines had no studies registered. Any new source
  scan needs `apps/local/studies` excluded.
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
