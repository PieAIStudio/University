---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-18
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related: []
---

# Current Work

This is the short, current handoff for an AI or human opening the repository.
It is not a task diary.

## Current Focus

One repository, two shells, one shared learning surface.

```
apps/local      authoring — filesystem, CLI, single machine   (9999)
apps/online     delivery  — 3D archipelago, progress, review  (9998)
packages/core   the domain model. No React, no fs, no network.
packages/ui     the reader, evidence, review, markdown,语言层
```

`pnpm content && pnpm dev` runs the online shell; `pnpm --filter
@pieai/university-local dev` runs the authoring one. Both read the same
lessons and now render them with the same component.

The old rule list is retired. Two remain, and the rest of AGENTS.md derives
from them: **share the code**, and **keep the architecture efficient, clear,
modular, robust and legible to both a person and an AI.** The online shell is
no longer forbidden from authoring courses — when it authors, it will run the
same workflows the local shell runs.

## Where V3 Left Off, 2026-08-22

**Read `docs/reference/player-journey/v3/index.html` before touching any
learner-facing surface.** It supersedes v1 and v2. It is one document with a
mobile/web switcher rather than two, because two documents describing one
product drift, which is what SPEC-0001 exists to prevent.

The instruction behind v3 is worth stating plainly, because it changes what
"good" means here: **take Duolingo's structure wholesale and put our content
in it.** Not because imitation is safe, but because that structure has been
tested on hundreds of millions of learners and we have neither the traffic nor
the time to rediscover it. Slot count, slot position, and flow are copied. What
sits in each slot is ours.

Both recordings the design is built on live in
`docs/reference/借鉴的App/` — phone and desktop — and are taken apart screen by
screen in `duolingo-teardown/index.html`, with 33 frames and stable ids. v3
cites those ids (`C5`, `E1`, `W2`), so the two documents can be read together.
The source videos are gitignored; the frames and the analysis are not.

### What Is Settled

- **3D keeps the stage and changes lens.** The archipelago read from 50° above
  is a skill tree in three dimensions, and Duolingo's stated reason for
  demolishing its own was that learners could not tell whether they were using
  it correctly. The road view — one next step, the rest receding — is now the
  default inside a course. The overview survives as the zoomed-out level.
- **The islands move from sea to sky.** OwnMySpace already established the
  visual language: a floating platform above an ocean planet, cloud layer,
  blurred ground far below. Two products sharing one world is worth more than
  either art direction alone, and water is flat, so the sea gave the frame
  nothing to make depth out of.
- **The authoring shell stays offline.** Four ports — content, progress,
  grading, evidence — and everything above them is one implementation.
  SwimmerBackend is built on the delivery side only.
- **Mesh learning, bounded.** Spine, spur, inline reference. Spurs render only
  within one node of the current position, three per node, so what is on screen
  is bounded by a constant however much content exists.

### What Is Open

- `SPEC-0001:141` forbids the shared package from owning 3D; `SPEC-0003:122`
  says move the scene into `packages/ui`, which is the shared package. Two
  canonical specs, one contradiction. A separate `packages/world` satisfies
  both and needs SPEC-0003's first step reworded.
- `buzz`'s five courses have no prerequisites and no defensible order beyond
  `buzz-orientation` going first. That is an authoring decision.
- Shipping through the app stores costs thirty per cent of digital sales. Web
  and desktop do not. That is a pricing decision, not a technical one.
- 32 `[[lesson:]]` links point at lesson ids that do not exist.

### Corrections To Numbers Previously Reported Here

**560 lessons** — the count a learner walks through, and the one the app shows.
There are 558 *unique* ids among them, because two ids are claimed twice; both
figures get quoted and they count different things. `[[evidence:]]` markers
number 1,815 and resolve to 1,597 anchors, same kind of distinction. Of 420
lesson-to-lesson links, 383 stay inside their own course and **five** cross one,
so the mesh that a reader of earlier notes might expect does not exist yet.

