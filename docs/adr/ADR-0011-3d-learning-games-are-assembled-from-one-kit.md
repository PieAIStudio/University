---
id: ADR-0011
title: 3D Learning Games Are Assembled From One Kit
type: decision
status: accepted
canonical: true
owner: human
created: 2026-09-24
last_reviewed: 2026-09-24
domain: learning
tags:
  - 3d-games
  - learning-play
  - architecture
pinned: false
related:
  - ADR-0004
  - ADR-0005
  - ADR-0009
  - SPEC-0001
supersedes: []
superseded_by: null
---

# 3D Learning Games Are Assembled From One Kit

## Context

Nine 3D game entries exist (`packages/world/src/toy-play`), built by three
different hands over two weeks. The Owner, reviewing them on 2026-09-23, kept
one idea and rejected the rest of the shape:

- Kept: the garden edition of 双武器拦截 — its toy courtyard, the wave rhythm,
  and the roguelike choice of one upgrade out of three between waves. "This is
  what makes people come back."
- Rejected: a plane as the hero (the learner has an avatar they chose on the
  map), hearts and score outside the play area, the cloud edition, and — the
  documented ceiling in `docs/reference/interaction-density-research.md` §22 —
  a fixed hand-written list of 14 targets that a second run replays from memory.
- Asked for: every later 3D game built "like blocks": the same parts assembled,
  only the mechanic differs.

Two facts shape the answer. Lessons already carry reviewed, gradeable decisions
— 5 of the first 6 lessons of `understanding-ai` hold a sort (a question, two or
three bins, items with the right bin and a reason) — and the learner's avatar
comes from SwimmerAvatarKit, which since 0.7.0 can throw, hop, flinch and cheer.

## Decision

A 3D learning game is five layers, each with one owner. Only the mechanic is
new per game.

| Layer | Lives in | Owns | Never owns |
| --- | --- | --- | --- |
| Content | `packages/core/src/game-content/` | projecting reviewed lesson activities into rounds (`GameRound`), and the verdict (`placeSortItem`, the same engine the lesson uses) | authoring a fact, an item or an answer |
| Rules | `packages/world/src/game-kit/rules/` | a fixed-step session: rounds, hearts, score and combo, upgrades, the review log — plus one mechanic file per game | pixels, DOM, time sources |
| Scene | `packages/world/src/game-kit/scene/` | the arena, the avatar (kit actions), carriers, baskets, projectiles, bursts, and anchors for DOM labels | readable text (rule: text is DOM) |
| Frame | `packages/ui/src/game-frame/` | one box holding the canvas and every HUD element — hearts, progress, score, the round's question, the answer buttons, panels, the review sheet | `three` (packages/ui stays at zero) |
| Assembly | `apps/university/src/game/` | choosing content for a place (a map node, the play lab) and wiring the four layers | a second copy of any layer |

The first game assembled this way is **庭院拦截** (the new 双武器拦截): paper
boats carry a lesson's items across a courtyard pond; each answer bin is a
coloured basket on the terrace and a button in the frame; the avatar throws
the chosen colour at the boat. The bin is the weapon, so the decision the
lesson teaches is the attack itself (intrinsic integration — Habgood &
Ainsworth 2011: children learned more from the integrated version and chose to
play it about seven times as long).

Rules that follow:

1. **Content is projected, never written.** A round is a lesson's sort, its
   bins and reasons unchanged; the game shortens nothing and invents no
   distractors. An activity that cannot be projected (no fixed answer key, or an
   item too long to read while it moves) is skipped, not paraphrased.
2. **A wrong answer costs something.** The old engine revealed the category
   after a wrong-weapon hit, so spraying both weapons taught the answer for
   free. Now a wrong throw costs a heart; the boat then shows its right bin as
   feedback and a corrected throw scores less.
3. **Upgrades change the hands, never the judgment.** A heart, slower boats,
   a shield against one mistake, a combo bonus. Nothing marks, reveals or
   removes a wrong option.
4. **Reading is calm, answering is tense.** Each round opens with a briefing:
   the question and the bins, then 3-2-1. New information is never flashed
   mid-action to be memorised; a missed or wrong item comes back in a review
   round at the end (retrieval under mild pressure is protective — Smith,
   Floerke & Thomas 2016 — encoding under it is not).
5. **Scores are not grades.** Nothing here writes completion, proof or review
   scheduling. A correct throw is a one-in-two or one-in-three recognition, not
   recall.

## Consequences

- The garden edition's look survives as the `Courtyard` arena; the cloud
  edition and the plane are retired with the old invaders flight code in a
  separate commit, with their browser tests rewritten against the new game.
- The five remaining old games (分类落块, 填词消行, 信息切片台, 证据接线盒,
  流程调度站) are candidates for re-assembly, each as one new mechanic file plus
  a scene arrangement: stack and slice are sort content with another mechanic;
  wire is match content; rank is order content (PRIMM `layout` answers); cloze
  needs an authored short key per card, which is course-writing work, not game
  work. The review desk decides which are rebuilt.
- A map challenge node plays the game when this segment and the lessons
  before it give at least two rounds; otherwise it keeps the 2D matching game,
  which also remains the fallback when WebGL is unavailable.
- Longer cards (backs of 28–47 characters in the first course) do not ride on
  boats. A per-card short key would let them, and belongs to the course-writing
  skill.
