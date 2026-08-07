---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-08-08
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related: []
---

# Current Work

This file is the current project work index. It is not the agents-routing algorithm.

## Current Focus

- Current phase: rewrite active lessons into the five teaching variants, then
  learn with them and record friction. Do **not** re-build the foreign-language
  layer, lesson links, evidence anchors, URL addresses, or `write-lesson` skill
  — those shipped 2026-08-07–08 (receipt below).
- Current active plan: none.
- Current active spec: none.
- Current content work: apply `.agents/skills/write-lesson/` (and
  `pnpm lint:lessons`) to the remaining lessons that predate `variant`. First
  six rewritten lessons already pass the linter; ~475 do not declare a variant
  yet and are skipped by design.
- Current proof target: real owner sessions on the rewritten lessons — reading
  with 外语模式, following `[[lesson:]]` links, using URL restore after reload —
  before inventing new exercise formats.
- **B1 host feedback bridge is built** (2026-08-06). Research note:
  `docs/reference/下一阶段/Grok/04-host-feedback-bridge-b1.md`. Expression
  coaching uses the same packet shape without write-back.
- **Self-study via airlock is built** (2026-08-06). The hand-authored
  SpecialStudies / `ul-meta` path is superseded; topology is in
  `docs/reference/what-lives-where.md`.

## Accepted Direction (2026-07-20)

- Run UniversityLocal local-first from an AI host; public/mobile cloud access is a
  later capability, not a first-build dependency.
- Analyze only a commit-pinned snapshot. A dirty source stops refresh by default;
  after explicit owner acknowledgement, UniversityLocal may analyze the immutable
  commit while recording that all dirty files were excluded.
- UniversityLocal is permanently local-only and never connects to SwimmerBackend
  or another application backend. A future commercial `University` is a separate
  repository and may own a separate SwimmerBackend contract.
- Grok Build is the preferred daily teacher; Codex and Claude Code remain supported.
  The Web UI presents learning and
  review flows without a second runtime model integration in the first phase.
- Version application code, configuration, schemas, and skills in Git. Keep
  personal learning data out of Git and use the local SQLite backup path.
- Use a mixed daily flow: due review plus project-goal learning.
- Integrate pinned Understand Anything through a UniversityLocal-owned full-analysis
  adapter. Keep runtime worktrees temporary and make small upstream fixes only when
  reproducible evidence proves a UA defect.
- Keep UniversityLocal on the portfolio SwimmerUIKit baseline currently declared
  in `package.json` (presently `1.3.0`; earlier receipts below record `1.2.0`).
- Keep personal study containers under root-level `studies/<study-id>/` by
  default, with an explicit configuration escape hatch for another data root.
- Reserve `University` for a possible future consumer product in a separate
  repository; do not turn UniversityLocal into a mixed local/SaaS boundary.
- Treat donor research as an implementation gate. Current promoted patterns are
  atomic Markdown notes (Foam/SilverBullet), ts-fsrs scheduling, and immutable
  source snippets; feature-volume donors remain deferred or rejected explicitly.

## Foundation Verification Receipt (2026-07-20)

- UniversityLocal declares and installs `@pieai/swimmer-ui-kit@1.2.0`, imports its
  shared stylesheet once from `src/main.tsx`, and passes the complete
  `pnpm verify` gate.
- The PGS portfolio baseline is `1.2.0`. A fresh 19-repository AI health scan
  reports every actual UIKit consumer as declared, installed, and aligned at
  `1.2.0`; AnvilLocal remains correctly not applicable.
- Full repository verification passed for HQ, PGS, Anvil, Collapse,
  OwnMySpace, Sea, Show, YaZu, and UniversityLocal. TuringPact already used
  `1.2.0` and required no change.
- Break passed typecheck, 142 tests, and its production build, but its complete
  gate remains blocked by pre-existing formatting drift in 14 product files.
- SupaLuv passed typecheck, 650 tests, and its workspace build, but its complete
  gate remains blocked by two pre-existing React hook lint errors in
  `apps/web/src/creator/AssetBay.tsx`.

## Current Constraints

- UniversityLocal is personal teaching infrastructure, not a Pie consumer-product
  line.
- External project repositories stay clean; study artifacts belong to UniversityLocal
  by default.
