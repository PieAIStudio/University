---
id: PLAN-19-ONE-NAME-FOR-THE-AUTHORING-SIDE
title: "19 · One name for the authoring side: 创作端 / authoring"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-10-05
last_reviewed: 2026-10-05
domain: execution
tags:
  - naming
  - refactor
  - authoring
related:
  - REF-WORK-QUEUE
  - PLAN-17-DEEP-REFACTOR
supersedes: []
superseded_by: null
---

# Task 19 · One name for the authoring side: 创作端 / authoring

## Context the executor does not have

### Why the Owner asked for this

On 2026-10-05 the Owner read Codex's R11 note about 「两种运行模式」. They believed the local mode had been deleted and that everything now ran in the cloud. The record says otherwise.

| Date | What the Owner ruled | Where it lives |
| --- | --- | --- |
| 2026-08-22 | Both modes sign in, and learner data is canonical in the cloud. | ADR-0001 |
| 2026-08-22 | Courses publish to the backend. | ADR-0002 |
| 2026-08-26 | Two modes are kept on purpose: 「在线端跟本地端基本上一模一样，只有两点不一样。一是回答的时候AI，第二就是本地能做课程…其他都要一模一样」 | — |

The design is right. The vocabulary is not.

### Where the vocabulary is split

The authoring side already has a right name in some places:
- Vite modes: `--mode authoring` and `--mode delivery`;
- the constant `AUTHORING`;
- most Chinese docs: 创作端 / 交付端.

Elsewhere it is still called "local", and the delivery side "online":
- the interface (「本地端」, "Local client");
- the authoring server's directory and package;
- the two port directories;
- dev scripts and a LAN flag;
- i18n keys;
- e2e spec names and titles;
- the README mode table.

The README sentence 「本地端不上网络」 means "is not served on the LAN by default". It reads as "works offline", while ADR-0001 says both modes sign in to SwimmerBackend.

### Scale

Measured at `b4e11df4` with `git grep -l`, excluding history:

| String | Files |
| --- | --- |
| `apps/local` | 73 |
| `@pieai/university-local` | 11 |
| `ports/local` | 77 |
| `ports/online` | 118 |
| `dev:local` | 4 |
| `lan-local` | 2 |

Outside University, these also name the old path or package:
- the course content repository (`UNIVERSITY_COURSE_ROOT`): a few READMEs and one script;
- HQ's founder-board data.

## 1 Outcome

The authoring side has one name.
- In Chinese interface and docs it is **创作端**.
- In English text and in every current code name it is **authoring**: directories, packages, ports, scripts, flags, i18n keys and test names.
- "local" and "online" no longer name a mode or the authoring server.
- No current text lets a reader conclude that the authoring mode is offline or a separate product.

## 2 What the Owner said

2026-10-05, after asking 「为什么还有两种模式，是不是我理解错」:

> 好，改名叫创作端，放进下一个任务

Then, on code names:

> 我觉得代码里的名字是不是也得改一改呀？因为现在重构是不是更对齐一下……正好因为重构嘛

## 3 Scope

- **Interface copy.**
  - Change the authoring build's campus name in the zh-CN and English catalogs. It is the name the feedback note's context line shows.
  - Rename the i18n keys that carry 本地端 / 在线端. The contract and every catalog move together.
- **The authoring server.**
  - Rename `apps/local` to `apps/authoring-server`, and its package to `@pieai/university-authoring-server`.
  - Its course-authoring skills move with it. Every router and doc line that points at them follows.
- **Ports.** Rename `ports/local` to `ports/authoring` and `ports/online` to `ports/delivery`.
- **Scripts and flags.** Rename `dev:local` to `dev:authoring` and `--lan-local` to `--lan-authoring`.
- **Tests.**
  - Rename e2e spec files, describe titles and step names that say 本地端 / 在线端 / local / online for a mode.
  - If the frozen test catalogue or the experience ledger keys on those names, update them in the same commit.
- **Things that run.** Everything that calls the old path or package moves too:
  - the module-boundary check;
  - lefthook;
  - package scripts;
  - the Owner's one-click lesson-4 launcher.
- **The content repository.** Update the READMEs and script that call the server by its old path or package. Make that a commit in that repository. It may have no remote yet, and a local commit is acceptable there.
- **Docs.**
  - The surfaces are:
    - the root README;
    - the authoring server's README;
    - current execution and reference pages;
    - router wording in `AGENTS.md`.
  - Reword the README LAN paragraph: the authoring mode is not exposed on the LAN by default. It must not read as offline.
  - If any current text still calls the two modes 壳 or shells, use 模式. The three shells are browser, desktop and phone.
- **No aliases.** Do not keep compatibility aliases, re-export shims or old script names. University rule 1 allows one name for one thing.

## Out of scope

