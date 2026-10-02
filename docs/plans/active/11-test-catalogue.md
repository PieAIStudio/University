---
id: PLAN-11-TEST-CATALOGUE
title: "11 · The browser suite runs on its own test catalogue"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-02
domain: execution
tags:
  - e2e
  - content
  - retirement
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 11 · The browser suite runs on its own test catalogue

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Tasks `06-` and `09-`
  ahead of this one are blocked on the Owner and are stepped over.
- Depends on: none. This task is independent.
- Why now: the Owner decided on 2026-10-02 that every old course retires and only
  the three new step lessons stay (task `13-`). That retirement cannot happen
  while the browser suite takes its fixtures from the shipped catalogue.
- **The specification already exists.** Read the section "Why nothing was locked
  on 2026-09-22" in
  [`apps/local/course-proposals/locked/README.md`](../../../apps/local/course-proposals/locked/README.md).
  It records the attempt, the measurement and the rollback:
  - `e2e/harness/catalogue.ts` resolves its roles out of the shipped catalogue
    **at module load** and throws when a role finds no course, so every spec that
    imports it dies before running. The roles name content properties, such as
    "a course carrying a prerequisite" or "a unit of exactly five lessons that all
    have exercises".
  - Retiring even the smallest course still failed four named tests. Three of them
    are specs that enumerate `apps/local/studies` on disk, or assume the catalogue
    keeps providing a bilingual `connect` task or a multi-island study.
- Seams that already exist: `e2e/start-servers.mjs` already points the servers at
  an e2e content root (`UNIVERSITY_CONTENT_ROOT`) and can override the studies root
  (`E2E_STUDIES_ROOT`, `UNIVERSITY_LOCAL_STUDIES_ROOT`). What still reads the shipped
  catalogue is the harness, which reads `apps/university/src/content/imported.json`
  and the generated `apps/university/content/shelf.json`, plus the specs that walk
  the studies folder.

## 1 Outcome

The browser suite and its timing lane run against a test catalogue that belongs
to the tests. The shipped catalogue can then shrink to the three new lessons
without a single spec failing to load.

## 2 What the Owner said

> 「假如你这一轮做完之后，这个APP的状态是可能只有前三课，其他课都退役。或者站位，这些课程都移到别的位置，不要移不要放在咱们这个项目里。」 (2026-10-02)

His answer to "旧课怎么退" was **T1**: retire them all, keep only lessons 1–3,
and package the old courses into an archive without deleting history.

Interpretation: this task does not retire anything. It removes the reason
retirement failed last time. Task `13-` does the retiring.

## 3 Out of scope

- Changing what ships to learners. The shipped catalogue, `published-catalog.json`
  and the recovery packages stay exactly as they are; that is task `13-`.
- Deleting, skipping or weakening a spec to make it pass. A spec whose subject
  really is the shipped catalogue keeps testing the shipped catalogue; list it.
- Product code changes other than the content-root seam the suite needs.

## 4 How it is judged

| Gate | Command | Baseline measured 2026-10-02 on `26a296fe` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | must stay green |
| docs | `pnpm doc-gov check` | 168 docs | must pass |
| complete | `pnpm e2e` (also run by `pre-push`) | 430 passed | must pass; count may not fall |
| timing | `pnpm e2e:timing` | 40 passed | must pass; count may not fall |

Standing floor: **pass counts may rise, never fall.** If a count drops, name the
test that left and why in the commit body, before anything else.

Proof that the dependency is really gone (this is the point of the task):

- **Rehearsal.** Locally and without committing it, cut the shipped catalogue down
  to `ai-literacy` / `understanding-ai` with only the first unit's first three
  lessons, then run the complete gate. The suite must load. Every failure must be a
  spec whose subject is the shipped catalogue itself, listed by name in the commit
  body. The target is zero such failures.
- **No leak.** The delivery build output contains no test-catalogue course. Show
  the command and its output.
- **Size.** Report the size the frozen test catalogue adds to the repository. Keep
  it as small as the roles allow: build it from the fewest courses that satisfy
  every role, and do not carry screenshots or other assets the specs never open.

Not acceptable as proof: "the fast gate is green" on its own; a suite that
passes only because specs were skipped.

## 5 Delivery discipline

- One task, one commit, one push; the push runs the complete gate.
- If the complete gate cannot go green: stop. Do not start the next task; leave
  the work committed locally and write down what blocked it.
- Never force-push or rewrite history.
- Default ports may be busy: run the suites on your own block (`E2E_ONLINE_PORT`,
  `E2E_LOCAL_WEB_PORT`, `E2E_LOCAL_API_PORT`, `E2E_GRADING_PORT`). Don't edit files
  while the `pre-push` servers are running; they hot-reload the working tree.

## 6 Report back

- Gate numbers verbatim, including the rehearsal run.
- Which courses the test catalogue holds, and which role each one serves.
- One sentence on what changed and why.
- Anything noticed but not done, as candidates for later tasks.