- The architecture must align with HQ's TypeScript/Vite/React direction and the
  relevant Swimmer kits without introducing a backend or irrelevant game
  infrastructure.
- The completed SPEC-0001/PLAN-0001 foundation and SPEC-0002/PLAN-0002 daily
  bridge remain the current receipts. Cloud sync is outside this repository's
  permanent product boundary.

## Implementation Receipt (2026-07-20)

- Identity migration, PGS registration, root-level `studies/`, path safety,
  schemas, local SQLite/FSRS, shallow bare Git snapshots, UA data mapping, atomic
  course revisions, activation gates, evidence freshness, secure loopback API and
  Today/Studies Web flows are built.
- SupaLuv is registered with one historical UA import and both historical/current
  clean snapshots. Its ready 2.9.4 full analysis covers all 606 eligible files,
  contains 1,542 nodes, 2,656 edges, 9 architecture layers and a 10-step Chinese
  Tour.
- The active `founder-engineer` course contains one lesson, one short-answer
  exercise and four cards. Browser proof completed the lesson, recorded one wrong
  and one correct exercise attempt, scheduled one FSRS review and preserved the
  result across reload.
- Studies now reports source snapshot and ready-UA counts while stating that UA
  native maps/tours are course evidence, not formal courses.
- UA analysis IDs are configuration-bound, and SQLite can transactionally replay
  append-only review events to verify or rebuild card projections.
- Official Understand Anything 2.9.4 skills are installed and actively used through
  the isolated UniversityLocal workspace.
- The project-local `teach-from-study` skill defines the shared teaching workflow
  for Grok Build, Codex, and Claude Code.

## Daily Bridge Completion Receipt (2026-07-21)

- PLAN-0002 and SPEC-0002 are completed. Grok Build 0.2.106 discovers the project
  router, all three UniversityLocal learning skills, and Understand Anything
  2.9.4 without a duplicate `.grok/` tree.
- Natural-language “记一下” produced a validated atomic note/card proposal and a
  safe dry-run receipt. The isolated Web session then proved actual note review,
  pre-reveal answer persistence, FSRS rating, formal lesson completion, session
  event grouping, and persistence across local-service restart.
- Browser QA passed at desktop and 390 px after fixing two responsive overflow
  seams. The complete implementation gate passes 22 test files / 173 tests plus
  typecheck, zero-warning lint, format, build, and documentation governance.
- The real learner database remains reset and empty; recoverable local backups
  remain under the ignored `studies/supaluv/learner/backups/` shelf. SupaLuv's
  HEAD, tree, and full dirty-state receipt remain unchanged.
- UniversityLocal's initial baseline is
  `2d07593bf943801dd5ce2dfb39a52981c5a0fea4`; PGS registration is committed as
  `39ea12c370f7790da84cf157eac82b9fab2e0532` and the portfolio scanner reports
  UniversityLocal healthy with no backend capability.

## Hardening Receipt (2026-07-25)

First end-to-end owner-style pass over the built product, plus a defect audit of
the API, learner store, and Web client. Fixed and covered by tests:

- `pnpm verify` was failing at random. Two filesystem-bound suites land at 5-6s
  against Vitest's 5s default; `testTimeout` is now 20s.
- The HTTP server cached learner stores by path, so `learner restore` and
  `learner reset` left it reading and writing a replaced SQLite inode. Stores are
  now keyed on `dev:ino` and reopen when the file identity changes.
- Any one correct exercise completed the whole lesson and enrolled every card.
  Completion is now the AND over the lesson's auto-gradable exercises, read back
  from the attempt log.
- Attempt, lesson progress, and card enrolment were three independent writes.
  `#transaction` is re-entrant (SAVEPOINT under an outer `BEGIN IMMEDIATE`), so
  the outcome commits or rolls back whole.
- The exercise endpoint returned the reference answer on every response, which
  ends retrieval practice after one wrong guess. It is withheld until the answer
  is correct or two attempts are recorded at that revision.
- Study and lesson loads had no request guard, so a slow response could render
  one lesson's content under another lesson's locator.
- Today gave the due-count metric the wide column and squeezed the review card
  into a 319 px rail.
- `lefthook.yml` and `.github/workflows/docs-check.yml` were missing;
  `doc-gov doctor` now passes with 0 warnings.

## UA Content Gate Receipt (2026-08-04)

