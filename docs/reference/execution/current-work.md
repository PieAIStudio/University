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

Design the product before building it. The immediate work is the user journey
V2, not features.

There is still no product implementation and no 3D scene. What changed on
2026-08-18 is that the supply line this product depends on was repaired and
given a gate, and this repository's dependencies were made to tell the truth
about what it currently is.

## Order Of Work

Phases 0 to 2 are done. Phase 3 is the current work.

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
4. **Vertical slice.** One course end to end: import a recovery package →
   navigation → one lesson → deterministic grading → one review the next day.
5. **Upstream changes.** The first one is done, and it is the one V2 named
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

## Open Decisions

Tracked as decision cards in the user journey, not resolved here.
