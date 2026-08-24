---
id: SPEC-0003
title: One World, Two Shells
type: spec
status: active
canonical: true
owner: human
created: 2026-08-21
last_reviewed: 2026-08-21
domain: learning-surface
tags:
  - shared-package
  - world-map
  - shells
  - progress
pinned: false
related:
  - SPEC-0001
  - SPEC-0002
---

# SPEC-0003: One World, Two Shells

## Problem

The authoring shell picks a course from a 2D shelf. The delivery shell picks
one from a 3D archipelago. They are two implementations of the same act, which
breaks the first rule this repository has, and it means every improvement to
"find your next lesson" has to be made twice or it drifts.

The instruction is to put both on the 3D world. The hard part is not the
canvas. It is that the authoring shell's 2D surfaces carry a great deal of
information the archipelago has nowhere to put — today's next lesson, cards due,
the focus track, the airlock's three clocks, when each study was last touched —
and that information is the reason an author opens the app at all. Losing it to
gain a nicer landing screen would be a bad trade made for aesthetic reasons.

So the question this document answers is not "can both shells render a world".
It is **where each piece of the authoring shell's information goes**, given
that it must all still be there.

## The Principle

**The canvas answers "where do I go". The DOM answers "what is true right
now".** They are not competing for the same job and the information does not
have to fit in the world.

This is not a compromise reached to save effort. It is forced by a portfolio
law this project is registered under: readable text is DOM, never geometry.
A Chinese IME, a screen reader, text selection and a phone keyboard all die
inside a canvas. Every number in the authoring shell's shelf is readable text,
so every number stays in the DOM whatever the landing screen looks like.

What follows is that the two shells share **one world** and differ by **one
overlay**, and the overlay is small.

## What Is Shared, And Where It Has To Live

The scene is currently `apps/online/src/world/Maps.tsx`, which imports
`../content/library` — a static JSON reader that the authoring shell does not
have and must not grow. Sharing it means moving it into `packages/ui` and
having it take its data as arguments instead of importing a shell's storage.

The progress half of that is already done. `packages/core/src/progress/`
defines what a lesson is called and what finished means, and both shells now
have an adapter. The scene should take:

- a list of course nodes (id, title, lesson count, prerequisites)
- a `ProgressSource`
- a click handler

and know nothing else. No fetch, no localStorage, no SQLite, no `import.meta`.

## Where Every Authoring-Shell Number Goes

The inventory below is the authoring shell's 2D information, one row each, with
its destination. Nothing is dropped; that is the acceptance criterion.

| Today | Destination | Why there |
| --- | --- | --- |
| Next lesson | **Both.** The world already accents exactly one next course, and the DOM panel names the lesson. | The accent answers it in a glance and the text answers it exactly. Neither alone is enough: a glowing island does not tell you the lesson's title, and a title does not tell you where it is. |
| Cards due today | DOM, top bar | Already there in the delivery shell. One implementation. |
| Focus track | DOM panel, and **the world dims everything else** | This is the one number that earns a change to the scene, because "what am I ignoring right now" is genuinely spatial. |
| Last activity per study | DOM panel, on the study's own card | A date is text. Putting it on a signpost in the water would be unreadable at map zoom and unselectable at any zoom. |
| Airlock three clocks | DOM panel, authoring only | Depends on local git and a seal file. It cannot exist in the delivery shell at all, which is exactly why it belongs in the overlay and not the scene. |
| UA analysis overlay | DOM button, authoring only | Spawns a local process. Same reason. |
| Study shelf ordering | The world's own layout | The archipelago already places studies; a second ordering would be a second answer to the same question. |
| Empty campus | DOM, full screen | An empty world is an empty blue plane, which reads as a bug rather than as an invitation. The empty state must say what to do. |
| Three-question placement quiz | DOM, on entering a course | Not a landing-screen concern. |

Two rows above are the whole design. The focus track is the only authoring
concept that changes the scene, and everything else is an overlay that the
delivery shell simply does not render.

## What Is Shell Infrastructure, Not A Learner Difference

The shell may still expose authoring infrastructure that only makes sense when
the source tree is present: airlock clocks, the UA dashboard, knowledge notes,
the source drawer, pinned-version checkout, and the author CLI. Those are local
authoring capabilities, not a second implementation of a learner feature and
not a second learner-data store.

Everything a learner reads, answers, reviews, annotates, favourites, practises,
or configures is shared. The account document in SwimmerBackend is the one
cross-device source of truth; browser/SQLite state is only a cache, migration
source, or offline outbox. In particular, selection marks, exercise answers,
review history, vocabulary, settings, Today, the map, and the navigation rail
are not local-only.

The keyboard-complete course catalogue is also one shared `CatalogSurface`.
Each shell may adapt its content source — published packages online, local
study views while authoring — but the learner-facing directory, expansion
behaviour and lesson links are one implementation.

The sole runtime difference in that shared learner surface is the grading
boundary: the local shell obtains the AI verdict from the local AI host and
clipboard path, while the online shell obtains it through the metered online AI
adapter. Both write the same structured answer/verdict record to the shared
account document.

## The One Behaviour That Must Change In The Delivery Shell

The authoring shell requires a learner to *confirm they read the lesson*
before it counts, separately from answering its exercises. The delivery shell
has no such signal and currently writes both facts at once from one event.

`packages/core/src/progress/contract.ts` already models these as two
independent flags, and `apps/online/src/progress/source.ts` says in comments
that it sets them equal and that this is a gap rather than a decision. Closing
it is a user-facing behaviour change, so it gets designed in
`docs/reference/player-journey/` before it is built, not decided here.

## Order Of Work

1. Move the scene to **`packages/world`** — a new package, not `packages/ui` —
   and cut its import of the delivery shell's library. Nothing user-visible
   changes; the delivery shell must look identical afterwards, and that is the
   test.

   This document first said `packages/ui`, which contradicted SPEC-0001's rule
   that the shared package must not own any 3D or world map. The owner settled
   it on 2026-08-22: a separate package satisfies both. `packages/ui` is the
   2D learning surface and stays at zero `three`, so a unit test of the lesson
   reader never has to stand up a WebGL mock and no module that imports a
   Markdown component drags a renderer behind it. The authoring shell takes
   `three`, `@react-three/fiber` and `@react-three/drei` **only** when it
   chooses to depend on `packages/world`, which is a decision it makes once and
   in the open.
2. Give the authoring shell the same scene plus its overlay.
3. Decide whether to retire the authoring 2D shelf **only after** every row in
   the table above is visible in the new landing. The separate keyboard
   catalogue is already shared; deleting the authoring shelf earlier would
   trade information for a screenshot.

Step 3 is where this can go wrong, and the ordering is the whole safeguard.

## Non-Negotiables

- One scene, two overlays. A second copy of the archipelago is this document
  failing.
- No text in WebGL. Labels are DOM elements positioned over the canvas, which
  is how the delivery shell already does it.
- No lesson content leaves the authoring shell except as a recovery package,
  and reaching a customer means passing the publish gate (ADR-0002). Identity
  and learner state are shared and travel freely (ADR-0001).