Two full UA analyses of the same TuringPact snapshot were accepted as `ready`
and neither was usable. `assertUaGraphComplete` passed both, because it checks
structure — unique ids, no dangling edges, one layer per file-level node, valid
Tour — and neither defect was structural.

- 85% of one analysis's function summaries were template-generated. 964 function
  and class nodes collapsed onto 40 prose skeletons.
- The other silently skipped 56 of 766 files, including `world-runtime`
  scenes, layout, venues, movement, input and performance. Quality metrics
  cannot see this: a skipped file emits no nodes to score.

Built and covered by tests:

- `server/ua/quality.ts` is a pure function with no I/O, consumed both by
  `finalizeUaAnalysis` as a hard gate and by the new `refresh verify` verb.
  One implementation, no second source of truth.
- Coverage compares `fingerprints.json` keys against graph top-level nodes as
  exact set equality. Both files were already read by finalize, so the gate adds
  no I/O. Top-level nodes are identified by `id === "<type>:<filePath>"`, since
  UA emits `pipeline` for `.yml` and `document` for `.md`.
- Template collapse strips code-like tokens and counts distinct prose skeletons.
  Stripping *all* ASCII was rejected: it leaves an empty skeleton for every
  English summary and would permanently reject any `--language en` analysis.
- Analyses gained a `superseded` status, `refresh retire`, and dependency
  refusal with `--force`. The variant mirrors `ready`'s shape so existing
  readers of `graphHash` keep narrowing.
- `evaluateEvidenceFreshness` threw on a non-ready bound analysis, so retiring an
  analysis a course depended on deadlocked the very `refresh audit --apply` path
  meant to mark that content stale. Integrity and authority are now separate:
  `validateEvidence` accepts `superseded`, freshness reports it as a stale reason.

Verified on real data, not fixtures: `refresh verify` exits 1 on the templated
analysis (duplicateRatio 0.968) and 0 on the re-analyzed one (766/766 coverage,
965 distinct skeletons). The templated analysis was retired, then deleted.

A second pass closed two gaps the first one left:

- `refresh verify` needed a merged `knowledge-graph.json`, which does not exist
  until Phase 3, so a long Phase 2 ran unwatched. It now picks its stage from
  disk — graph when the graph exists, otherwise `intermediate/batches.json` —
  and reports per-batch coverage plus cross-batch template collapse. Batches
  with no output yet are `pending`, not failures. Replaying the historical run
  with the repair outputs removed reproduces the incident exactly: 710/766,
  four incomplete batches missing 15, 24, 9 and 8 files.
- Analysis identity is deterministic, and `prepare` threw on any status other
  than ready or preparing, so retiring an analysis made its identity slot
  permanently unusable. Since analysis quality depends on how the host drives
  its subagents — which is not in the identity hash — re-running an identical
  configuration is a legitimate need. `prepare` now allocates `-retryN`,
  resuming an interrupted retry rather than orphaning it.

`pnpm verify` passes at 24 test files / 239 tests.

## SupaLuv Re-analysis Receipt (2026-08-04)

The gate found the same disease in SupaLuv's `ready` analysis
`ua-feeb848f-v294-zh-full`, recorded earlier as covering "all 606 eligible
files": 605 graph nodes against 606 fingerprints, and 936 function and class
summaries collapsing onto 329 skeletons at a 0.80 duplicate ratio, 34 of them
sharing `创建或组装该模块需要的结构化结果与依赖`. The same project's
`legacy-import` analysis was healthy at 0.02, which is what made the defect
legible rather than looking like a property of the codebase.

SupaLuv was re-analyzed at its current HEAD `c9f0ec8d` as
`ua-c9f0ec8d-v2-9-4-zh-full-e98206c7358f1ff1-d0c838f811a5`: 622/622 files,
1579 nodes, 3745 edges, 8 layers, a 12-step Tour, no dangling edges, and every
one of the 622 container nodes assigned to exactly one layer. Template collapse
went from 0.80 to 0.014 — 957 summaries over 948 distinct skeletons. The only
duplicates are genuinely symmetric code: seven one-line getters, and matching
pairs like `stopMusic`/`stopAmbient`. That is the heuristic's known and accepted
false-positive class, and it is why the threshold is 0.30 rather than 0.