`apps/local/scripts/check-lesson-links.mjs` reports the two content faults that
fall out of this: **four** dangling links, and **two duplicated lesson ids**
(`fetch-not-clone`, `refuse-not-skip`, both in `university-local`). An earlier
note here said thirty-two dangling links; that was a parsing mistake on my part
— those thirty-two are full-path `[[lesson:course/unit/lesson]]` tokens and they
resolve. The duplicates are the more interesting fault, because nothing fails:
the token resolves, to whichever lesson the lookup reaches first.


## Order Of Work

Phases 0 to 6 are done. Phase 7 is the current work.

0. **Clear the supply line.** Done. See "What happened on 2026-08-18".
1. **SwimmerUIKit paperwork.** Done — the PGS 0.9.1 delivery is committed and
   pushed. No release: no `src/` change.
2. **Dependencies tell the truth.** Done. `@pieai/swimmer-ui-kit` is a
   dependency because the 2D surfaces will be built from it. `three` and its
   types are devDependencies, because the only thing that will use them this
   phase is a design-time greybox under `docs/`. `@react-three/fiber` was
   removed: it is the product-runtime choice, no `<Canvas>` exists, and the
   Web3D baseline rules that a `<Canvas>` triggers are still registered as
   `scheduled-migration` exceptions. Adding it back takes ten seconds when a
   real scene needs it.
3. **User journey V2.** Written, at `docs/reference/player-journey/v2/index.html`.
   28 acts, six corrections to V1 that the measurements forced, nine decision
   cards, and **all nine screens built and runnable**. Open the index first; it
   links the rest, and `build-brief.html` holds the per-screen spec that was
   used to hand two of them to subagents.

   Two artefact kinds, deliberately not mixed:
   - 3D surfaces are **runnable greyboxes**, not static pictures. Camera
     movement, drill-down and "can I find my next lesson in 8 seconds" cannot
     be judged from an image. Greyboxes stay grey plus one accent colour, and
     they fix composition, hierarchy, camera and reachability only — never
     material, lighting, colour or model fidelity.
   - 2D surfaces are **static wireframes** that consume SwimmerUIKit's real
     tokens. They fix information hierarchy, block order, wording and the
     empty/loading/error states. They do not invent a visual language.
   - Every screen carries a testable acceptance sentence. A screen without one
     does not enter V2.
   - Every screen is rendered with real data from the exported packages. The
     reader wireframe uses one real lesson's full markdown, because that is
     the screen the product's advantage lives on.
4. **Vertical slice.** Done, and it is the app. `pnpm content` splits recovery
   packages into per-course lesson JSON plus content-addressed assets — the
   6.6 MB course now serves 0.34 MB, because its 6.1 MB of inline screenshots
   became five files that load only when their lesson is open. The first
   `<Canvas>` landed with it, satisfying baseline rules 1-5, and the portfolio
   manifest's exceptions for those five were withdrawn in the same change.
   Rule 8 stays: there is still no mobile or desktop shell.

   What a learner can do today: open the world map, see the study they are in
   and exactly one accented "next", drill into a course, read a real lesson
   with its evidence anchors, answer, be graded at tier one for free, get a
   clue rather than a verdict on a miss, drop cards, and find them due
   tomorrow. Progress is local; accounts and payment arrive with the paywall.

   Known rough edges, none of them structural: lesson labels overlap at the
   bottom of a long course map, tier two is not wired so a prose answer says
   so honestly instead of guessing, and there is no settlement screen — the
   lesson simply ends.
5. **Art direction.** Done for the world map. The greybox was right for a
   design artefact and wrong for a product a stranger judges in eight
   seconds, so the map is now a low-poly archipelago built from the WOC
   donor's CC0 packs. `pnpm kit` imports it.

   Three things are settled here and should not be relitigated casually:
   - **Only CC0 ships.** The donor's media splits three ways and two of them
     are unusable in a paid product: `@jamiecypher`'s sound effects are
     CC BY-NC with a commercial grant that runs to that project and does not
     transfer, and the soundtrack is "with the project only". The register is
     compiled into `apps/online/scripts/woc-licenses.json` and the import enforces it.
     donors.md granted this product WOC's *audio unlock* — a code pattern,
     now shared by both shells at `packages/ui/src/sound/sound.ts` — never its
     sounds. See "Audio Ships" below for what the product actually plays.
   - **Islands are generated, not modelled.** 1 to 41 lessons cannot be one
     mesh. Seeded from `courseId`, so an upstream typo fix cannot rearrange
     a learner's world.
   - **The kit is repainted on load** from a table in `apps/online/src/world/kit.tsx`, keyed by the
     material names the artists wrote. Four CC0 packs by four authors have
     four palettes; the table is how they become one place, and it puts art
     direction in a file that can be argued with.

   The world says one sentence: an island shows how far its course got.
   Nature is there from the first visit; the settlement is what progress
   owns; one beacon burns on the single next course.
