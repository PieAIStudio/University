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

## 7 Execution checkpoint · 2026-10-02 · blocked

**Not accepted; task 11 remains active.** The isolation implementation exists,
but the complete browser gate is red. No push or task 12 work has been performed.
Save this checkpoint locally under section 5; do not treat the new fixtures or
fast-gate success as permission to advance the queue.

### Implemented boundary

`e2e/prepare-catalogue.mjs` restores test-owned authoring storage through the real
recovery importer and bakes it through the real delivery importer. Both browser
modes, the role selector, native answer readers and the timing launcher use
`.scratch/e2e-catalogue/<online-port>/`. The API has its own project root rather
than reading the author's personal source-root preference. Vite's explicit
embedded-manifest override is the only product-code seam changed.

The [frozen-input contract](../../../e2e/fixtures/catalogue/README.md) owns the
course-by-course roles, provenance and refresh procedure: five courses, 89
lessons, two exercised source images, and six cited source files plus LICENSE.
The fixture directory adds **2,895,733 bytes**, of which the three gzip inputs
are **2,881,582 bytes**. It contains no screenshots, learner database, accumulated
recovery history or full source-project checkout. Its tiny source Git fixture is
independent of University's mainline Git database; three node regressions cover
reproducibility, inherited hook Git paths, and source-path ownership.

The deliberate real-release exception is `e2e/published-catalogue.spec.ts`, test
`published catalogue preserves every current lesson and excludes test-only inputs`.
It reads the real release files inside the test, retains lesson/revision/package
parity and rejects test-only hashes/markers without requiring old course counts.
It passed during the three-lesson rehearsal. The inventory is **430 → 431**, with
no original case removed and this one added; the timing inventory stays
`Total: 40 tests in 9 files`. Inventory is not a pass result.

Two test setup defects found while integrating the smaller catalogue were fixed
without relaxing their assertions: the right-edge island walk now measures short
real pointer drags against projected positions instead of a fixed 440-pixel
swipe; keyboard navigation completes the existing real launch action before
sending Tab. The original placement, keyboard, completion and timing thresholds
remain. The focused edge/mobile run returned `3 passed (3.0m)`; keyboard navigation
in both modes and the mobile journey, each repeated four times with four workers,
returned `12 passed (3.1m)`. Those focused results did not predict a green full run.

### Complete rehearsal · blocking result

Command: `TASK11_REHEARSAL_NAME=rehearsal-boot-fixed node .scratch/task11/run-rehearsal.mjs`.
The runner reduced the real delivery files to the three specified lessons, ran
`pnpm e2e` with four workers, retained the report, and restored the original files.
Its final browser output is:

```text
  3 failed
    [default] › e2e/desktop-learner.spec.ts:21:3 › C 在线端 · 桌面宽度 › 右侧当前对象说明和地图一致，并且同样走完第一节
    [default] › e2e/mobile-learner.spec.ts:21:3 › A 新学习者 · 在线端 · 手机宽度 › 清空 storage → 落地 → 第一节 → 结算 1/8
    [default] › e2e/recap-contrast.spec.ts:5:3 › settlement explanatory text follows readable theme ink: 浅色
  428 passed (30.7m)
rehearsal: original production catalogue restored byte-for-byte; University HEAD unchanged
```

The desktop journey pressed Continue but `[data-chest-stage]` remained present
through the unchanged 10-second assertion. The mobile journey and light-theme
recap check observed `.loading-trivia` after the chest closed instead of staying
on the same island for the wrap-up. The recap case failed before reaching its
contrast assertion; this is not evidence of an ink-contrast defect. The exact
product root cause is not established by these receipts.

These are **not** real-release inventory exceptions. The passing count is below
the 430 floor, so the rehearsal fails this task's acceptance. The runner stopped
before timing (`timing: null`); no 40-pass timing result or successful push is
claimed. No whole-suite retry or product-flow patch followed this result.

Evidence is local to this checkout, relative to the repository root:

- `.scratch/task11/rehearsal-boot-fixed/browser.log`, `browser-report/index.html`
  and `browser-test-results/` retain the complete run and failure contexts.
- `.scratch/task11/rehearsal-boot-fixed/receipt.json` records 1 study / 1 course /
  3 lessons during rehearsal and byte-for-byte restoration of the original
  2 studies / 6 courses / 93 lessons, 47 delivery files, imported manifest and
  lexicon. The pre-commit HEAD stayed `35cd839490df13220e11c5e2f4fde213805a21d9`.
- `SCRATCH/e2e/学完一节-开宝箱-扔星星-继续-1790946034643.png` is the desktop failure;
  `SCRATCH/e2e/涟的收尾对应真实完成记录和复习卡-不再另开结算页-1790946410483.png`
  is the mobile failure. The recap screenshot ends in `1790946782525.png` in the
  same directory. The passing island screenshots are preserved separately in
  `.scratch/task11/focused-edge-evidence/`.

Earlier negative evidence is not overwritten: `.scratch/task11/rehearsal/`
returned `3 failed` / `428 passed (27.5m)` with the two old island setup failures
and the mobile wrap-up failure. `.scratch/task11/rehearsal-edge-fixed/` was
cancelled after the authoring keyboard failure and is **not** a complete gate;
its `interrupted.json` and restoration receipt distinguish cancellation artifacts
from independently observed failures. Every rehearsal restored production data.

### Fast gate and production separation

After restoration and the final test-code changes, `pnpm verify` exited **0**.
The full log is `.scratch/task11/verify-after-rehearsal.log`; it includes:

```text
doc-gov check passed (172 docs).
doc-gov links passed (162 current files, 331 local links).
doc-gov audit completed with 0 warning(s).
doc-gov doctor passed with 0 warning(s).
```

A fresh scan of the resulting production build,
`node .scratch/task11/check-delivery-no-leak.mjs`, returned:

```text
delivery-no-leak: 0 matches in 647 files; 6 production courses / 93 lessons
```

The scan checks the explicit test marker, every frozen recovery hash and the
fixture source commit, not old course IDs that production still legitimately
shares. `.scratch/task11/delivery-no-leak.json` retains its receipt, with the
previous receipt preserved beside it. No published-catalog entry or production
recovery package is changed by this checkpoint.

### Resume boundary

The next decision is whether to authorize diagnosis and correction of the
chest-Continue / wrap-up product flow outside this task's content-root-only
product-code scope. Keep this task active and its local work intact. A fix must
retain these failing assertions, then earn a complete browser result at or above
the standing floor and all 40 timing passes before ordinary push and task 12.
Do not reset the baseline, skip the journeys, increase their deadlines, change
production courses to hide the failures, or rewrite the local checkpoint's history.