The run was watched with the new batch stage rather than throwaway scripts, and
the stage switched from `batches` to `graph` on its own once Phase 3 merged.

The old analysis was retired with `refresh retire`, superseded by the new one.
`refresh audit --apply` moved `founder-engineer` and its `narrative-authority`
unit to `stale`. Every stale reason was `UA node changed` — none were source
level, because the four files its 19 evidence references point to are
byte-identical between `feeb848f` and `c9f0ec8d`. Rebinding is therefore a
revision, not a rewrite: paths and line ranges survive, only the analysis
identity moves.

## Curriculum Reachability Receipt (2026-08-05)

Four courses existed on disk and the web app taught none of them. Three gates
each removed part of the path from content to review queue; together they closed
it. `GET /api/bootstrap` returned `nextLesson: null`, `dueCount: 0`, and one
issue, `supaluv: course: Course is not active`.

`requireActiveCourse` gated every read on `defaultCourseId`, so
`turing-pact` — whose default was `null` — answered 404 for both its courses,
and SupaLuv's `ai-cost-and-boundaries` was unreachable behind a `stale`
default. Due cards were filtered by the same rule, so a card scheduled for a
non-default course never came back. The default now only orders the shelf;
membership is established by the path, since `StableId` rejects traversal in
both `parseRoute` and `getCoursePaths`.

`explain` exercises answered 409 and were excluded from the completion check.
That inverted the problem: five of nine lessons had only rubric exercises, so
they could never complete and their eleven cards were never enrolled. They are
now self-assessed through `POST .../exercises/:id/rubric`, which returns the
rubric only after an answer is submitted, and `create-course` refuses a lesson
that carries cards without an exercise.

Lesson completion was not scoped to the revision it was earned on, so the
`founder-engineer` rebind left the course looking finished with an empty queue.

`founder-engineer` was rebound to `git-c9f0ec8d57a1` /
`ua-c9f0ec8d-...-d0c838f811a5` and reactivated; all four evidence files were
confirmed byte-identical across the two commits before the rebind.

Three courses were added on top of the existing four: `state-and-process` and
`one-codebase-many-hosts` on TuringPact, `generated-assets` on SupaLuv. The
shelf is now 7 courses, 21 lessons, 55 cards, 23 exercises, 149 evidence
references, with no lesson holding unreachable cards. Every evidence line range
was checked against the file at its pinned commit before the proposals were
applied.

Verified in a real browser: the header reports 7 learnable courses, both
studies list all their courses, and a full pass through the previously dead
`explain` path recorded 1/3, then 3/3, completed the lesson, and put its two
cards into the due queue. The learner database was restored to the user's own
records afterwards — the verification run's rows were removed and
`learner backup` re-validated the file.

## Course Editability Receipt (2026-08-05)

Adding content to a published course turned out to be impossible in two
independent ways, both found while trying to enrich `testing-strategy`.

`course revise` read every proposed card and exercise with `readLatestCard` /
`readLatestExercise` and required an `expectedRevision` for each, so a proposal
could only ever restate what the lesson already had — `assertSameIds` rejected
any addition outright. The storage layer never had this limit: the lesson
manifest is revisioned, and the test fixture `addSecondExercise` had been adding
an exercise through the repository functions all along. `expectedRevision` is
now optional and its absence declares the item new; the claim is checked against
the lesson, so an existing ID must carry a revision and a new one must not.
Removal stays refused — dropping a card would strand its scheduled review state
— and the proposal's order becomes the lesson's order. Both the idempotency
check and the resume-aware write loop now treat "absent" as the expected state
for a new item rather than a fault.

The second wall was the lifecycle. `course revise` requires `stale` containers,
and the only producer of `stale` was a freshness audit finding the source had
moved. A course whose evidence was still current therefore could not be edited
at all. `active -> stale` was already a legal transition with no command behind
it; `course open-for-edit` is now that command, and `course reactivate` remains
the only way back with its audit intact. Opening twice is a no-op so an
interrupted edit session resumes.

Proven end to end on a live course: `testing-strategy` was opened, its
`unit-vs-e2e` lesson gained two cards and an `explain` exercise built on
`analytics-privacy-contract.test.ts`, and the course reactivated as fresh. The
shelf is 7 courses, 21 lessons, 57 cards, 24 exercises, 153 evidence references.

