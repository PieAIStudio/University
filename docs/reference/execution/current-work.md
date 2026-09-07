---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-08
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
  - REF-V5-JOURNEY-REVIEW
---

# Current Work

The short, current handoff. **What is true now, never how it got that way.**

> **合成一套代码，已完成（2026-08-25）**：`apps/local` 与 `apps/online` 已合并为
> `apps/university` 一个浏览器应用，用 `vite --mode authoring | delivery` 区分。
> `apps/local` 现在只剩那台读磁盘的 Node 服务（4317），没有被改动。
> 经过、踩过的坑和验收数字在 git 历史里（2026-08-25 的合并提交）。

> **当前收敛方向（2026-09-06）**：先整理并验证主线，再从同一个已推送提交分出
> 3D 与课程两条工作线。旧 `codex/launch-first-slice` 工作区保留；其中课程信息面板
> 的折叠改进单独接收，六边形装饰和诊断实验不作为新地形方案的前提。
>
> **3D 目标是连续整块地形。** 当前默认世界、岛群和课程场景仍使用 grid/hex 渲染；
> `IslandBlueprint`、`IslandField` 与连续几何生成器已经存在，但不能把它们存在于
> 仓库里等同于默认画面已经使用。后续复用这套源数据，协调地表、路线、落点、点击
> 和 DOM 标签，避免替换地面后它们各自读不同的高度。架构与技术选择继续遵循
> [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) 和
> [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md)。
>
> **先让资产说明与画面一致。** 现有作者工作台 `#/studio/map` 的资产 inspector
> 主要读取 r01/elemental registry，默认地图主要使用 `grid-assets.json`。先复用
> 现有 placements 修正说明来源；库存中的资产总数不等于当前画面实际使用的数量。
> 三层地图的美术方向与当前设计见 [V5](../player-journey/v5/index.html)。
>
> 本轮不处理 `island-look` 浏览器门禁，也不以旧机位、旧草或旧灯光的数字宣称
> 当前性能与观感已通过。已有实验和截图保留在原工作区及本机证据目录。

> **学习玩法待整合（2026-09-08）**：`codex/learning-play-lab` 位于相邻
> `University-play` worktree。基础五种保留于 `/play-lab`；新增五种 AI 产品玩法位于
> `/play-lab/ai`，合计十种共享组件、二十个情境。AI 组包含客户变更、顾客试营业、
> 文件权限驾驶、匿名逐次评测与双版本时间线，采用明确标注的预设教学沙盒。
> 完整 `pnpm verify`（2032 个 Vitest 用例）、24 条唯一浏览器回归及真实课程源的
> 四份导出核对通过。研究、迭代、独立审查与精选截图录像见
> [AI 玩法完成回执](../../plans/completed/ai-product-play.md)；首轮记录仍在
> [基础玩法计划](../../plans/completed/learning-play-lab.md)，接入 API 见
> [组件 README](../../../packages/ui/src/learning-play/README.md)。
> 固定预览：`http://127.0.0.1:21996/play-lab/ai`。合并时协调共享路由、CSS、
> 翻译与导出注册、journey、current-work 和 manifest；配课经既有课程 CLI 进行。
> 组件及沙盒行为已验收，真人乐趣、学习迁移与正式课程发布仍属上线阶段验证。


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

**当前 delivery shelf：4 studies · 44 courses · 128 units · 495 lessons**
(495 unique ids) · 1,106 cards · 640 exercises · 1,584 evidence locator entries。
Core catalogue remains 281 concepts (**138 carry a shared flow map**, 24 carry a
style sample) · 267 terms · 25 anti-patterns. The shelf snapshot was generated
2026-09-01 with `evidenceMode: none`; it contains locators, not baked source
snippets.

The previously measured source-wide graph had 427 lesson-to-lesson links, 414
inside its course and **13** crossing courses; that count belonged to the former
53-course source shelf and is not asserted for the current 44-course delivery
shelf. `[[term:]]` links: zero in the current tracked shelf.

The following test totals are a dated snapshot, not a current gate receipt:
core 378 · backend 1 · ui 274 · world 133 · university 143 · local 409 = **1,338**.
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

This page is *what is true now*. The list of everything already shipped —
navigation skeleton, node popup, spineOrder, capability sentences, path
legibility, evidence code, the overlay layer, the reading screen,
`packages/world`, the authoring overlay, the account, the review scheduler,
pricing, dictation design — used to live here as twenty-one numbered entries
and a completed refactor table. It was roughly half this document, and it
answered a question nobody asks: how did we get here.

Where those answers actually live:

- **Why a rule is the way it is** — the ADR that decided it, in `docs/adr/`.
  Every reversal carries a `supersedes` link.
- **What a change did and what it measured** — the commit message that made it.
  This repository writes real ones; `git log` is the record.
- **What the learner is supposed to experience** — `docs/reference/player-journey/v5/`.
- **What is designed but not built** — the gap documents beside this file
  (`payment-backend-gap.md`, `feedback-backend-gap.md`,
  `review-reminders-backend-gap.md`) and `commercial-model.md`.

The next work has two owners, starting from the same verified, pushed baseline:

1. **3D and asset inspection:** make Map Studio describe the assets the current
   projection really uses, then build the continuous-terrain slice in a new
   `codex/` branch and worktree. Keep one blueprint/field pipeline and measure
   the actual result before expanding it across all three map levels.
2. **Course quality:** Claude Code works in its own branch and worktree, using
   the existing `apps/local` authoring workflows. Lesson source changes and
   published packages remain separate acts; the 3D branch does not regenerate
   course content to make its environment run.

Course IDs, unit/lesson ordering, the blueprint input contract and shared
learner UI are integration boundaries. Coordinate changes to them before both
branches depend on different answers. Keep unrelated old experiments out of
the baseline; preserving their worktree does not make them accepted product
behaviour. Payment integration remains tracked in its existing gap document.


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
- **`apps/university/content/` is gitignored, so `pnpm verify` is only as
  current as the last `pnpm content` in *that* checkout.** The delivery
  packages are generated output, not tracked files, and every worktree carries
  its own copy at whatever age it happens to be. On 2026-08-27 a branch was
  verified green in a worktree whose copy had just been regenerated, merged,
  and then `check-content-revisions` failed on `main`, whose copy was twelve
  hours old — a red that looked exactly like a bad merge and was not one. It
  goes the other way too: a worktree with no generated content at all makes
  the same check pass while counting nothing. Run `pnpm content` before
  trusting either colour, and read the counts it prints
  (the current tracked shelf is 4 studies, 44 courses, 495 lessons and 1,584
  evidence locators; whether source snippets are baked is controlled separately
  by the delivery lane's explicit evidence mode).
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