- **`UniversityLocal` as history.** Where the word names the former separate repository, it stays. That covers SPEC-0001's history and the import contract.
- **Governed doc IDs and filenames.** SPEC-0001 keeps its ID and filename.
- **History.** Do not rename these:
  - ADRs;
  - completed plans;
  - player-journey v3, v4 and v5;
  - receipts, evidence and `.scratch/` logs.
- **The delivery side's interface name.** 在线端 stays; the Owner decided only the authoring side. Docs that already say 交付端 stay.
- **HQ.** Do not edit HQ files. Claude reconciles HQ's board data at the integration point.
- **Behaviour.** No behaviour change, no feature, no deployment and no publication.
- **The lesson.** Task 12's fourth lesson, its receipts and its protected typo stay as they are.

## How it is judged

- **Remaining hits.**
  - Search current surfaces for:
    - `apps/local`, `@pieai/university-local`;
    - `ports/local`, `ports/online`;
    - `dev:local`, `lan-local`;
    - 本地端;
    - "Local client".
  - List every remaining hit with its reason; only the historical material above may remain.
- **The boundary check still looks.** Inject a temporary import between the browser app and the authoring server under the new paths. The check must fail on it. Remove the probe. Record the failure output verbatim. A renamed path that the check no longer scans would turn it green while guarding nothing.
- **Pipeline.** The course pipeline tests and a native dry-run pass under the new package name, with the same test counts as R10:
  - 2 files and 18 tests;
  - dry-run `validated`.
- **The launcher.** The Owner's one-click lesson-4 launcher still opens lesson 4. Take a screenshot.
- **Real browser.** The authoring build shows 创作端 wherever 本地端 appeared. Take screenshots at desktop and phone width.
- **Fast gate.** `pnpm verify` passes, and the doc-gov checks pass with a regenerated manifest.
- **Complete gate.** The pre-push hook runs `pnpm e2e && pnpm e2e:timing`. `verify` does not run the browser suite, so this push is the gate that actually looks. Do not skip it.
- **Floors.**
  - Measured at `b4e11df4` on 2026-10-05: browser **338 passed**, timing **40 passed**.
  - If R11 records different counts, those become the floor.
  - Pass counts may rise, never fall.

## Delivery discipline

- One University commit and one ordinary push. The content repository gets its own commit.
- Never force-push and never rewrite history.
- Move this document to `docs/plans/completed/` and set its status in the University commit.

## Order and dependency

- **Owner order:** 17 R11 → 19 → 16 → report.
- **Dependency:**
  - Task 16 runs on the renamed code. Its pack states outcomes, not paths.
  - If R11 stops, this task waits for it.
  - Task 19 does not depend on 16.

## Report back

Add a section to the current run's report:
- the commits;
- the remaining-hit list with reasons;
- the boundary-check probe output;
- the pipeline and gate counts, verbatim;
- the screenshot paths.

End with one plain-Chinese line for the Owner saying what they will now see.


## Execution record · 2026-10-05

- Renamed the authoring server directory to `apps/authoring-server` and its package to `@pieai/university-authoring-server`; renamed ports to `authoring` and `delivery`, the authoring dev script/flag, the CLI/config/build names, and the authoring e2e spec. No compatibility alias remains.
- Renamed the authoring interface key to `创作端` / `Authoring client`; delivery remains `在线端` in user-facing Chinese as required. The launcher now labels the two modes clearly and says the authoring mode is loopback-only by default, not offline.
- Updated the content repository README and committed it separately in `/Users/yuanfei/PieAI/UniversityCourses` as `3abc221` (`docs: name authoring server consistently`).
- Boundary probe receipt: `.scratch/overnight-20261003/task19-boundary-probe.log`; it reports one rule-2 violation for an import from `apps/university/src/boundary-probe.ts` into `apps/authoring-server/server/http-server.js`, then the probe was removed.
- Pipeline receipt: `.scratch/overnight-20261003/task19-pipeline.log`, **2 files passed (2), 18 tests passed (18)**. Native receipt: `.scratch/overnight-20261003/task19-native-dry-run.log`, `disposition: validated`, lesson 8, cards 2/2, exercise 2, `retrySafe: true`.
- Fast gate receipt: `.scratch/overnight-20261003/task19-verify.log`; core 95/864, UI 100/633, authoring-server 55/518, world 164/1238, app 79/431, backend 5/28, AI 6/50, canvas 5; doc-gov 180 docs and 324 links with 0 warnings.
- Remaining old-name hits are intentionally historical: ADRs, completed plans, player-journey v3–v5, the parity contract's UniversityLocal history, archived evidence, and the task-17 historical measurement tables. Current executable paths, package names, current-work and work-queue now use authoring/delivery names.
- Screenshots for the authoring browser pass are produced by the renamed `e2e/authoring.spec.ts` in `SCRATCH/e2e/test-results/`; the complete browser gate below is the final visual check.

Owner will now see one clearly named 创作端 / authoring mode, with the same learner app and account behavior and a separate authoring server behind it.
