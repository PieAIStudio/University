---
id: PLAN-20-ONE-UIKIT-AND-FEWER-CHECKOUTS
title: "20 · One UIKit in the product, and one checkout to work in"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-10-06
last_reviewed: 2026-10-06
domain: execution
tags:
  - uikit
  - cleanup
related:
  - REF-WORK-QUEUE
  - PLAN-16-UIKIT-3-ADOPTION
supersedes: []
superseded_by: null
---

# Task 20 · One UIKit in the product, and one checkout to work in

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`. Queue rules are in
  [the work queue](../../reference/execution/work-queue.md). This task is first
  in the Owner's order; it depends on nothing still queued.
- Task 16 ([completed](../completed/16-uikit-3-adoption.md)) moved the App and
  `packages/ui` to `@pieai/swimmer-ui-kit` `3.0.0-rc.1`, but `packages/world`
  still declares `2.14.0`. Checked 2026-10-06: the lockfile resolves **both**
  versions, and the planet page in `packages/world` imports `GameButton`,
  `GameBadge`, `GamePanel`, `GameProgress` and the kit's `styles.css` from the
  old one. So one screen of the product still renders the previous generation of
  the kit inside a UIKit 3 app.
- Task 16 already met one UIKit 3 difference on the planet surface: the kit's
  framed SVG can extend 12px past the viewport, which overflowed the synthetic
  planet fixture until it was clipped. Expect the real planet page to meet the
  same kind of difference.
- On 2026-10-06 the Owner retired three side checkouts; Claude moved them to the
  macOS Trash (`~/.Trash/UniversityLabs-20261006/`):
  `/Users/yuanfei/PieAI/UniversityContent` (course-prep lab),
  `/Users/yuanfei/PieAI/UniversityLookLab` (a 3D look-lab clone whose every
  commit was already in `main`) and `/Users/yuanfei/PieAI/UniversityLookNotes`.
  The course-prep lab's useful files were first archived into the content
  repository at `planning/course-prep-20261003/`.
- The content repository `/Users/yuanfei/PieAI/UniversityCourses` now has its
  private GitHub remote `PieAIStudio/UniversityCourses` (created and pushed
  2026-10-06). Task 14 had left it local-only for want of credentials.
- `.worktrees/r2-baseline` is a detached checkout at `21b11fd3` (2026-10-04),
  left by task 17's R2 baseline measurement. Nothing in `docs/`, `e2e/`,
  `scripts/` or `package.json` refers to it. It holds 28 uncommitted edits, all
  under the pre-task-19 `apps/local/` paths, and about 0.9 GB.

## 1 Outcome

The product ships exactly one version of UIKit, the planet page looks like the
rest of the UIKit 3 app on desktop and phone, and `main` is the only University
checkout anyone works in.

## 2 What the Owner said

> 关键就是我我觉得你之前的安排能让他完成的都完成。好吧，还有就是你新发现的问题能让他修改都修改。

> 之前不是想单独弄出来一个做课程的和做3D的嘛，我觉得这个得删掉，没必要了。但是单独的课程仓库，这个是之前说的解偶弄出来，这个没问题啊。……我觉得这边主线都快完成了，没必要再增加复杂度了。到时候主线完成，直接在干进的主线上往下呃改课程写课程和改3D，我觉得更好一些。

Interpretation: the course content repository stays; side labs and leftover
checkouts go, and future course and 3D work happens on `main` through this queue.
The UIKit split is Claude's finding from 2026-10-05, confirmed again on
2026-10-06 in `packages/world/package.json` and `pnpm-lock.yaml`.

## 3 Out of scope

- UIKit itself. If the planet page needs something UIKit 3 cannot do, record it
  as a kit request; do not patch or fork the kit here (brand-kit-first rule).
- The kits' independence: kits do not depend on kits; NerveKit and AuthKit keep
  receiving UI controls and the auth client by injection, as task 16 left them.
- `packages/ui` stays free of `three`; the renderer stays in `packages/world`.
- Tasks 06, 09, 12 and 15 stay as they are. Do not touch lesson four or any
  course content, and do not write into `/Users/yuanfei/PieAI/UniversityCourses`.
- Completed plans and other dated records that mention the retired checkouts are
  history; leave them unedited. Only current, routing documents are corrected.
- Do not remove any other worktree or branch. `codex/*` branches belong to other
  sessions.
- No raised timeout, weakened assertion, skipped test or visual budget change to
  make the gate pass.

## 4 How it is judged

Baseline: the gates recorded when task 16 was pushed at `c98a695a`
(2026-10-06). Only a documentation commit has landed since, so these are today's
numbers.

| Gate | Command | Baseline | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green; core 95 files/864 tests, UI 100/633, authoring-server 55/518, world 164/1238, app 79/431, backend 5/28, university-ai 6/50; docs 180/324 links/0 warnings | green, no count falls |
| complete | `pnpm e2e` | 338 passed | green, at least 338 passed |
| complete | `pnpm e2e:timing` | 40 passed | green, at least 40 passed |

The push runs both complete gates (`lefthook.yml`, pre-push `browser-e2e`). The
fast gate alone is not proof for this task: the planet page is a browser
surface.

Also required:

- `pnpm-lock.yaml` resolves a single version of `@pieai/swimmer-ui-kit`, and it
  is the same one the App uses.
- Captures of the planet page at 1440 and 375 wide, light and dark (four
  images), saved under `.scratch/task20/`, and added to the Owner's pending
  task-16 walkthrough (`.scratch/overnight-20261003/task16-walkthrough.md`) so
  one visual review covers both tasks.
- `git worktree list` shows only the main checkout. Before removing
  `.worktrees/r2-baseline`, save its uncommitted edits as a patch under
  `.scratch/task20/`, and say in the commit body whether any of them is not
  already in `main` under the new `apps/authoring-server/` paths.
- Current routing documents no longer send anyone to the retired checkouts.
  The work queue was corrected when this task was filed; the content-root
  passage in `docs/reference/execution/publish-lane.md` still names
  `UniversityContent` and should name the content repository's GitHub remote
  instead. `pnpm doc-gov check` and `links` stay at 0 warnings.

Standing floor: pass counts may rise, never fall. If any count drops, name the
test that left and why in the commit body first.

## 5 Delivery discipline

- One task, one commit, one push. The push runs the complete gate.
- Push only when the one-minute load is low and no other Playwright run is on the
  machine; the hook uses its own ports 18693–18696.
- If the complete gate cannot go green: stop, leave the work committed locally,
  record what blocked it here, and do not start anything else.
- Never force-push. Never rewrite history.
- In the commit body: what changed, why, and the gate numbers exactly as printed.

## 6 Report back

- Gate numbers verbatim.
- The four planet captures and where the walkthrough now shows them.
- One sentence on what changed on the planet page, in words the Owner can check
  by looking.
- Anything noticed but not done, as a candidate for a later task.

## Execution record · 2026-10-06

- Updated `packages/world` to `@pieai/swimmer-ui-kit@3.0.0-rc.1`; the lockfile
  now resolves one UIKit version, matching the App. The planet page's existing
  globe and DOM rail remain intact; UIKit 3 framed controls are contained by the
  existing fixture viewport at desktop and phone sizes.
- UIKit 3's jsdom `ResizeObserver` requirement was handled in the world test
  setup with the same no-op test observer used by the UI and App test suites.
- The retired `.worktrees/r2-baseline` checkout was removed after saving its
  uncommitted diff as `.scratch/task20/r2-baseline.patch`. Its 28 edits were all
  under the old `apps/local/` paths; none was required for the current mainline
  `apps/authoring-server/` paths.
- The current publish-lane routing now names the private
  `PieAIStudio/UniversityCourses` repository instead of the retired
  `UniversityContent` checkout.
- Planet captures are recorded in the shared walkthrough
  `.scratch/overnight-20261003/task16-walkthrough.md` and stored under
  `.scratch/task20/` as `light-desktop-1440.png`, `light-phone-375.png`,
  `dark-desktop-1440.png` and `dark-phone-375.png`.
- Fast gate: `pnpm verify` passed; world 164 files / 1238 tests, app 79 / 431,
  docs 181 / 328 links / 0 warnings.
- Complete gate: `338 passed (21.7m)`.
- Timing gate: `40 passed (6.0m)`.
- No follow-up issue was found in the planet surface. The remaining UIKit 3
  browser console warnings are the existing Three.js deprecation notices and
  did not fail the gate.
