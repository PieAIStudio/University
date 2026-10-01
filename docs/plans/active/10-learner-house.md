---
id: PLAN-V7-10-LEARNER-HOUSE
title: "V7 · 10 The learner's house: keepsakes, wear, the wall and dragging"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-01
last_reviewed: 2026-10-01
domain: product
tags:
  - v7
  - house
  - keepsakes
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 10 · The learner's house

## Design authority

- [V7 amendment one](../../reference/player-journey/v7/lesson-steps-amendment.html#keepsake):
  high-tier chests drop one keepsake into the learner's house; nothing goes on
  any island; avatar wear lives in the house; answering 「用了」 leaves one mark
  on the house wall, in the learner's chosen form.
- Owner rulings 2026-10-01 on the house design draft:
  - **H1** the entry is a house card at the top of 「我」;
  - **H2** the wardrobe page merges into the house — the coat rack and the pack
    box *are* the wardrobe, and `/wardrobe` opens the house;
  - **H3** learners can drag things to new places from the first version.
- The island is OwnMySpace's. University shows the house interior only; the
  window explains placing the house on an OwnMySpace island and is a control
  that opens an explanation until that interface exists (V5: never hidden).

## Boundaries

- One owner for this repository (Claude). Work in `.worktrees/lesson-format`,
  one task, one commit, one push; `pnpm verify` before each push, the browser
  suite before the push.
- The card-pack service stays closed. The pack box renders and explains; no
  draw, no grant. Turning the service on is a separate, Owner-authorized release.
- Keepsakes are earned, never drawn: they are not in packs and are derived from
  the learning record, so they need no new table.
- Readable text is DOM. The first house is a 2D room (DOM and SVG) in the
  chosen flat-droplet look; a 3D room reading the same layout model is a later
  task, not a prerequisite. Without the 3D room nothing is missing.

## Steps (each one commit)

1. **Keepsake catalogue and derivation** (`packages/core`). A keepsake has an
   id, a source (course, segment, tier: checkpoint / challenge / course) and
   display copy keys. `earnedKeepsakes(progress, courses)` derives what the
   learner holds from the same segment and tier rules as
   `cosmetic-rewards.ts`. The first course ships three specific keepsakes; a
   segment without one yet gets its tier's generic keepsake, so no earned chest
   is ever empty. Unit tests on both paths.
2. **House state in account data** (`packages/core/src/ports/account-data.ts`).
   `preferences.house`: item positions with per-item timestamps, the wall-mark
   style, and the 「用了」 marks by local date. Parse, merge across devices
   (positions last-writer-wins per item; marks union), round-trip tests.
3. **The house view** (`packages/ui` + an app host). Shelves, coat rack, wall
   calendar, pack box, window, the learner's avatar; every placed thing can be
   dragged with a pointer and moved with the keyboard (a non-drag alternative
   is required). Empty slots read as slots. Works at 320 px and with reduced
   motion.
4. **Entry and merge.** The house card at the top of 「我」; the wardrobe link
   and route open the house; the coat rack and pack box reuse the existing
   cosmetics store and copy.
5. **From the chest to the shelf.** A checkpoint, challenge or course-final
   chest shows its keepsake and one action, 「放进小屋」, which opens the house
   with that keepsake highlighted. A repeat chest says it is already there.
6. **「用了吗？」.** On the next open after a lesson with a 「今天就能做的小事」,
   ask once; 「用了」 writes a wall mark for that day; the learner picks the mark
   style on the wall (tally, tick, sticker). No score, no reward.

## Done when

- Each step is on `main` with green `pnpm verify` and browser suite, and a real
  browser pass with screenshots for steps 3–6.
- A learner who finishes the first checkpoint sees the keepsake in the chest,
  finds it on the shelf, can move it, and finds it in the same place on another
  device after sync.