6. **Upstream changes.** The first one is done, and it is the one V2 named
   rather than one that was guessed. Building the placement screen exposed a
   course-id prefix match in this repository — a second, unwritten copy of the
   course structure, exactly what SPEC-0001 forbids. The fix went upstream:
   `CourseManifest.trackId` lets an author say which named path a course is
   on, `course set-track` sets it, the recovery export carries it, and the
   nine foundations courses now claim `foundations`. The screen behaves
   identically and no longer guesses. Still queued:
   - `CourseRouteQuiz` becomes course data instead of a hardcoded component
     (see "Route" below). Its questions and entry points are still hardcoded
     in the wireframe; `trackId` gives them somewhere to live, but where
     authored questions belong in the content model is a decision the real
     placement flow should force, not a wireframe.
   - The map needed no new field: depth is derived and prerequisites exist.
   - The prediction line differs between the 41 revised lessons and the 519
     unrevised ones. Two voices in one library is a launch-blocking content
     task, not an engineering one.
   - An image size budget for lesson screenshots.

7. **One repository.** Done. `git subtree` brought UniversityLocal in as
   `apps/local` with its history intact — 133 commits across both lineages —
   and 6,400 lines of its UI moved into `packages/core` and `packages/ui`.
   534 tests before, 534 after, redistributed with the code they test.

   The split fell out of the code rather than being imposed: `domain/` went to
   core because the local *server* imports it too, and a thing both a React
   tree and a Node process need is not a UI concern. `api/client.ts` went to
   ui because it builds URLs and unwraps responses and does no fetching — a
   contract, not an implementation.

   The online shell now reads lessons through the shared `MarkdownContent`,
   which is where its Mermaid, Shiki, authoring directives and lesson images
   came from. None of it was written twice.

   Two traps recorded so the next session does not re-find them:
   - `packages/core` must emit real JavaScript, because `apps/local`'s server
     is a Node process and Node cannot import a `.ts` from a workspace package
     the way Vite can. Its `exports` is `"./*": "./dist/*"` with no extension
     appended; a `"./dist/*.d.ts"` pattern turns `schemas.js` into a lookup for
     `schemas.js.d.ts` and reports as "cannot find module".
   - Type packages are workspace infrastructure, not an app's private
     dependency. `@types/three` living inside an app made every `<mesh>` in the
     3D code fail to typecheck, because `.pnpm` packages resolve `three` by
     walking up to the root. `publicHoistPattern` is the fix.

8. **One scheduler, one answer key.** Done. `packages/core` owns FSRS with
   recorded parameters, and both shells call it — the online shell's
   interval-doubling placeholder is gone, and the third hand-written copy of
   the parameters in the vocabulary store is gone with it.

   Tier-one grading moved to core in the same change, and that closed a leak
   worth naming: the online shell was serving `expectedAnswer` inside its
   lesson JSON, so every answer in a paid product sat in plain text one network
   tab away before the learner had typed anything. The authoring shell had this
   right — it discloses a reference answer only after repeated attempts or a
   pass. Import now compiles 673 answers to fingerprints and strips the
   originals.

   Found by a Grok audit run against the merged tree, then verified by hand
   rather than taken on trust — one of its three headline claims pointed at the
   wrong line while reaching the right conclusion.

## What Happened On 2026-08-18

Recorded because it changes what the next session can assume.

- **The export was stale and nothing reported it.** A 41-lesson rewrite landed
  in UniversityLocal at 13:59 while `course-proposals/recovery/` still held the
  previous afternoon's bytes. Because lesson prose lives under an ignored
  `studies/`, a stale export is both a wrong answer to this product and a
  missing backup of the authoring work. Re-exporting all four studies changed
  exactly one file; the other 51 courses serialised byte-identically, which
  demonstrates the format's determinism for the first time.
