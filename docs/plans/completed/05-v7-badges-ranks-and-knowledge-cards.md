---
id: PLAN-V7-05-BADGES-AND-CARDS
title: "V7 · 05 3D badges and ranks, the card album and card faces"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-29
domain: learning-experience
tags:
  - v7
  - rewards
  - uikit
related:
  - REF-WORK-QUEUE
  - ADR-0008
supersedes: []
superseded_by: null
---

# Task 05 · 3D badges and ranks, the card album and card faces

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 9
  ("翻翻图鉴") and 10 ("段位和徽章"), mechanics 4 (sets), 9 (a head start) and
  11 (promotion ceremony).
- Prototype models: `docs/reference/player-journey/v7/lab/badges3d.js` (`RANKS`
  stone/bronze/silver/gold/obsidian with sunburst, ring, crystal, feather wings,
  crown, ribbon; `BADGES`, 10 existing and 7 new, with frames, icons and a
  locked grey). Renderers live in `packages/world`; `packages/ui` stays free of
  `three`. A badge shown inside DOM may be a pre-rendered image produced by the
  world package's renderer, or a small canvas owned by `packages/world`.
- The knowledge card is a new SwimmerUIKit component (tilt and glare after the
  React Bits profile card; frame, outline, three-tone shading and flip rhythm
  after the Owner's card reference folder `docs/reference/卡片-参考-*`, untracked and present only on the author's machine; its prompt text asks for edge-detected even outlines, a clean gradient with slow soft light behind the rarest reveal, soft light with no hard edges, and sound synthesized after the first click). Release it
  in UIKit, consume it here.
- Measured facts: ranks are by cards remembered three weeks later — 0, 10, 50,
  150, 400; the album has 281 concepts; the 「认识 AI」 lessons currently link no
  concepts, so finishing a lesson lights no card today. Marking concepts in
  lessons is course-writing work: raise it with the write-lesson workflow, do
  not edit lessons in this task.
- Depends on none of 01–04 for its code. Independent. The badge reveal inside
  the chest opening uses task 02's reward slot when present.

## 1 Outcome

"我 → 成长" shows the five ranks and all seventeen badges as 3D emblems (grey
with "还差…" when not earned), and the album shows the learner's own cards as
tiltable, flippable cards whose frame upgrades with memory — silver when new,
purple with a gem when remembered, gold with a crown and shine after three
weeks.

## 2 What the Owner said

> 「我想让玩家用户在用这个的时候感觉很好看，然后更视觉化一些，然后点进去之后他们能复习，他们也有收集感。」
> 徽章「也照参考视频做，多设计一些，放在合适的地方」。

Binding decision M1: the seven new badges ship together with the ten existing
ones. Every badge is earned by doing something, derived from existing records,
never stored separately: 一次全对, 挑战者, 跳级, 错题清零, 自己的话 (5 lessons), 三座岛,
两条路.

## 3 What "done" looks like

