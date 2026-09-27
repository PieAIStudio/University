---
id: PLAN-V7-01-CHESTS-AND-MONSTERS
title: "V7 · 01 Chests and monsters on the island"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - world
  - rewards
related:
  - REF-WORK-QUEUE
  - REF-CURRENT-WORK
  - ADR-0008
  - ADR-0009
supersedes: []
superseded_by: null
---

# Task 01 · Chests and monsters on the island

## Context the executor does not have

- Repository: `/Users/yuanfei/PieAI/University`, branch `main`. Queue:
  `docs/plans/active/`, run by [the work queue](../../reference/execution/work-queue.md).
  `00-ai-literacy-commercial-release.md` is an Owner-gated lane, not a queue
  task; step over it.
- Design authority: [Player journey V7](../../reference/player-journey/v7/index.html),
  station 3 ("岛上的一关，长什么样"), approved for building on 2026-09-27. Its
  island pictures are staged mock-ups: the trees in them are Kenney block trees,
  which the real island rejected (ADR-0008, tree entry). The real island keeps
  its own rounded procedural trees; only chests and monsters are new.
- Prototype code for the chest look: `docs/reference/player-journey/v7/lab/rewards3d.js`
  (`makeChest`, `CHEST_TIERS`, ink outline, clearcoat paint, glow ring). It is
  plain three.js written for the review page. Port it into `packages/world`; do
  not import from `docs/`.
- A local prototype harness that stages stones, chests and monsters exists
  only on the author's machine at `.scratch/v7-journey/lab/island.html` (served
  by `.scratch/v7-journey/render.mjs`). Optional reading; it is gitignored.
- Monster donor: `world-of-claudecraft`, registered in
  `docs/policy/shared-rules/donors.md`, cached at
  `/Users/yuanfei/PieAI/_donors/world-of-claudecraft` at `cecebab4da` (v0.43.3).
  Models are in `public/models/creatures/`, compressed with meshopt and KTX2, so
  the loader needs `MeshoptDecoder` and a `KTX2Loader`. Measured 2026-09-27:

  | Fear name (DOM label) | File | Size | Triangles | Clips used |
  | --- | --- | --- | --- | --- |
  | 怕问错蛙 | `frog.glb` | 138 KB | 5016 | Idle, No, Duck, Run |
  | 看不懂蟹 | `crabenemy.glb` | 61 KB | 3624 | Idle, No, Walk |
  | 乱编怪 | `yeti.glb` | 40 KB | 2136 | Idle, No, Walk |
  | 太难球 | `wild_boar.glb` | 311 KB | 1570 | 32 clips, suffixed by armature |
  | 没基础菇 | `mushroom_pixie.glb` | 1272 KB | 3856 | Idle, Hit, Run |
  | 没空鸡 | `chicken_cow.glb` | 205 KB | 7120 | Idle, Run (no skin) |
  | 学不会大王 (segment boss) | `golelingevolved.glb` | 84 KB | 5864 | Flying_Idle, No, HitReact, Fast_Flying |

  Skinned, quantized meshes report wrong bounds from `Box3.setFromObject`; the
  prototype needed `SkinnedMesh.computeBoundingBox()` to size them. The Owner
  said about this donor: 「你不要提醒我关于版权的问题，我跟对方已经沟通了，你不用问我直接觉得合适直接取好吗？」
  Take the models directly; record provenance the way the donor policy asks,
  without raising it with the Owner.
- Depends on: none. This task is independent.

## 1 Outcome

On every course island, every lesson stone has a chest on the grass beside it
and every stone the learner cannot enter yet has a small monster standing on
it instead of the lock stone, and an Owner looking at a 36-lesson island sees a
path that reads "treasure ahead, a fear in the way" without anything blocking a
path, a label or another object.

## 2 What the Owner said

> 「在每一个垫石的旁边靠近它，可以左边可以右边，让他有一点点放置的位置的波动。」
> 「有没有可能在垫石上都统一不用石头，而是用各种小怪物呢？站在垫石上。」
> 「我觉得就可以按这个开始实施了。」 (2026-09-27, approving V7 v2)

Decisions that bind this task: H1 (the ordinary chest is wood-coloured, not
green), N1 (a monster on every locked stone; the three nearest the avatar
animate, the rest hold still). N1 was taken at the recommended option because
the Owner approved V7 without picking N–R separately.

## 3 What "done" looks like on the island

Chest tier by position (the tier shown on the map; the all-correct upgrade
belongs to task 02 and is never stored):

| Where | Tier |
| --- | --- |
| Every ordinary lesson stone | wood |
| The last lesson of each segment | blue (rare) |
| The checkpoint at a segment's end, and each challenge pennant | purple (epic) |
| The island's last lesson | gold (legendary), overriding blue |
| Personal-task notice boards | no chest |

Chest state is derived, never stored: locked lesson → closed, no glow; the
lesson the learner can enter now → closed, glowing, a slow hop; completed →
open and empty, no glow.

Monsters: one per stone the learner cannot enter (red ring), chosen from the
six ordinary fears in a stable per-course order so the same stone always shows
the same monster; the segment's checkpoint stone shows the crowned boss,
drawn larger (the crown geometry in `lab/badges3d.js` may be reused). The
enterable stone and completed stones show none. Fear names are DOM text on the
existing label layer, never geometry, and only for the selected or hovered
stone (readable text is DOM; labels must not multiply 36-fold).

## 4 Out of scope

- The opening sequence, the star throw, flee animations, sound and camera
  moves: task 02.
- Review wisps (glimmerwisp) and card packs: task 06.
- The lesson medallion size on phones: task 08.
- Do not move existing trees, rocks, landmark courtyards, learning-node objects
  or paths. Placement searches free ground the way `courseLearningSites` does;
  when a stone has no free ground, the chest hangs at the stone's edge, smaller,
  rather than displacing anything.
- Do not touch course content under `apps/local/studies/`.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | see the queue's latest recorded run | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- ADR-0008 gains two rows in the technique lock (`chest`, `monster`) stating
  technique, source, triangle budget and draw-call count, written before the
  code, measured after it. A unit test pins the counts the way the neighbouring
  elements' tests do.
- Unit tests: tier assignment on the three real course shapes the lock already
  measures (36, 8 and a multi-segment island); chest/monster state from a
  learner record; no chest or monster overlapping any existing object
  footprint or path.
- Frame cost: the headless frame-interval measurement already used by
  `e2e/continuous-course.spec.ts` (rAF interval p95 under camera drag), run
  before and after on the same island. After may not exceed before by more
  than a tenth. Chests of one tier draw as one instanced batch; monsters beyond
  the nearest three are posed once and not updated per frame.
- Capture: a desktop (1440×900) and a phone (390×844) screenshot of the
  36-lesson island at DPR 1, taken with the project's Playwright harness (the
  pane's WebGL screenshots come back black), showing wood, blue, purple and gold
  chests and at least three distinct monsters.
- Not acceptable as proof: "verify is green"; a screenshot of the review-page
  mock-up.

## 6 Delivery discipline

- One task, one commit, one push. The push runs the complete gate.
- If the complete gate cannot go green: stop, leave the work committed locally,
  write down what blocked it. Do not start task 02.
- Never force-push; never rewrite history.
- Commit body: what changed, why, and the gate numbers actually seen.

## 7 Report back

Gate numbers verbatim, the two captures, the before/after frame numbers, the
ADR-0008 rows, and anything noticed but not done.