- **UniversityLocal now fails its own build when the export drifts.**
  `scripts/check-export-freshness.mjs` re-exports into a temporary directory
  and asks the real exporter whether running it would change anything. It
  skips cleanly where no campus is on disk.
- **A course package is 6.8 MB, of which 6.1 MB is four base64 screenshots**,
  the largest 2.86 MB. Self-contained packages are right for transport and
  wrong for runtime. Import must lift assets out into separately addressed
  files that load lazily; a learner must never parse 6.8 MB of JSON to read
  one lesson.
- **`StudyMap` upstream is not a competitor to this product's world map.** It
  crosses Understand Anything's layers with the files courses cite, to answer
  "what has no lesson gone near". It is an authoring tool.
- **Placement lives in a React component upstream**, with its questions and
  entry lesson hardcoded for one course, which makes it invisible to the
  export. That is the drift SPEC-0001 exists to prevent, appearing on day one.

## Route: The Requirement To Design Against

Recorded now, implemented in phase 5.

- Placement applies to a **whole course series**, never a single course.
- The learner answers once. The answer is **persisted** and is never asked
  again unasked.
- A panel shows the answer, where it placed them, and offers a correction.
- Difficulty later adapts to real progress.

Two of those fight each other and the design must resolve it rather than ship
both: once real performance exists it outranks a self-assessment, so the panel
shows "you said X, we are seeing Y" and its button is a manual override, not a
second guess. Note also that FSRS is already the difficulty controller at card
level; a course-level control that tries to be a second one will fight it. What
a course-level control can honestly move is starting point, skip granularity
and review intensity — not question difficulty, because the questions are
imported and fixed.

## Map: Settled By Measurement

Measured across the 52 exported courses, so the map is designed against what
exists rather than against a sketch.

- The four studies have four different shapes: flat with no order (buzz), a
  strict chain (supaluv), a chain with a fan (university-local), and a tree 14
  levels deep (turing-pact). The map must render all four honestly. A flat
  world is information, not a defect to be papered over with invented order.
- Course size runs 1 to 41 lessons, median 12. **The map tolerates uneven
  content rather than requiring content to be regularised first.** An island's
  size derives from lesson count.
- 93 of 146 units hold exactly 4 lessons. Unit is the rhythm, not a map level.
- Two map levels: study/course DAG, then a course's units as a path of lesson
  nodes.
- **Layout is derived, never hand-placed.** A hand-placed map is a second copy
  of the course structure living in this repository, which is exactly the drift
  SPEC-0001 forbids. Seed positions from stable ids — `courseId`, `studyId` —
  and not from the package hash: a deterministic layout keyed to content would
  rearrange a learner's whole world because an author fixed a typo. Determinism
  and stability are different properties and the map needs both.

## Standing Constraints

- Courses are imported from UniversityLocal, never authored here. See SPEC-0001.
- UniversityLocal is never given an uploader, a sync client, or any awareness
  that this product exists. Course taxonomy and authoring changes there are
  ordinary authoring work; a push lane is not.
- 3D owns the map and the rituals. Reading, answering, reviewing, account and
  payment are 2D DOM through SwimmerUIKit.
- All model calls go through SwimmerAIKit, tiered cheapest-first.
- Evidence is read as an opaque typed anchor rendered by a registered renderer.
  Only one kind exists today and no second kind is built. The point is that
  adding one later is a new renderer rather than a schema migration.
- The first `<Canvas>` commit must satisfy Web3D capability baseline rules 1-5
  and withdraw the matching `scheduled-migration` exceptions from the portfolio
  manifest in the same change. A greybox under `docs/` is not that commit.

## Audio Ships, And The Blocker Was The Wrong Shape

This section used to say audio was blocked on licensing. That was true of the
approach it assumed — hunt CC0 recordings, host them, keep an attribution
ledger — and every problem it listed was real: WOC's sound effects are
CC BY-NC with a commercial grant that runs to that project and does not
transfer, Freesound redirects a download to a login page, and Kenney's files
sit behind an interactive form. A script cannot fetch either.