## Curriculum Growth Receipt (2026-08-05)

The container limit recorded as an accepted risk in the previous receipt is
gone. `writeUnit` and `writeCourse` go through `createManifestRoot`, which is
create-once — right for creation, but it meant a published course could never
gain a unit and a published unit could never gain a lesson. `updateCourseManifest`
and `updateUnitManifest` now cover the editable window that `course open-for-edit`
opens, and both take their input as `Omit<…, "status">` so a manifest update
cannot become a back door around the status transition table.

`course add-lessons` adds lessons to a course that is already published, into an
existing unit or into a new unit created alongside them. Its lesson shape is the
schema `course create` uses, extracted to `server/workflows/lesson-proposal.ts`
along with the code that writes a lesson bundle, so a rule like the
cards-need-an-exercise refinement cannot hold at one entry point and not the
other. `create-course.ts` was rewired onto the shared module with its nine tests
unchanged, which is what makes the extraction a refactor rather than a rewrite.

Reactivation used to refuse a `draft` unit, because the only way to get one was
an interrupted `course create`. A unit added to a published course is legitimately
draft, so the check now refuses only `retired`: the real gate is the freshness
audit plus `assertUnitReadyForActivation`, which walks every lesson, card and
exercise and re-checks its evidence, and a half-built unit fails those.

Writes go declaration-first — course names the unit, unit names the lesson, then
the lesson is written — because that is the order every reader walks. An
interrupted run therefore leaves a declaration pointing at missing content, which
makes reactivation fail loudly rather than leaving a course that looks whole;
re-running the same proposal completes it.

Proven on the real curriculum: `testing-strategy` grew a third lesson,
`retry-safety`, built on `degraded-idempotency.test.ts` — the idempotency debt
that the previous lesson's retry affordance creates. The shelf is 7 courses,
22 lessons, 62 cards, 26 exercises, 164 evidence references.

`scripts/dev.mjs` also stopped being hostile on a taken port. Two `pnpm dev`
sessions at once produced an unhandled `EADDRINUSE` error event and an endless
restart loop with a Node stack trace. It now probes both fixed ports first and
prints which process holds them and how to end it. Vite gained `strictPort` for
the same reason: silently moving to 5174 would leave the campus at an address
nobody bookmarked.

## Zero-Basics Tier Receipt (2026-08-06)

The shelf held seven courses that all assumed the reader could already read
TypeScript, knew what async meant, and had seen React. The owner could not
start. There is now a tier under them: 认识地形 · 读懂一行代码 · 读懂一段逻辑 ·
等待与失败 · 界面是怎么长出来的 · 数据从哪来 · 怎么知道没写错 · 代码之外 —
24 units, 98 lessons, 294 cards, 157 exercises, 679 evidence references. The
whole shelf across both studies is 15 courses, 120 lessons, 356 cards,
183 exercises.

Every lesson, card and exercise carries at least one evidence reference, and
the schema means it. A lesson on "what is a variable" therefore cannot exist:
it has nothing to cite. Rather than exempt the tier from evidence — which would
have removed the only property that makes this system worth trusting — the
basics are taught through the smallest real files in TuringPact. `src/ui/utils.ts`
is three lines and one function, which is a better place to learn what a
function is than any invented example, and the same files come back in the
formal courses as old friends instead of new material.

Generation was Grok's, seven isolated worktrees in parallel, one per stage.
What made the output usable was not the model but the briefs: each named the
exact files, their line counts, and what each one could teach. Two mechanical
gates carried the review, because 294 cards is past what reading can check —
`check-proposal-evidence.mjs` resolves every citation against the real file at
its pinned commit, and the new `check-proposal-shape.mjs` checks what the schema
cannot: duplicate ids, the six-section lesson skeleton, an evidence note on
every reference, and answers short enough for a normalized comparison to be
fair. A third, throwaway audit compared every quoted code line against the
cited files; 24 of 441 differed and all 24 were legitimate abbreviations.

Import surfaced a boundary worth recording: the UA knowledge graph indexes 572
files and none of the build configuration. Evidence pointing at `package.json`
or `.env.example` had to drop `analysisId`/`graphHash`/`nodeIds` and rest on the
git snapshot alone, which is still a complete binding. `course create` rejects
a fabricated node, which is how this was caught rather than shipped.

