---
id: PLAN-13-RETIRE-OLD-COURSES
title: "13 · Old courses retire; only the new step lessons ship"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-03
domain: execution
tags:
  - content
  - retirement
  - catalogue
related:
  - REF-WORK-QUEUE
  - PLAN-11-TEST-CATALOGUE
supersedes:
  - PLAN-AI-FOUNDATIONS-REVIVAL
superseded_by: null
---

# Task 13 · Old courses retire; only the new step lessons ship

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`. Queue rules are in
  [the work queue](../../reference/execution/work-queue.md).
- **Depends on `11-test-catalogue.md`.** If it has not landed, stop: retiring
  courses while the suite still takes its fixtures from the shipped catalogue
  stops the whole browser gate from loading. That is exactly what happened on
  2026-09-22.
- **What ships today.** Two studies and six courses, all listed in
  `apps/university/published-catalog.json` (release 0.3.0):
  - `ai-literacy`: `understanding-ai`, `ai-for-real-life`;
  - `browser-ai`: four courses.

  Three more studies sit unshipped in `apps/local/course-proposals/locked/`:
  `turing-pact`, `general` and `ai-foundations`.
- **What stays.** The version-3 step lessons: today, the first three lessons of
  `ai-literacy` / `understanding-ai`, unit `first-useful-step`. If task `12-` has
  produced a lesson the Owner accepted, it stays too.
- **Fourth-lesson protection (Owner 2026-10-03).** Task `12-` runs before this
  task. Until the Owner has read and accepted its new fourth lesson, leave that
  draft/revision and its writing receipts untouched and unpublished. Do not
  retire, delete, replace or export it as part of retiring its old predecessor.
  Once accepted, retain it with lessons 1–3. An active task 12 waiting only for
  Owner reading does not block this task's other authorized retirement work.
- **The mechanics that are not wired.** The fields `archived` on a study,
  `retired` on a lesson and `retained` in the catalogue have zero readers, so
  setting them changes nothing. Real retirement has so far meant moving a whole
  package between `recovery/` and `locked/` (see the locked README).

  Keeping three lessons of one course is therefore new. Course content has exactly
  one producer, the `apps/local` CLI: never hand-edit generated or delivery JSON.
  Read the CLI first, then choose one of two routes, and write the choice and the
  reason into this document:
  - a new course revision made through the CLI;
  - wiring one retirement mechanism that something actually reads.
- **Unpublishing is a deliberate act.** `check-published-catalog.mjs` refuses
  removals unless it is run with `--accept-removals`. The Owner's approval is
  quoted below; cite it in the commit body.
- **Old courses are referenced from more than the catalogue.** At least:
  - the welcome's two paths (`welcomeDestinations` uses `ai-literacy` and
    `browser-ai`);
  - planet domains;
  - review cards and due counts;
  - island game question sources;
  - the play catalogue's sample paths;
  - concept and lexicon pointers;
  - the public course pages and site index;
  - the delivery checks;
  - the component table in the writing workflow.

  §10 of the [execution spec](../../reference/interaction-components/spec.html)
  lists them under "删之前必须先做的". The acceptance condition there: a search of
  the whole repository finds no retired course left in use.
- This task supersedes [AI foundations revival](../completed/ai-foundations-revival.md).
  Reviving the locked course is no longer the plan; new courses come from
  partner material through the production line (task `12-`).

## 1 Outcome

Learners in both modes see only the new step lessons. Every other course is out
of the product, kept intact in a retired area that nothing imports and that can
restore it. A learner who had progress on a removed lesson meets no error.

## 2 What the Owner said

> 「假如你这一轮做完之后，这个APP的状态是可能只有前三课，其他课都退役。或者站位，这些课程都移到别的位置，不要移不要放在咱们这个项目里。」 (2026-10-02)

His answer to "旧课怎么退" was **T1**: retire them all and keep only lessons
1–3; package the old courses into an archive; do not delete history.

Interpretation:
- "Out of this project" is completed by task `14-`, which moves the whole content
  tree, retired area included, into its own repository. That repository is the
  archive.
- A learner's own data — progress, answers, cards — is never deleted. Rows that
  point at a retired lesson are kept and stop being offered.

Still uncertain, so ask the Owner before landing:
- With one study left, the welcome's two-path choice has only one path. The
  recommendation is that the welcome offers that one path directly, without a
  one-option choice.

## 3 Out of scope

- Deleting git history, or deleting a learner's data.
- Renaming study ids. They are part of every `lessonKey`, and no alias layer
  exists.
- Deleting component code (spec §10 is a separate, batched decision).
- Moving content to another repository (task `14-`).

## 4 How it is judged

| Gate | Command | Baseline measured 2026-10-02 on `26a296fe` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | must stay green |
| complete | `pnpm e2e` (also run by `pre-push`) | 430 passed | must pass; count may not fall |
| timing | `pnpm e2e:timing` | 40 passed | must pass; count may not fall |
| catalogue | `node apps/university/scripts/check-published-catalog.mjs --accept-removals` | six published courses | the recorded removals match the retirement exactly |

Standing floor: **pass counts may rise, never fall.**

Also required:

- **Captures** at 1280px and 390px:
  - the planet, the world map, the course map and the welcome, showing only the new
    lessons;
  - a learner session seeded with progress and due cards on removed lessons,
    showing no error and no broken card.
- **Pending fourth lesson.** Record its authoring identity, revision/hash and
  unpublished state before and after retirement. It must remain readable in the
  Owner preview without being added to delivery before acceptance.
- **Restore rehearsal.** Restore one retired course into a scratch copy from the
  retired area alone. Report what that took.
- **Search proof.** A repository search for each retired study id finds only the
  retired area, history, and lines that say the study is retired.

## 5 Delivery discipline

- One task, one commit, one push; the push runs the complete gate.
- If the complete gate cannot go green: stop, keep the work committed locally,
  and write down what blocked it.
- Never force-push or rewrite history.
- Publication is separate. This task changes what the next release would ship;
  it does not deploy.

## 6 Report back

- Gate numbers verbatim.
- The retirement route chosen, and why.
- Each reference that was cleaned up, with what it now does.
- The captures, and the restore rehearsal.
- The Owner's answer about the welcome.
