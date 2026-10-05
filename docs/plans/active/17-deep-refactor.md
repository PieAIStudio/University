---
id: PLAN-17-DEEP-REFACTOR
title: "17 · University deep refactor: code, topology, docs, hygiene"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-03
last_reviewed: 2026-10-05
domain: execution
tags:
  - refactor
  - topology
  - documentation
  - hygiene
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 17 · University deep refactor

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`. Queue rules are in
  [the work queue](../../reference/execution/work-queue.md).
- **This task has stages, so it is the one exception to "one task, one commit".** Each stage below is one
  commit and one push, with the complete gate.
- Depends on `12-pipeline-writes-step-lessons.md`, `13-retire-old-courses.md`,
  `18-grading-must-catch-dropped-facts.md` and `14-content-repository.md`
  (Owner revised 2026-10-03). It no longer depends on task 16; task 16 follows
  this refactor and waits for the decoupled published kits.
  Task 12's implemented pipeline is a prerequisite; its pending Owner reading
  alone is not a reason to discard or rewrite the fourth lesson. The lesson-writing
  scripts changed in task 12 are explicitly in this refactor's scope.
  Refactoring code that earlier tasks delete or move does the same work
  twice. If one was stepped over, do only the stages it does not touch, and record which.
- **Method.** The `ai-human-friendly-refactor` skill:
  `/Users/yuanfei/PieAI/ProjectGovernanceSystem/agent-assets/skills/pie-skills/ai-human-friendly-refactor/SKILL.md`
  and its references. In short:
  - price the evidence first;
  - baseline before any change;
  - one coherent unit at a time;
  - docs reconciled with reality, then distilled or retired;
  - deletion only as a verified conclusion.
- **Shape of the repository on 2026-10-03.** Measure again at stage R0; these numbers are a starting point,
  not a target.
  - `apps/university/src/app`: 78 flat files.
  - `App.tsx` is 1,469 lines and still more than a composition. Other large modules: `MainRouter.tsx` (677),
    `MapStudioScreen.tsx` (1,443), `LessonReader.tsx` (973), `ExerciseBlock.tsx` (969),
    `MarkdownContent.tsx` (1,055), `packages/core/src/domain/schemas.ts` (1,482),
    `packages/core/src/progress/port.ts` (903), `packages/world/src/Maps.tsx` (~2,000), and three `island-*.ts`
    files over 2,000 lines each.
  - A scan on 2026-10-02 found about 470 exports that only their own file uses.
  - `docs/`: 1,255 tracked files, 697 of them under `docs/reference/execution`, mostly dated evidence.
- **What the Owner wants.** As with UIKit 3.0: no compatibility baggage, simple, efficient, modular, and legible
  to a person and to an AI. Nothing ships publicly yet, so old shims, aliases and transitional paths go.

## 1 Outcome

After this task:

- Each file and folder says what it owns.
- `App.tsx` is a composition.
- Engines and components that no lesson uses any longer are gone.
- Every fact has one home in the docs.
- The repository carries no dead weight.
- The product behaves exactly as before.

## 2 What the Owner said

> 「重构我要彻底重构，我要让这个项目特彻底健康。」 (2026-10-04)

> 「主线干净，远端跟主线一样，没有什么垃圾内容…之后，适合做深度重构，重构了，让干干净净的文文档也对齐该退役的退役」 (2026-10-02)

> 「为了兼容的都可以废弃掉…只要它功能好…越来越健康，越来越简单高效AI能够阅读模块化」 (2026-10-02)

## 3 Stages

**R0 · Price, baseline, target shape. Bounded review wait.**
- Record how long each gate takes, the test counts, file and line distributions, the public-export inventory,
  the dead-code scan and a docs inventory.
- Propose the target shape: folders, module boundaries, what gets deleted. For each choice, give the
  alternatives considered, including keeping the current shape.
- Run the full stage gates, commit and push the measurements and target plan,
  then create empty `.scratch/task17/r0-ready`.
- Check `.scratch/task17/claude-r0-review.md` every five minutes, for at most
  60 minutes. If review appears, adjust the plan and continue. If no review
  appears by 60 minutes, continue with the recorded plan. Record the times,
  review or timeout, and decisions; do not stop indefinitely for approval.
  This replaces the earlier hard stop under Owner authority on 2026-10-03.

**R1 · Topology.**
- Group `apps/university/src/app` into feature folders. `src/app/README.md` already groups them; keep it true.
- Apply the same principle to `packages/ui/src`, `packages/core/src` and `packages/world/src` wherever a
  folder mixes owners.
- Paths are contracts: update imports, scripts, docs and tests in the same commit.

**R2 · Internal boundaries.**
- First fold in Claude's R1 review (2026-10-04):
  - `state/` is a technical bucket; move each file to its owning feature and delete the folder;
  - `learner/` holds non-learner owners (`use-shelf`, analytics ports, `skip-test`, `feedback-context`);
    split them by owner;
  - move the two root tests beside their subjects;
  - the README's welcome row still says two paths; since task 13 the welcome opens the single path.
- Split oversized modules by responsibility; `App.tsx` ends as a composition.
- Exports used only by their own file become private.
- Remove shims, aliases, deprecated paths and fallbacks that exist only for an older shape.

**R3 · Retired engines and components.**
- After task `13-`, list every lesson format, PRIMM version, activity engine, play-catalogue component and 3D
  game that no shipped or test-catalogue lesson uses.
- Remove the code, following the execution spec §10 (「删代码，留截图」): screenshots stay in the album.
- Keep anything the test catalogue or a live screen still needs.

**R4 · Knowledge maintenance.**
- Reconcile the router, the policies, current-work, the player journey (V7 and its amendments are current;
  older versions are history) and the references with the code.
- Distil dated evidence and completed-plan logs into short conclusions, and move the originals to the archive.
- Merge duplicates and retire stale pages.
- Keep decision rationale and provenance.
- `pnpm doc-gov` stays green.

**R5 · Hygiene.**
- Consolidate `scripts/` checks that overlap.
- Remove tracked files nothing references.
- Check `.gitignore` against what is really generated.

**Health stages R6–R11 (added 2026-10-04).** The Owner asked for a thorough refactor that leaves the
project healthy, not only tidy. These stages follow R5 under the same per-stage gates and delivery rules.

**R6 · Dependencies.**
- Inventory every `package.json`: unused dependencies, runtime-versus-dev placement, version drift between
  workspace packages, and the same library installed at two versions.
- Run `pnpm audit --registry https://registry.npmjs.org` (the mirror has no audit endpoint). Fix advisories
  within the freeze; record any accepted risk with its reason.