Two defects fell out of putting the tier in front of a learner:

- **Focus pinned one course, but a focus is a route.** Finishing the pinned
  course dropped the walk back into alphabetical order, which would have handed
  a beginner `contracts-and-drift` next. `focus.courseIds` is an ordered list
  now; unnamed courses keep their own order behind it.
- **A dev-server restart made the campus look broken.** The API mints its
  request token per process, so any server edit left an open tab unable to
  submit, saying only "Missing or invalid UniversityLocal request token". The
  tab now pulls a fresh bootstrap and says one more click will do it. The repair
  goes through a refresh-only callback: the completion callback would have
  marked the lesson 已完成 on a submission that never reached the server.

Renaming the focus field also proved that a strict config read at startup can
brick the tool it configures — the failing key stopped the whole CLI, including
the `focus set` that would have repaired it. A focus only reorders what today
reaches for first, so an unreadable one is reported and ignored rather than
fatal.

Verified in a real browser against a deliberately restarted API: 今日学习 opens
on 《认识地形》, the evidence rail shows the note and the copy-location button
for a config file with no UA binding, the first submit explains the stale token,
the second submits, and the lesson does not falsely complete.

## Self-Study, Language and Expression Receipt (2026-08-06)

Four capabilities landed together, plus one repository defect that had been
hiding since the beginning.

**The repository could not be cloned into a working state.** `.gitignore`
carried an unanchored `studies/` rule, written for the personal campus data at
the root. Git matches an unanchored directory name at any depth, so it also
swallowed `server/studies/` — `paths.ts`, `repository.ts`, `snapshots.ts` and
two test files, imported by around twenty modules including the CLI and the HTTP
server. Five source files had never been committed. Nothing reported it, because
ignored files do not appear in `git status`, and oxfmt reads `.gitignore` too, so
the module had never been linted or format-checked either. The rule is now
`/studies/`; a fresh clone was taken to a scratch directory and typechecks
clean, which is the only form of proof that counts here.

**Self-study through an airlock.** `assertSeparatedRoots` exists so a study can
never write into its own subject. Studying this project meant either weakening
that guard or working around it. Neither: a sealed read-only checkout of one
exact commit lives outside both the live repo and `studies/`, fetched a single
commit at a time rather than cloned, with the seal in `.git/` so the checkout
stays clean enough to pass its own tamper check, and identity taken from the
root commit rather than a path a person can delete and refill. The import gate
refuses rather than skips: a repository that really does track a secret is a
problem the owner has to see, and `.gitignore` is no help for a file already
tracked.

**Foreign-language reading layer (first cut).** Authored overlays live in a
parallel tree keyed by both `contentRevision` and a content hash, so turning the
layer on cannot bump a revision or invalidate completion / FSRS. Two locks keep
anchors out of code — server protected-region check, and a plugin that only
visits text nodes. Lexicon is sense-keyed, not spelling-keyed. Popover speech is
local-only (`localService === true`). **Extended 2026-08-07:** the layer is now
composed (authored + detection); see the Pedagogy And Reading Layer receipt
below — do not re-implement detection from this paragraph.

**Expression coaching.** The same packet-to-any-host shape as exercise grading,
with one deliberate difference: it ends without a write-back command. Coaching
changes nothing structurally, and a packet that auto-saves would make the
learner perform for the coach. Saving stays an explicit `capture`.

**Content.** Five courses applied and re-verified on this branch rather than
trusted from the worktrees they were drafted in: a 41-lesson tier below the
zero-basics tier, two courses on how this campus itself works, a four-layer
course rebound onto real code, and eight lessons on writing requests an AI can
execute. The superseded `ul-meta` study was archived rather than deleted —
`study archive` keeps every course, snapshot and learner row and only drops the
study out of the three places the shelf is enumerated.

Two tools were wrong in the same way and were fixed rather than worked around.
`check-proposal-shape.mjs` hard-coded "at least 8 lessons" from one campaign's
brief and failed a course that is correctly four lessons, demanding filler to
satisfy a number unrelated to the content; length is a `--min-lessons` flag now.
And `lexicon.ts` located its data file by counting relative directory hops,
which was right in one of the two runtimes it runs under and wrong in the other;
it walks up to `package.json` instead.

