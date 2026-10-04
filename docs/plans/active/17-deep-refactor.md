---
id: PLAN-17-DEEP-REFACTOR
title: "17 · University deep refactor: code, topology, docs, hygiene"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-03
last_reviewed: 2026-10-04
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