The blocker dissolved when the assumption did. `uisfx` (npm, MIT code, CC0
audio, `LICENSE-AUDIO` carries the SPDX identifier) **synthesises every cue
from a deterministic recipe at runtime**. There is no file to download, host,
or credit, and no attribution ledger to keep in sync. The runtime is 12.35 kB
gzipped with no dependencies; the package's 12 MB of pre-rendered MP3/Ogg is
for native and game engines and is not imported here, so the shipped cost of
sound in this product is the runtime and nothing else.

It also disposes of the MP3 seam problem recorded below: a synthesised loop has
no container, so it has no encoder padding.

| Decision | What was chosen, and why |
| --- | --- |
| Engine | `uisfx`, not WOC's. WOC's `sfx.ts` is 1,852 lines of MMO spatial audio — footsteps by ground material, mount engines, rift ambience, a 24-voice pool. University needs fifteen UI cues. |
| Pack | `zen`, one of twelve. Its own brief is "mindfulness, reading, writing, calm productivity". This is a reading surface someone sits with for twenty minutes. |
| Unlock | Still WOC's, and it is the one thing taken from that donor. donors.md grants University WOC's *audio unlock* — a code pattern — and never its sounds. |

**One context, not two.** The latch used to construct its own `AudioContext`
and `uisfx` constructs one lazily as well. Two contexts is a wasted hardware
voice on mobile and a browser limit waiting to be hit, so the latch was rewritten
to own the *timing* rather than the context: `packages/ui/src/sound/sound.ts`.

Verified in a browser rather than argued: **zero** `AudioContext` instances
exist before the first gesture, one exists and reports `running` immediately
after it, and with sound muted a graded answer produces zero audio sources
while still grading. Baseline rule 5 holds by measurement.

Sound design lives in one table, `packages/ui/src/sound/cues.ts`, for the same
reason the kit's material repaint does: a design decision spread across twenty
call sites is a design decision nobody can argue with.

### The old CC0 shortlist

Kept because the licences were verified against the sources themselves and
that work should not have to be redone if the engine choice is ever revisited.
Nothing here is used today.

| Need | Source | Licence, verified |
| --- | --- | --- |
| Reading-screen ambience | Freesound 609895 `Neutral ambient drone` | CC0 1.0 |
| Correct-answer chime | Freesound 419491 `Subway Station Chime` | CC0 1.0 |
| Gentle wrong-answer | Freesound 423166 `Minimalist Sci-Fi UI Error` | CC0 1.0 |
| Water and wind | Freesound 326097 `LakeWavesOct25th2015` | CC0 1.0 |
| Built-something reward | OpenGameArt `Win Jingle` (Fupi) | CC0 1.0 |
| UI click and hover | Kenney `Interface Sounds`, `UI Audio` | CC0 1.0, no attribution |

Two findings from that round that are still worth keeping:

- The claim that FreePD shut down permanently in 2025/2026 is false. The site
  answers 200. It was not used, but a build script pointed away from a live
  source on a bad claim is its own kind of bug.
- Ambience must not ship as MP3. The format pads the start and end of every
  file during encoding, so a looped MP3 has an audible gap at the seam that is
  in the container, not the recording. Ogg Vorbis or Opus on the web — or, as
  it turned out, no container at all.

## Evidence In The Delivery Shell Is A Disclosure Decision, Not A Gap

Worth writing down because it looked like unfinished wiring for a long time
and is not. The shared reader already supports both modes: when it is given an
`evidenceBasePath` it fetches the cited lines and renders them highlighted, and
when it is not it falls back to path, range, commit and the author's note. The
authoring shell passes that base path and the delivery shell does not.

That is not an oversight. The authoring shell has a clone of the cited
repository on disk; a static build served to customers does not. Giving it one
means shipping the source.

Measured, so the decision can be made on numbers rather than instinct:

| Study | Anchors | Distinct files | Lines cited |
| --- | --- | --- | --- |
| turing-pact | 1,072 | 225 | ~11,581 |
| university-local | 208 | 22 | ~2,490 |
| supaluv | 174 | 49 | ~2,477 |
| buzz | 143 | 18 | ~3,019 |
| **Total** | **1,597** | **314** | **~19,567** |