- Album defaults to the domain being studied ("AI 基础 · 已集到 3 / 25"), expands
  to all 281 in one tap; cards are grouped into sets per road segment, and a
  completed set grants its limited cosmetic entitlement (the grant itself is
  recorded by task 06's store; until 06 lands, show the set as complete).
- First opening shows two cards already collected ("提示词", "AI 是什么"), so the
  first segment reads 2 / N, not 0 / N.
- After a lesson, the lesson's cards flip one at a time, rarest last with a soft
  rotating glow behind it (sound synthesized, only after first interaction).
- Tilt follows pointer; on phones it follows device orientation only after
  permission, otherwise finger drag; reduced motion disables tilt and shine.
- Renames: "课堂笔记" → "我的笔记"; "防 AI 味儿" appears only in the build-an-app
  domain; "互动课件" moves from practice to the album.
- Rank promotion: when remembered cards cross a threshold, the emblem upgrades
  once with the wings-and-spin ceremony, then sits beside the avatar.
- Badges appear in four places: largest last in the chest rewards; the rank on
  the avatar panel; the wall in "我 → 成长"; the course badge on the completion
  card.

## 4 Out of scope

- Card packs, fragments and cosmetics storage: task 06.
- Editing lessons to mark concepts.
- The menu restructuring that moves 成长 under 我: task 08. Until 08 lands, put
  the wall where 成长 lives today.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Unit tests: each of the 17 badges' derivation from records, including the
  seven new ones' edge cases; frame tier from a card's review history.
- Browser spec: album default filter, expand-all count, flip reveal order,
  reduced-motion variant; `packages/ui` still imports no `three`
  (`pnpm boundaries`).
- Capture: rank row, badge wall, three card tiers, desktop and phone.

## 6 Delivery discipline

One task, one commit, one push here (UIKit release first in its own
repository); stop if the complete gate cannot go green; never force-push or
rewrite history.

## 7 Report back

Gate numbers verbatim, UIKit version, captures, and the concept-marking request
filed for the course-writing workflow.

## Implementation and local acceptance · 2026-09-29

The dependency is now the official **SwimmerUIKit 2.12.0**, exact-pinned in
the app, DOM package and world package. Its optional card-tilt owner was
published from `78d86dd19101b5dbf9c8a1eca7ab2209a933e0bd` by manual Trusted
Publishing run `36557905337`; independent official-registry readback verified
the tarball SHA-512 and public declarations. UIKit's own source/API/package
checks passed 464 tests, and its built catalogue passed Chromium/Firefox/WebKit
with the existing browser-specific scope. No product website was deployed.
The exact upstream receipt lives in that repository under
`.devspace-reports/card-orientation/registry-receipt.json`.

University reads authored concept ids from the existing shelves, not a second
lesson fetch or catalogue. The album and road sets are pure projections;
starter gifts do not create learning progress. The complete index remains
searchable and uncollected concepts remain readable. The existing brand card
and brand-package illustrations supply faces; `packages/ui` imports no Three.js.
The optional sensor is one explicitly enabled owner per album, with only the
selected card receiving samples. Permission denial and reduced motion retain
finger/keyboard controls and account exit unmounts the owner.

Chest rewards and rank ceremonies use the original scene/emblem builders.
Rank presentation follows a real local scheduler rating, never cloud loading
or an imported record. Late chest scene callbacks and close timers are bound
to their owner and receipt, so they cannot close another chest or change a
new account. Badge display has both locales; completion and first-try badges
do not treat an explicit unconfirmed modern reading as a finished level.

The [write-lesson request](../../reference/execution/knowledge-card-authoring-request.md)
records the actual publication gap: **all 93 currently shipped lessons lack
concept links**, not merely 认识 AI. The two gifts remain real, but the product
does not fabricate a newly earned concept or an empty-road set. Isolated
browser fixtures name their fabricated learning history on screen and use the
real UI and scheduler. They are not evidence of learner retention, live cloud
accounts or physical sensor permission dialogs.

The first browser run retained failures from an unpersisted URL-language
override and unexported fixture imports. The latter caused repeated Vite
diagnostics, not a product recovery path; its process ended failed. The fixture
now uses the package's public entry points, and the real navigation path uses
its current locale rather than claiming the query parameter changed a saved
preference. The reduced-motion reproducer then passed (1 test, 20.2s).
The final code passed `pnpm verify` (exit **0**) and the combined album,
chest-opening and return-loop browser regression: **19 passed (2.5m)**,
exit **0**. Native WebCodex executions retained under this project's session:
`wc_job_bz6M7z5ASf1zpYhU` and `wc_job_cfyX6Ej56YYntp-R`. The normal pre-push
suite remains mandatory; the saved candidate and its push receipt belong in
`SCRATCH/v7-execution/`, not a replacement or weakened gate.

### Integration defects found by the final acceptance

- Optional anonymous save originally looked like an account switch and erased
  the first chest while it opened. `guest-adoption` now preserves a transient
  presentation identity only for the exact SDK creation receipt and this
  guest's local import. A restored or superseding account never inherits it.
  Local application is reported before remote IO, so a slow cloud request
  cannot hold the celebration hostage. The original chest assertions remain;
  a delayed real-SDK/synthetic-provider browser case now guards the handoff.
- Review-card revisions are independent of lesson revisions. Both shelves
  expose the declared card versions; album memory uses those identities and
  versions, never numeric equality with the lesson version. Old/removed cards
  and an older source lacking this metadata cannot brighten a frame.
- A modern reading explicitly left unconfirmed does not count as complete for
  completion/perfect badges. Sensor denial, language changes, keyboard card
  flipping, narrow card trays, night-theme contrast and unfinished answer
  inputs remain covered. Seventeen badges still derive from existing records.

### Visible evidence and remaining boundaries

`SCRATCH/e2e/knowledge-album/` contains both modes at 1440px and 390px, the
real album/courseware entries, isolated three-tier cards, the ordered reveal,
five ranks, the seventeen-badge wall and the actual scheduler-triggered
promotion. Final screenshots were inspected; fixture filenames beginning
`synthetic-` do not establish live accounts, three weeks of real retention,
physical sensor permission or native-shell acceptance. Original failures are
retained in the earlier `album-browser-*` logs.

No existing browser case was removed. The old class-note and flat-concept
expectations were migrated in `LibrarySurface.test.tsx`,
`KnowledgeNotes.test.tsx`, `screens.test.tsx`, `App.progress.test.tsx` and
`e2e/harness/experience.ts`; they still check the real entry and return path.
Task 08 owns the four-door navigation. Task 06 owns cosmetic grants. The
source-link and starter-title gaps remain with the linked authoring request.
No course publication, production deployment, charging or remote schema apply
is represented by this implementation receipt.

### Full-push integration repair

The first ordinary push of `988d98ef` stopped at **5 failed / 433 passed
(24.0m)**, before the timing lane. Four tests still entered courseware from
Practice; after moving their real navigation into the album, they exposed two
actual integration omissions: the old map renderer was not released and the
catalogue's `entry` / `group` query keys leaked into the returning lesson URL.
The album courseware now shares the original lab's renderer boundary, and
only that route's own query keys are removed when leaving it. The original
no-map-canvas, real AI action, exact return URL and identical foliage checks
remain in all four mode/viewport cases.

The fifth failure left a chest closed after a real press. A focused rerun was
**2 passed (1.4m)**; deterministic hook tests then reproduced both losing the
button and dropping its click while this same guest's optional account was
being adopted. Presentation now stays mounted and accepts scoped presentation
transitions; actual navigation still waits for verified local adoption, and a
replaced account/flow still invalidates every retained callback. Both added
negative controls failed before the fix. The real-SDK browser regression also
holds a physical pointer press across the account event and checks exact DOM
node preservation before release.

Post-fix focused checks: **18 passed** hook/router tests and **10 passed
(2.2m)** actual-browser chest, contrast and full world/courseware round trips
(`wc_job_VwjvJcoavcyVQHpv`, exit 0). No failed assertion was relaxed and no test
was removed. The repaired full `pnpm verify` returned **exit 0**
(`wc_job_9KOso6S20th3G8RE`), including 165 governed documents with zero warnings.
The new normal push remains required for this candidate; its terminal receipt
remains the delivery authority.