Verified: 348 tests across 33 files, full `pnpm verify`, a fresh clone that
typechecks, and a browser pass confirming word anchors render as buttons with a
working popover while code blocks stay untouched.


## Pedagogy And Reading Layer Receipt (2026-08-07–08)

Six product surfaces landed after the 2026-08-06 language cut. Agents must not
rebuild them from research notes under `docs/reference/下一阶段/`.

**Foreign-language layer is derived, not hand-authored-only.**
`server/language/detect.ts` finds lexicon headwords already present in lesson
prose (no stemmer; small inflection table; never inside code).
`server/language/layer.ts` composes authored overlays first, then fills the
learner budget with detection. `adaptiveTargetCount` starts at 3 and saturates
at 12 as the learner retires words. Retired words render dimmed and cost no
budget. A stale overlay degrades to a derived layer instead of nothing. UI
label is **外语模式** (default off). Lexicon gaps:
`scripts/vocabulary-coverage.mjs`. Optional authored overlays remain via
`pnpm university language annotate`.

**Cross-lesson links.** `[[lesson:id]]` or `[[lesson:course/unit/id]]` with
optional label, resolved server-side in `server/content/lesson-links.ts`.
Broken links are loud. Backlinks and an in-session return stack are in the Web
reader.

**Inline evidence anchors.** `[[evidence:path:line]]` in
`server/content/evidence-anchors.ts`. Valid only inside a range the lesson
manifest already cites; outside that range renders broken on purpose.

**Lesson teaching shape.** Operation contract:
`.agents/skills/write-lesson/` (five variants: 现象 / 对比 / 溯源 / 决策 / 术语).
Research rationale only: `docs/reference/lesson-pedagogy.md`. Optional
`variant` on `LessonManifestSchema` — absent means predate the shapes.

**Mechanical gate.** `scripts/lint-lessons.mjs` (`pnpm lint:lessons`) enforces
the machine-checkable half of the skill checklist and runs inside
`pnpm verify`. Lessons without `variant` are skipped.

**URL addresses.** `src/url-state.ts` — lesson paths parse on load, push on
navigation, restore on popstate. Not a router library; ~80 lines of
parse/format until a later component split.

**Tips / glossary.** `src/Tip.tsx` + `src/glossary.ts` — single glossary so
jargon (FSRS, 外语模式, REV, …) cannot mean two things on two screens.

Do not invent a second language annotator, a second lesson template, or a
router package on top of these without a new bounded decision.

## Accepted Risks

- **The API request token does not defend against other local processes.**
  `GET /api/bootstrap` hands the token out unauthenticated, so anything running
  as the same user can obtain it. That is deliberate and not a gap: the same
  process could read `studies/` directly, so a token cannot be the boundary
  there. What it does defend against is a web page in the browser — combined
  with the loopback `Host` allowlist, the loopback `Origin` check, the
  `application/json` requirement and a timing-safe comparison, it blocks
  cross-site requests and DNS-rebinding, which is the threat a local server
  actually faces. Adding OS-level authentication would only be warranted if
  UniversityLocal ever stopped being single-user and local-only, which the
  product boundary says it will not.

## Open Questions

- **Card schedule across content revisions.** `ensureCard` carries FSRS state
  forward when a card's `contentRevision` advances, and
  `rebuildCardStateFromReviewEvents` encodes the same rule, so the projection
  survives a rebuild. The cost is that a card due far out will not show
  rewritten text until that due date arrives. Changing the policy is not a
  projection edit — a reset would be undone by the next rebuild — it needs the
  reset recorded as an event in the append-only log. Decide whether that is
  worth a schema migration before the course content starts being revised
  regularly.
- **Nothing grades an answer except a host.** Every exercise kind now records
  the learner's answer at score 0 and waits for host write-back. The normalising
  string comparison that used to decide short answers is gone, along with the
  question of accepted-answer lists that only existed to patch it — a host
  reading the reference answer handles synonyms without a grader heuristic that
  could start accepting genuinely wrong responses. The open question this
  replaces it with is availability, not fairness: an exercise cannot complete
  while no host is around to grade it, and whether that is acceptable in normal
  use has not been tested across a real week yet.

## Completed Proof History

Completed plans and specs live in:

- `docs/plans/completed/`
- `docs/specs/completed/`

Do not move completed work back into active. Create a new plan and link the completed record as provenance.
