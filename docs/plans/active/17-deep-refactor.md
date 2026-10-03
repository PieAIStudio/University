---
id: PLAN-17-DEEP-REFACTOR
title: "17 · University deep refactor: code, topology, docs, hygiene"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-03
last_reviewed: 2026-10-03
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
- End with only `main`, and remote equal to local.

## 4 How it is judged (every stage)

| Gate | Command | Floor |
| --- | --- | --- |
| fast | `pnpm verify` | green |
| complete | `pnpm e2e` | must pass; the count may fall only by tests whose subject R3 removed, each named in the commit body |
| timing | `pnpm e2e:timing` | must pass; count may not fall |
| docs | `pnpm doc-gov check` | must pass |
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