Median citation is 9 lines; the longest is 104. By file type the bulk is real
source rather than documentation: 952 `.ts`, 136 `.mjs`, 115 `.tsx`, 87 `.rs`,
against 118 `.md`.

So "turn on snippets" means publishing roughly 19,600 lines across 314 files of
four private repositories to anyone who buys a course. That is a decision for
the person who owns those repositories, and it must not be made by whoever
happens to be editing the exporter.

Three options, none of them taken yet:

1. **Nothing.** Coordinates only, which is what ships today.
2. **All of it**, behind an export flag. Simple, and the full disclosure above.
3. **An author-chosen subset.** Bake snippets only for the anchors where seeing
   the code *is* the lesson, default closed, opt-in per anchor. Keeps the
   product's actual claim — verifiable evidence — without publishing a third of
   a codebase to make it.

Option 3 is the recommendation. It is also the only one of the three that
cannot leak by accident, because the default is silence.

What did ship: the fallback branch now carries the copy-locator button that the
authoring rail already had. A reader with repository access can paste
`README.md:1` into their editor and land on the line; a reader without it still
sees exactly what was cited. That is the difference between a citation and a
footnote, and it costs nothing.

## The Refactor Rounds, 2026-08-21

Run against `ai-human-friendly-refactor-methodology.md`, in the order it
prescribes: audit read-only first, narrow the public API before moving any
implementation, one seam at a time, targeted checks between.

Two models audited independently from the same brief and converged. What is
worth keeping from that is not the agreement but the two places they were each
half right: one said the delivery shell had written a second lesson reader, the
other said the authoring shell's HTTP client was living in `packages/ui`. Those
are one problem seen from opposite ends — the "shared" `LessonReader` makes 13
calls to the authoring server, so the delivery shell could not have used it.
That seam is **not yet cut** and is the largest remaining one.

**W1 · Public API.** Both packages declared `"./*"`, making every file a public
entry. Removed, replaced with sub-paths derived from grepping actual
deep-imports. Unused exports 21 → 2, unused exported types 51 → 0. The two
survivors are the world grade constants, kept because a grade table is the
contract with the render kit and knip cannot see a same-file blit.

**W4 · Naming.** `LessonView` was a read model in one package and a React
component in another; the component became `LessonScreen`. `flavour` and
`anti-pattern` were one collection under two names, now one — while `#/flavour`
still resolves, pinned by a test, because a bookmarked hash is a public
contract. `LessonLocator` / `LessonAddress` / `LessonRef` were three names for
the same four fields.

**Practice.** The stream was built, tested and mounted by nobody, with nothing
to serve. Generalised off `TermEntry` and mounted against the 281 questions the
concept entries carry.

### What the rounds found that no test could

- **The map had no keyboard.** Course names were `aria-hidden` divs with
  `pointer-events: none`; the only way into any course was clicking a polygon.
  The design document had already said the 2D catalogue exists *before* the 3D
  map and that accessibility is its second reason for existing. It was never
  built, and the defect it was meant to prevent shipped.
- **A growing `hidden={}` list.** The 3D stage was hidden by enumerating every
  view that had to hide it, so a new route was correct only if someone
  remembered to edit that list. Two surfaces had been rendering over a live
  canvas. Now stated as which views *use* the map.
- **The lesson told learners about the billing tiers.** 「第 2 层未接入」 reads
  as an unfinished product; 「真实产品里这会…」 tells a paying learner this is
  not the real product.

### Declined

- **Showing code slices at evidence anchors.** A product audit recommended it as
  the fix for the anchors reading as unusable hashes. The anchors point into
  private repository clones under `apps/local/studies/`, and the delivery bundle
  carries coordinates only. That is a disclosure decision, recorded above, not
  an oversight. The coordinate now explains itself in words instead.
- **Re-arting the 3D scene.** It already has fog, hemisphere and directional
  lighting and a kit-governed `diorama` grade. The flat look is a direction, and
  direction is governed by the portfolio's Web3D and donor rules rather than by
  a refactor.
- **Splitting the concept data files.** Both audits independently defended the
  19,240-line `frontend.ts` as a data table with one responsibility. Splitting
  it by line count is the methodology's first-named anti-pattern.

## Open Decisions

Tracked as decision cards in the user journey, not resolved here.