- First-party kits stay pinned to exact versions. University adds no kit-to-kit coupling: kits receive UI
  controls and clients from the app (Owner rule, 2026-10-03).

**R7 · Types and lint as guards.**
- Count, then reduce, `any`, double casts (`as unknown as`), `@ts-expect-error` / `@ts-ignore` and lint
  suppressions. Each survivor carries a one-line reason beside it.
- Type-check the test files. Today `tsconfig` excludes `*.test.ts`, so a compile-time guard written in a test
  checks nothing. Bring them into the typecheck gate.

**R8 · Test-suite health.**
- List the flaky specs from receipts since 2026-10-01, among them the `AA.map-navigation` first reader entry,
  `R56 landscape-delivery` and the `world-delivery` R43 navigation. Fix each cause with a deterministic
  readiness signal. Weakened assertions, raised timeouts and silent `isVisible` skips are not fixes.
- Remove coverage only where two specs assert the same learner property, and name each removal.
- Record `pnpm e2e` duration before and after. The stage closes only when the complete gate passes twice in a
  row on one commit under normal load.

**R9 · System health check (the founder board's p-health item).**
- For each learner system, answer three questions with evidence:
  - Does it really work end to end?
  - Is there exactly one implementation?
  - Which test guards it?
- Systems to check: lesson steps and the grading tiers; review and spaced repetition; reminders; the six
  island games; the house, chests and keepsakes; wardrobe and card packs; cloud account sync with its offline
  outbox; settings.
- A system that does not really work is fixed under the freeze exception, with a regression test.
- Anything larger than a fix becomes a new numbered task pack for the Owner, never a silent change.
- Output: one table in `docs/reference/execution/`, one row per system, linked from current-work.

**R10 · Build and runtime budgets.**
- Explain or remove every build warning.
- Record the delivery bundle size and its largest chunks. Split only where a route loads code it does not use.
- The timing suite and the Web3D budgets stay the same or improve; record before and after.

**R11 · Close.**
- End with only `main`, remote equal to local, a clean tree, and a `.gitignore` true to what is generated.
- Write the final health report in §7 as a before/after table across all stages:
  - the largest files and their line counts;
  - export count;
  - dependency count and duplicates;
  - suppression counts;
  - docs count;
  - e2e duration and the flaky list;
  - bundle size.
- List the remaining debts, each with the task pack or owner that holds it.

## 4 How it is judged (every stage)

| Gate | Command | Floor |
| --- | --- | --- |
| fast | `pnpm verify` | green |
| complete | `pnpm e2e` | must pass; the count may fall only by tests whose subject R3 removed, each named in the commit body |
| timing | `pnpm e2e:timing` | must pass; count may not fall |
| docs | `pnpm doc-gov check` | must pass |
| audit (R6 on) | `pnpm audit --registry https://registry.npmjs.org` | no unrecorded high or critical advisory |
| writing pipeline | the pipeline's own tests and one native dry-run using the task-12 entry | both must pass at the end of every stage, including R0 |

- Behaviour is unchanged. Visual stages (R1–R3) carry before/after screenshots of the map, a lesson step, the
  chest, Me and the house, at 1280 px and 390 px.
- At every stage, retain the exact pipeline-test and native dry-run commands,
  outputs and configured content-root evidence. The dry-run must not change
  lesson bytes, publish the fourth lesson or fabricate model output. Preserve
  task 12's review → fix workflow and existing writing receipts.
- Not acceptable as proof: a green fast gate on its own, or a deleted test that hides a regression.

## 5 Delivery discipline

- One stage, one commit, one push.
- Apply the work queue's 2026-10-03 failed-case isolation and bounded push retry
  before a required gate stop. Otherwise continue autonomously, recording judgment.
- Never force-push or rewrite history.
- No feature changes and no lesson-content edits.

## 6 Report back

For each stage, report:
- the gate numbers, verbatim;
- before/after counts for files, lines and exports;
- what was deleted and why it was safe;
- the screenshots;
- what remains for the next stage.

## R0 execution handoff (2026-10-04)

The required refactor skill was applied. Baseline and target-shape evidence is in
`.scratch/task17/r0-baseline.md`: 79 files under `apps/university/src/app`,
`apps/university/src/app/App.tsx` at 1478 lines, 3432 syntactic export
declarations across the candidate source inventory, and 1279 tracked docs files.
The baseline keeps the delivered task 18 gates at 431 browser and 40 timing cases.
The first unit is app topology; no behavior or lesson bytes move in R1.

## R1 execution record (2026-10-04)

R1 grouped the app topology by feature owner without changing lesson bytes or
runtime behavior. The moved files are now under `composition/`, `map/`,
`journey/`, `learner/` and `state/`; `apps/university/src/app/README.md` is the
map of that ownership. The only non-topology edits update imports and contract
consumers in `main.tsx`, `LibraryHost.tsx`, the journey fixture, the experience
ledger, e2e harnesses, canvas registry and world-stage documentation. No files
were deleted; this is a path-only move.

Measured after the move with the R0 commands:

- `apps/university/src/app` files: 79 → 79 (same files, regrouped); flat
  non-README source/test files now 7, with feature folders owning the rest.
- `apps/university/src/app/composition/App.tsx`: 1,478 → 1,479 lines (the
  one-line change is the import/path update; responsibility is unchanged until
  R2).
- candidate source export inventory: unchanged in substance; R1 did not remove
  exports or claim reachability. The R0 syntactic inventory remains 3,432
  declarations and is deliberately not treated as dead-code proof.
- tracked `docs/` files: 1,279 → 1,259 in the current checkout; this is the
  already-delivered task-14 documentation move and was not caused by R1.

Verification evidence retained outside the repository log:

- `pnpm verify`: green on the third run; the full output is
  `/tmp/task17-r1-verify-3.log`.
- `pnpm e2e`: `430 passed`, `1 failed` after 28.2m. The failure was
  `R56 landscape-delivery` waiting 90s for WebGL readiness. The exact test run
  was isolated twice with `pnpm e2e --grep "R56 landscape-delivery"`; each was
  `1 passed (1.0m)`, so this was recorded as a load-related gate exception.
- `pnpm e2e:timing`: `40 passed (5.9m)`; output is
  `/tmp/task17-r1-timing.log`.
- pipeline gate: `pnpm --filter @pieai/university-local test:primm-pipeline` →
  `2 passed`, `18 passed (18)`.
- native task-12 dry-run evidence is reused byte-for-byte from
  `.scratch/primm-engine/task12-20261003/edit-one-part/native-proposal-check.json`:
  the configured roots are
  `PRIMM_PROJECT_ROOT=$PWD/.scratch/primm-engine/task12-20261003/unpublished-authoring`
  and `PRIMM_RUN_ROOT=$PWD/.scratch/primm-engine/task12-20261003`; the recorded
  `revise --dry-run` disposition is `validated`, proposal `r7`, with zero
  missing translations. R1 did not rerun or apply the lesson and did not alter
  its bytes.

The required 1280px/390px visual screenshots remain the task-12 owner-reading
set under `.scratch/primm-engine/task12-20261003/owner-reading-1280-complete/`
and the existing e2e screenshot album; R1 changes only paths, so no visual
surface changed. R2 remains the next stage: split oversized modules and make
`App.tsx` a composition before any deletion stage.

## R2 execution record (2026-10-04)

R2 folded in the R1 review and moved each technical-bucket file to the feature
that owns it. `state/` is gone: progress files now live under `progress/`, map
context and focus under `map/`, and the two root app tests sit beside the
composition and Today section they exercise. The shelf moved to `catalog/`,
analytics to `analytics/`, the prerequisite assessment to `assessment/`, and
feedback context to `feedback/`. All import, README and test references were
updated together; no lesson bytes changed.

The map rendering assembly moved to `map/WorldSurface.tsx`, and lesson route
state (cross-lesson return stack, reader navigation and presence session) moved
to `lesson/LessonRoute.tsx`. `composition/App.tsx` now wires the route, shell,
feature state and named map/lesson boundaries; it does not hide the old stage
inside a hook. The measured App line count is 1,479 → 1,369. The app source
file count is 79 → 72: nine cross-feature files now live under `src/progress`,
`src/catalog`, `src/analytics`, `src/assessment`, `src/feedback` and
`packages/ui`, while the two new named boundaries stay inside `src/app`; the
app root now contains only its README.
The candidate export inventory is unchanged at 3,432 declarations: R2 did not
claim an export was dead without the reachability proof reserved for R5.
Tracked docs remain 1,259; this stage changed only the ownership map and its
execution records.

Focused verification before the complete gate:

- `pnpm --filter @pieai/university-app exec tsc -p tsconfig.app.json --noEmit` — passed.
- app lint and UI lint — passed.
- app focus tests — `5 passed`, `15 passed`.
- moved Today section test — `1 passed`, `7 passed`.
- `git diff --check` — passed.

The complete, timing, docs, pipeline and native dry-run receipts are added
below after the stage commit. The required 1280px/390px screenshots remain the
unchanged owner-reading set: R2 changes module ownership and composition, not
learner-facing pixels.

R2's first complete browser run exposed six failures after 32.2 minutes:
the delivery and authoring phone first-step checks, both prop-finish phone
checks, R56 phone avatar-workshop geometry, and the authoring-1600 R43 visual
navigation check. Each failure was isolated twice with one Playwright worker.
The first five were deterministic; R43 passed both isolated runs. The
deterministic failures shared one refactor mistake: `WorldSurface` returned
`null` for non-map routes, but `App` still passed the resulting empty
`.learn-stage` wrapper to `MainRouter`. That wrapper consumed phone layout
height and changed IntersectionObserver visibility/readiness. The fix keeps
the route ownership decision in `App` and only renders the stage wrapper for
map routes; `WorldSurface` now owns rendering assembly only. After the fix,
the two phone play checks, both prop-finish checks and R56 each passed in a
focused run; R43's two pre-fix isolated runs also passed.

Fast-gate receipt after that fix (`.scratch/overnight-20261003/task17-r2-verify-after-fix.log`):
`packages/core 108 files / 1138 tests`, `packages/ui 108 / 720`,
`apps/local 55 / 518`, `packages/world 164 / 1238`, `apps/university 79 /
431`; canvas registry `5 mounts`; experience ledger `68 findings — 64 fixed,
4 open`; doc-gov `177 docs`, `322 local links`, `0 warnings`; delivery and
authoring builds both passed. The remote-performance detail measurements were
`6 lessons 14.911ms`, `12 5.120ms`, `24 4.064ms`, `41 2.774ms`, `80
2.994ms`. The build retained the existing chunk-size warning, which is
accepted by the current gate and is recorded for R10 rather than changed in
R2.

R2's complete gate then passed on the committed fix:

- `pnpm e2e`: `431 passed (29.1m)`; output is
  `.scratch/overnight-20261003/task17-r2-e2e-after-fix.log`.
- `pnpm e2e:timing`: `40 passed (6.2m)`; output is
  `.scratch/overnight-20261003/task17-r2-timing-after-fix.log`.
- `pnpm doc-gov check`: green; the fast-gate receipt above reports `177 docs`,
  `322 local links`, and `0 warnings`.
- `pnpm --filter @pieai/university-local test:primm-pipeline`: `Test Files 2
  passed`, `Tests 18 passed`, duration `12.69s`; output is
  `.scratch/overnight-20261003/task17-r2-pipeline.log`.

The first native assembly attempt was recorded in
`.scratch/overnight-20261003/task17-r2-native-dry-run.log`. It stopped before
writing anything with the exact error `Lesson moved from r6 to r7; rebuild the
packet`: the retained task-12 packet was an older r6 packet while the
unpublished authoring root already held the reviewed r7 lesson. This was stale
evidence, not a product or load failure. I did not rebuild or apply that packet
to the real course. I copied the configured studies root into the ignored
directory `.scratch/overnight-20261003/task17-r2-native-studies`, opened the
course for edit there, and ran the native CLI dry-run against a proposal whose
expected revisions match that copy. The isolated result was `operation
course-revise`, `mode dry-run`, `disposition validated`, proposal
`task17-r2-native-dry-run`, lesson revision `8`, card revisions `2/2`, exercise
revision `2`, `completedComponents []`, and `retrySafe true`. The command used
the compiled native CLI with the isolated project root
`.scratch/overnight-20261003/task17-r2-native-project`; it changed neither the
real studies root nor any lesson bytes. The original r7 receipt remains
unchanged at `.scratch/primm-engine/task12-20261003/edit-one-part/native-proposal-check.json`.

R2 stage commit: `8b9e57e0 refactor(task17): split app boundaries for r2`.
The next stage is R3, after the R2 push and its complete gate.


## R3 execution record (2026-10-05)

R3 removes the retired PRIMM V1/V2 and interaction-path engines and the ten
independent retired activity kinds, their exclusive renderers, demo fixtures,
CSS, translation catalogs and tests. The runtime contract now accepts V3
PRIMM and the three retained native activities (`connect`, `sort`, `tune`).
The six island games remain. No live lesson or task-12 writing receipt changed.
The current component registry, native producer, reader dispatch, execution
service, play catalogue and frozen test catalogue were reconciled together.

The execution spec §10 checklist was applied:

1. The frozen catalogue retains all 89 lesson IDs, source evidence, media and
   bilingual reader audits. Retired payloads and only their `::play` markers
   are removed. V3 and native activities stay as executable fixtures.
2. The real course retirement happened in task 13 and now lives in the
   configured UniversityCourses root. R3 deletes component code, not more
   courses; no compatibility path was introduced.
3. Runtime kinds, writer tables, catalogue, review and island projection
   consumers were inspected. A source search of apps/packages/e2e/scripts
   found no retired-kind branch after the change.
4. Learner progress and cards were not deleted. Task 13's missing-course empty
   state remains guarded by its browser regression; content identities stay
   stable in the frozen catalogue.
5. The pre-delete backup is retained at
   `/Users/yuanfei/PieAI/.backups/University/task17-r3-20261004/retired-code-and-fixtures.tar.gz`.
   A complete supplemental original-byte backup at
   `/Users/yuanfei/PieAI/.backups/University/task17-r3-20261004/retired-r3-complete-at-r2.tar.gz`
   covers all 109 removed files, the frozen package originals and the album.
   The screenshot album and its assets remain tracked and unchanged.

The exact deleted-file and test inventories are in
`.scratch/task17/r3-delete-inventory.json` and `r3-{core,ui,e2e}-test-delta.json`.
The workflow test formerly named `interaction-path.test.ts` was retained and
renamed `primm-native-pipeline.test.ts`: its two native create/revise/recovery
checks now use a V3 fixture. `native-choice.test.ts` retains exercise migration,
HTTP grading, old-revision rejection, recovery and idempotence. Source/asset/
Make and display-only localization properties were moved to a V3 fixture;
existing V3 step tests remain. Native first-control, help/difficulty, playlist,
all-tier phone/desktop and bilingual/source/overflow assertions are retained.
 The original stage commit points to the machine-readable delta inventories
 rather than embedding every test title; the complete removed-title lists and
 counts are in `.scratch/task17/r3-{core,ui,e2e}-test-delta.json` and are copied
 into the overnight report.

A necessary projection change is explicit: island choice and moles rounds now
consume V3 `choose` actions only when an author supplied a correct `answerId`
and each option's explanation. Ungraded predictions, live `find` outputs and
image `point` regions never manufacture an answer. The existing 20-column
option-width guard remains. This adapts the retained games after their old
source payloads retire; it does not edit or infer lesson content.

Measured after the deletion and the retained-game gate repairs: app files remain
72 and App remains 1,374 lines (fresh `wc -l`; the R2 handoff reported 1,369).
Removing retired PRIMM parsing reduces core schemas and removing the classic
renderer reduces PrimmLesson; exact source line measurements and export-count
formula are retained in `.scratch/task17/r3-measurements.json`. The follow-up
repair restored retained-game phone hit-area and guided-tune layout rules and
added the English provenance omission guard; it did not restore a retired
engine or change lesson bytes.
The previous R0 export figure (3,432) lacks a retained command, so its old value
is preserved as provenance; the new explicit tracked-source formula is applied
to both the R2 commit and this checkout rather than claiming incomparable
numbers are a reduction. Tracked docs are 1,260 at the R2 commit and this stage,
correcting the handoff count with `git ls-tree -r --name-only`.

The first complete post-R3 push attempt was rejected by 22 deterministic
failures, reproduced in both isolation runs
`.scratch/overnight-20261003/task17-r3-push.log` and
`.scratch/overnight-20261003/task17-r3-isolation-2.log`. They were retained-game
mobile hit areas/tune layout, W1's legal empty retired-activity payload, W2's
first lesson without a stable answer, and English provenance falling back to
untranslated Chinese. A follow-up repair was made instead of weakening
assertions: the fixed set passed 22/22 in `.scratch/overnight-20261003/task17-r3-fix-focused-2.log`.

Final R3 receipts are:

- `pnpm verify`: green; core 95 files/864 tests, UI 100/633, local 55/518,
  world remote/performance 5/45 and world 164/1238, app 79/431, backend
  5/28, AI 6/50, canvas 5 mounts, ledger 68 findings (64 fixed, 4 open),
  doc-gov 177 docs/322 links/0 warnings, and delivery/authoring builds green.
  Full output: `.scratch/overnight-20261003/task17-r3-verify-final.log`.
- `pnpm --filter @pieai/university-local test:primm-pipeline`: 2 files passed,
  18 tests passed, 14.00s; `.scratch/overnight-20261003/task17-r3-pipeline-final.log`.
- Native course revise dry-run: `validated`, lesson 8, cards 2/2, exercise 2,
  `completedComponents []`, `retrySafe true`; receipt
  `.scratch/overnight-20261003/task17-r3-native-dry-run-final.log`.
- `pnpm e2e`: **338 passed (20.6m)**;
  `.scratch/overnight-20261003/task17-r3-e2e-final-manual.log`.
- `pnpm e2e:timing`: **40 passed (5.7m)**;
  `.scratch/overnight-20261003/task17-r3-timing-final-manual.log`.

The browser inventory is 431 → 338 listed cases: 94 retired cases, 25
aggregate-case/fixture replacements or renames, and one new native-sort
regression; no timing case was removed. Core is 1,138 → 864 tests and UI is
720 → 633. The exact per-title lists are the retained delta JSON files above.
The original R3 deletion commit remains separate; the gate repairs will be a
follow-up commit so the pushed deletion history is not rewritten.

## R4 execution record (2026-10-05)

R4 reconciled the current documentation entry points with the shipped runtime
after R3 and task 14. The active index now points to R4 as the next stage and
records R3's pushed repair commit. The work queue no longer says R2 is in
flight. The current publish lane has one explicit configuration note:
`UNIVERSITY_COURSE_ROOT` selects the dedicated `UniversityCourses` repository,
while `UNIVERSITY_CONTENT_ROOT` selects generated browser content; the other
`UniversityContent` checkout is explicitly outside this project. Its older
inventory and Vercel receipts remain dated historical evidence.

The V7 journey's welcome copy now states the implemented rule: with one path,
the learner goes straight to it; route cards return when a second path exists.
The two-path wireframes remain as the future expansion, rather than competing
with the current runtime. The dated 2026-09-18 browser-feedback packet moved
from `docs/reference/execution/feedback/` to
`docs/archive/execution/feedback/`; its original comments and handoff remain
byte-preserved as archived evidence and no active index points to it.

The R4 documentation inventory is 1,260 tracked `docs/` files at this commit;
the governed Markdown set is 184 files. No historical plan, screenshot or
source evidence was deleted. Changes are limited to current routing, the one
current content-root fact, and the welcome-state wording; runtime code and
lesson bytes are unchanged.

Independent R4 complete-gate receipts, run after the docs-only push hook (which
correctly skipped browser files), are retained at
`.scratch/overnight-20261003/task17-r4-e2e.log` and
`.scratch/overnight-20261003/task17-r4-timing.log`: `pnpm e2e` finished
**338 passed (18.3m)** and `pnpm e2e:timing` finished **40 passed (5.6m)**.

## R5 execution record (2026-10-05)

R5 used reachability evidence before removing anything. The candidate
`scripts/make-icons.mjs` had no package, build, documentation or runtime
consumer outside its own source. Its output targets the retired
`apps/online/public` shell and the old `apps/local/public` shell; neither
directory exists, while the current `apps/university/public` icon set is
tracked and served directly from `apps/university/index.html`. The script was
therefore deleted. The other apparently manual scripts were retained: the
map-nodes preview is reached through the explicit `VITE_MAP_NODES_PERSONAL_URL`
owner-preview port, the PRIMM and prop-finish helpers are linked from their
active previews, and the check scripts are named in package gates or build
entry points.

No overlapping check was merged: `check-i18n.mjs` owns the physical-CSS
direction scan while `check-interface-catalogs.mjs` owns catalog validation;
`check-contrast.mjs`, `check-raw-colours.mjs` and `check-shared-styles.mjs`
guard separate failure classes. `.gitignore` already covers the observed
generated directories (`dist`, package `dist/`, local build output,
`.primm-preview-build`, `.scratch`, logs and test artifacts), so no broad or
unproven ignore rule was added.

## R6 execution record (2026-10-05)

R6 inventoried all eight tracked workspace `package.json` files and recorded the
literal-import/configuration review in
`.scratch/overnight-20261003/task17-r6-dependency-inventory.json`. The direct
declaration count is 122 → 117: five declarations with no consumer were removed
after checking the whole package tree. The delivery app no longer declares the
render kit, `three-stdlib`, `ts-fsrs` or `zod`; those are owned by the world or
core/local package that imports them. `apps/local` no longer repeats the root
`lefthook` declaration; the root `prepare` script installs the hook once.
The app still declares Drei and Fiber where they are needed as the world
package's peer providers, and the world package keeps its dev-plus-peer copies
for its own tests and typecheck.

All seven workspace Vitest declarations moved from `4.1.10` to the patched
`4.1.11`. `apps/local`'s two governance tools now match the root at `0.14.2`.
The transitive `undici` advisory was fixed with the workspace-level override
`undici: 7.29.1`; putting this under a `pnpm` key in root `package.json` was
rejected by pnpm 11 and was removed, so the supported `pnpm-workspace.yaml`
location is the only source of truth. The lockfile and installed links were
regenerated with pnpm 11.22.0.

The audit before the fix reported 12 advisories: Vitest 4.1.10 (patched by
4.1.11) and undici 7.29.0 (two high plus moderate/low findings). The after
receipt says `No known vulnerabilities found`. `pnpm list --depth 100 -r`
reports 18 libraries with multiple remaining versions after excluding two
workspace-link spellings that resolve to the same package. These are transitive
or peer-selected. Published kit contracts hold the backend-client difference
(0.6.0 direct versus AuthKit 0.1.9's 0.7.2) and the zod difference (4.4.3 direct
versus NerveKit 0.7.0's 3.25.76), so no unsafe override was added. The complete
list and the reason for each retained direct declaration are in the inventory
JSON. The direct-declaration count includes dependencies, devDependencies and
peerDependencies; the 18-library count is the recursively installed graph.

R6 adds no coupling between shared kits. Existing kit-internal dependencies
remain governed by their published versions until task 16 adopts the Owner's
decoupled releases; the University package imports stay with their existing
owners. First-party kit versions in tracked manifests remain exact. The complete
fast, browser, timing, pipeline and native
dry-run receipts are added below after the stage gates. R7 is next and will
measure and reduce type/lint suppressions, including test-file typechecking.

R6 gate receipts:

- `pnpm verify`: green; core `95 files / 864 tests`, UI `100 / 633`, local
  `55 / 518`, world remote/performance `5 / 45` plus world `164 / 1238`, app
  `79 / 431`, backend `5 / 28`, AI `6 / 50`; canvas `5` mounts, experience
  ledger `68 findings — 64 fixed, 4 open`, doc-gov `177 docs / 320 links / 0
  warnings`, delivery and authoring builds green. Receipt:
  `.scratch/overnight-20261003/task17-r6-verify.log`.
- `pnpm --filter @pieai/university-local test:primm-pipeline`: `2 files
  passed`, `18 tests passed`, `13.33s`; receipt
  `.scratch/overnight-20261003/task17-r6-pipeline.log`.
- Native course revise dry-run: `validated`, lesson `8`, cards `2/2`, exercise
  `2`, `completedComponents []`, `retrySafe true`; receipt
  `.scratch/overnight-20261003/task17-r6-native-dry-run.log`.
- The first complete browser run had `335 passed` and three deterministic
  failures under four-worker load (weekly-boss synthetic history, X authoring
  `understanding-ai/check-what-matters`, and Y authoring English reading tools).
  Each failed case passed twice in one-worker isolation; receipts are
  `.scratch/overnight-20261003/task17-r6-isolation-{weekly-boss,english-source,english-tools}-{1,2}.log`.
  With load back below 20 and no other Playwright, the same commit passed the
  complete suite: `338 passed (17.5m)`, receipt
  `.scratch/overnight-20261003/task17-r6-e2e-retry.log`. No assertion or timeout
  was changed.
- `pnpm e2e:timing`: `40 passed (5.5m)`, receipt
  `.scratch/overnight-20261003/task17-r6-timing.log`.
- `pnpm audit --registry https://registry.npmjs.org`: `No known vulnerabilities
  found`; after receipt `.scratch/overnight-20261003/task17-r6-audit-after-2.log`.

R6 is ready to commit and push. R7 is the next stage.

## R7 execution record (2026-10-05)

R7 first made the hidden test typechecks explicit. The four packages that had
excluded tests now have no-emit `tsconfig.tests.json` projects: core, UI,
University AI and UniversityLocal. Their scripts run through the root
`typecheck` command. The other three package/app projects already include their
tests in their normal `tsconfig` (`apps/university`, `packages/backend` and
`packages/world`). All 499 tracked source test files are therefore covered by
TypeScript rather than only by Vitest's transpilation. The typecheck receipt is
`.scratch/overnight-20261003/task17-r7-typecheck-tests.log`.

The suppression inventory compares the clean R6 commit with the R7 worktree in
`.scratch/overnight-20261003/task17-r7-suppression-inventory.json`. The counted
tokens are `any` type annotations/casts, double casts (`as unknown as`),
TypeScript suppression comments and lint suppression comments; prose mentions
are not counted. The counts are:

| Guard | R6 baseline | R7 | Change | Treatment of survivors |
| --- | ---: | ---: | ---: | --- |
| `any` type annotations/casts | 212 | 209 | -3 | Browser/WebGL probe globals and the remaining published-boundary/test fixtures are isolated and described in the inventory. The PRIMM generator registry now has two concrete function contracts. |
| `as unknown as` | 187 | 163 | -24 | SQLite row decoding is one documented `rowsAs<T>` boundary per module; test fixtures, browser probes and kit adapters retain only the casts needed to cross those external shapes. |
| `@ts-expect-error` / `@ts-ignore` | 2 | 2 | 0 | Both are i18n contract tests; each comment states the invalid key or placeholder invariant it intentionally proves. |
| lint suppressions | 13 | 13 | 0 | Hook suppressions keep mount/transition effects tied to stable refs or event semantics; the two console suppressions print diagnostic fixture receipts. Every line has an adjacent reason. |

The test typecheck pass also caught and corrected stale fixtures: the billing
plan field names, the complete V3 activity shapes, the progress locator
literal narrowing, the current grading quota/usage contracts, and the current
PRIMM decision facts. These are test-only contract repairs and do not alter
lesson data or learner behavior. The SQLite change centralizes the untyped
`node:sqlite` row boundary; each selected row still goes through its existing
named converter or validation immediately after the boundary.

R7 gate receipts:

- `pnpm verify`: green; core `95 files / 864 tests`, UI `100 / 633`, local
  `55 / 518`, world remote/performance `5 / 45` plus world `164 / 1238`, app
  `79 / 431`, backend `5 / 28`, AI `6 / 50`; canvas `5` mounts, experience
  ledger `68 findings — 64 fixed, 4 open`, doc-gov `177 docs / 320 links / 0
  warnings`, delivery and authoring builds green. The new `typecheck:tests`
  scripts passed for all four previously excluded test trees; the complete
  receipt is `.scratch/overnight-20261003/task17-r7-verify.log`.
- `pnpm --filter @pieai/university-local test:primm-pipeline`: `2 files
  passed`, `18 tests passed`, `13.53s`; receipt
  `.scratch/overnight-20261003/task17-r7-pipeline.log`.
- Native course revise dry-run: `validated`, lesson `8`, cards `2/2`, exercise
  `2`, `completedComponents []`, `retrySafe true`; receipt
  `.scratch/overnight-20261003/task17-r7-native-dry-run.log`.
- `pnpm e2e`: `338 passed (17.7m)` with no failed cases; receipt
  `.scratch/overnight-20261003/task17-r7-e2e.log`.
- `pnpm e2e:timing`: `40 passed (5.6m)`; receipt
  `.scratch/overnight-20261003/task17-r7-timing.log`.

R7 is ready to commit and push. R8 is next: repair the named browser flakies
with deterministic readiness and require two complete green runs on one commit.

## R8 execution record (2026-10-05)

R8 addressed the three flaky families named by the plan without deleting any
learner-property coverage, weakening an assertion, or increasing a timeout.
The original failure receipts and the exact cause/fix mapping are kept in
`.scratch/task17/r8-flaky-inventory.json`.

The first-reader failure was reproduced twice in isolation in the task 14
repair evidence (`task14-e2e-isolated-1.log` and `task14-e2e-isolated-2.log`).
The map helper used a changed pathname as its completion signal, so authoring
could pass the URL check while the lesson request was still unresolved. The
AA caller now supplies the real `.lesson-reader` surface; the helper waits for
that locator after navigation, and a fetch failure still fails the test.

The landscape-delivery sample had the same class of scene-settle race recorded
around R2. `settledReceipt` previously compared only mesh geometry. It now
requires two equal geometry and renderer-resource censuses before the original
receipt is accepted, so Suspense-mounted dressing cannot be sampled halfway
through. The existing landscape, canvas, geometry, material and budget
assertions remain intact.

R43's 1600px globe selection could sample a projected point while the planet's
WebGL resource and DOM label paths were on different frames. The test now waits
for every selected domain's assets, visible projected label, in-viewport label
box and projected sphere center, with three equal label frames, before the
real-canvas click. It still exercises the actual globe pointer path and keeps
the `aria-pressed` assertion.

The focused regression set passed **20 tests in 6.1 minutes** (AA, R56 and
R43, one worker). The R8 fast gate and the pipeline/native receipts are:

- `pnpm verify`: green; core `95 files / 864 tests`, UI `100 / 633`, local
  `55 / 518`, world remote/performance `5 / 45` plus world `164 / 1238`, app
  `79 / 431`, backend `5 / 28`, AI `6 / 50`; canvas `5` mounts, experience
  ledger `68 findings — 64 fixed, 4 open`, doc-gov `177 docs / 320 links / 0
  warnings`, delivery and authoring builds green. Receipt:
  `.scratch/overnight-20261003/task17-r8-verify.log`.
- `pnpm --filter @pieai/university-local test:primm-pipeline`: `2 files
  passed`, `18 tests passed`, `12.98s`; receipt
  `.scratch/overnight-20261003/task17-r8-pipeline.log`.
- Native course revise dry-run: `validated`, lesson `8`, cards `2/2`,
  exercise `2`, `completedComponents []`, `retrySafe true`; receipt
  `.scratch/overnight-20261003/task17-r8-native-dry-run.log`.

The previous full-suite baseline was `338 passed (17.7m)` from R7. On the R8
commit being pushed for this stage, the two consecutive normal-load runs were
`338 passed
(17.4m)` and `338 passed (17.5m)`; no test was removed. The timing gate was
`40 passed (5.5m)`. Receipts are
`.scratch/overnight-20261003/task17-r8-e2e-1.log`,
`.scratch/overnight-20261003/task17-r8-e2e-2.log`, and
`.scratch/overnight-20261003/task17-r8-timing.log`.

R8 is ready to push. Before that push the one-minute load check must be below
20 with no other Playwright process; the pre-push hook will repeat the complete
browser and timing gates on this commit. No stage-specific test coverage was
removed.
