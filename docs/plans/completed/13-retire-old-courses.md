---
id: PLAN-13-RETIRE-OLD-COURSES
title: "13 · Old courses retire; only the new step lessons ship"
type: plan
status: completed
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
- **Baseline before this task.** Two studies and six courses, all listed in
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

Welcome approved by Owner on 2026-10-03:
- With one path left, the welcome leads the learner directly onto that path,
  without a one-option choice. Restore the choice when a second path exists.

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

## 7 Execution evidence · 2026-10-03

Task 12's pushed source is `1444152dc6a1ffcd4ae1ec6263c4a5d35a76dcde`.
This task narrows the current release catalogue to one study, one course,
one unit and the first three accepted V3 lessons. It does not publish a release.
Evidence is retained in `.scratch/task13-20261003/`.

### Native retirement and restore

Added `study retire-content --study --input --out [--dry-run]` to the existing
native authoring CLI. Its strict proposal must identify all current exported
package hashes and an ordered subset of existing course/unit/lesson IDs. It
rejects missing IDs, invalid order, retained prerequisites that would disappear,
and an existing archive. A dry-run writes neither content nor an archive.
Apply preserves the complete original recovery export and local native content
before changing outlines through the native repositories. Failure restores the
original native courses and study manifest. Learner stores are excluded from
both mutation and archival copies. Retained lesson revisions are not rewritten.

The existing single-lesson `course revise` could not narrow an outline. This
operation uses the native course/study status readers and exporter rather than
inventing unused flags. Archived studies also reject direct lesson reads with
410; their original lesson becomes readable again when restored.

`inventory-before.json` records six selected courses / 93 lessons; 90 retire.
`apply-receipts.json` and the two proposals record the exact native dry-run and
apply. Archive locations:

- `apps/local/course-proposals/retired/task13-20261003/ai-literacy/recovery/`
  and `browser-ai/recovery/`: original selected packages and retirement receipts;
- `history/recovery/`: every historical recovery object and original index;
- `locked/`: the 33 previously locked courses across three retired studies;
- `native-local/`: those studies' full local course trees, byte-identical, with
  the 67 previously tracked files still tracked at their archive paths.
  `native-legacy-archive.json` records the move. Private source snapshots and
  learner stores stay where they were. Task 14 owns the external repository move.

The active retained export is
`sha256:3d883d9efcb699232bd51e41ec937fd147a183e09ddc43954698cdf06014d9c3`.
The importer used its existing `--allow-shrink` once for the authorized retirement;
`check-published-catalog.mjs --accept-removals` recorded that exact removal.
Ordinary shrink protection remains. Both Chinese and English study descriptions
were updated through native `study describe`, including its locale input.
No lesson prose or generated delivery JSON was hand-edited.

`final-archive-restore.json` records native dry-run, real recovery import and
re-export of both original AI-literacy courses into a scratch authoring root.
Both original package hashes match, using the final archive alone and no external
source checkout. Repository-backed archives retain their original source-commit
requirements; no substitute repository was invented.

### Runtime references and learner history

The v7 journey records the Owner's single-path decision before implementation.
Both modes project real welcome destinations from the current shelf: one path
opens its first stone directly, zero waits for material, two or more restore the
choice. Opening does not write lesson progress. The welcome has no one-option
choice. Tests cover these three conditions using the actual retained catalogue.

Planet domains, world/course islands, public content and search follow the
newly generated catalogue. Play-catalogue sample paths now reference only the
three retained lessons. Chain-depth tests use an explicit isolated fixture so
retirement does not remove coverage. The vocabulary coverage tool's default
now targets the retained study.

Due cards and tomorrow counts share the progress port's shelf-availability
predicate. Retired cards stop being offered while the stored rows remain intact.
Practice questions and island games already derive from the current course
shelf; completed old lessons cannot contribute unavailable questions. Concept
and lexicon records have no active retired-course destination.
`runtime-retired-reference-search.txt` records the runtime search: remaining
old identities are archived-course history, historical ordering/domain mapping,
an explicitly isolated development presence fixture, examples or frozen test
fixtures. The active `ai-foundations` domain and the vocabulary `general` track
are not retired-study catalogue entries. No component code was deleted.

### Real browser and fourth-lesson protection

`captures/index.html` links all 20 screenshots: delivery and authoring, each at
1280 and 390 pixels, covering direct welcome, planet, world, course and a seeded
old-progress review session. `captures/receipt.json` and four traces record the
real current catalogue, no page/server errors, exactly the retained three lesson
IDs, no single-path choice, preserved old completion/card rows and no old card
offer. No model or content response was intercepted.

`pending-fourth-before.json` and `pending-fourth-after.json` compare complete
file lists and SHA-256 values for six task-12 evidence/authoring/preview trees.
All match. The new fourth lesson remains isolated native r7, lesson hash
`a5dbfe64605359ab335676321275e1300b5d46f31029525a8ddb71b691343c4d`,
package hash `c531fd9d75af4edec254d8529f42f62dca4558b497ccf09ed5512971e8f0d409`,
unpublished and awaiting Owner reading. Its loopback preview still responds at
`127.0.0.1:23150`; the three retained lessons remain byte-identical at r15/r9/r9.
Its typo is untouched. Owner review and grading repair remain tasks 12 and 18.

### Gates and ordinary push

Focused native retirement tests: 4 passed; CLI plus retirement: 48 passed.
Archived direct-read regression: 1 passed. Welcome/catalogue focused checks:
17 passed; play-catalogue adjustment: 4 passed. Review availability preserves
history in the core regression and both real browser modes.
The first full verify exposed three stale play-catalogue count/link assertions;
these now assert the smaller catalogue without deleting tests. Original assertion failure
is kept in `verify.log`. The next run passed all unit tests but exposed the
Canvas checker scanning the newly archived external study repositories. Its
existing exclusion of private study checkouts now also covers their retirement
area; product-source mount registration remains mandatory. That failure is
kept in `verify-final.log`; `canvas-boundary.json` separately proves an
unregistered product Canvas still fails. `verify-final-2.log` passed code and
build gates, then found the new task pack missing from the generated governance
index. The index is refreshed before the final run, `verify-final-3.log`.

Final unit counts: core `1138 passed`, UI `711 passed`, native `517 passed`,
application `438 passed`, backend `28 passed`, AI service `47 passed`, and
world `45 passed` plus `1238 passed`. No test was deleted.

The ordinary push runs complete and timing gates with floors **431 and 40**.
`push-receipt.json` and `push.log` are the authority for actual exit status,
verbatim counts, source and remote heads, and the immediately preceding load
and Playwright process check. Delivery is claimed only if that receipt confirms
success; failure stops the queue. No Actions acceptance or deployment is started.
After delivery, task 18 runs before task 14, as the Owner requested on 2026-10-03.


### Push-gate integration repair under the revised Owner instruction

The first ordinary push of `3b2ed566dc28c62ca6f090a964dd5246c197a08f`
finished without interruption on 2026-10-03. Its unchanged complete gate said:

```text
7 failed
424 passed (28.3m)
```

Exit 1, no remote delivery; timing did not run. The source commit and original
`push-receipt.json`, `push.log` and `push-first-failure/` remain intact. Six
failures are four `menu-doors` cases and two `play-catalog` cases: the release
sample-path reduction also fixed the test browser's paths to three, despite its
independently loaded six-path frozen catalogue. The seventh was the delivery
1600-pixel real globe click in `world-delivery`.

Owner's newer instruction requires each failing case to run alone twice before
a gate stop. Both one-worker isolated checks returned `6 failed` and
`2 passed (5.0m)`: all six directory cases failed consistently; the original
globe-click case passed both times, as did one additional narrow-rail case
selected by the name filter. This is eight collected cases, not a change to the
431-case full inventory. Logs are `failed-cases-isolated-1.log` and
`failed-cases-isolated-2.log`. The stable catalogue failures required a fix;
they were not dismissed as machine load. No renderer or pointer assertion changed.

The play catalogue now receives the same already-loaded shelf used by the map
and Library. Historical sample identities are offered only if their exact
course/unit/lesson exists on that shelf: three paths for the release, six for
the frozen test catalogue, and no dead lesson links before material arrives.
It does not add retired lessons to delivery or copy course content. The browser
specs and their 25-entry expectations stay unchanged. A regression first said
`2 failed | 2 passed (4)`; after repair, the focused UI suite said
`6 passed (6)`. Evidence is `catalogue-shelf-red.log` and
`catalogue-shelf-green.log`.

The Owner explicitly requested one separate documentation commit for the new
night order, recorded as `140cc802`. The necessary gate repair is a follow-up
commit rather than rewriting the existing task commit. This is the recorded
deviation from one task/one commit; it preserves history and original failure
evidence under the Owner's autonomous-repair authority. No subsequent task's
implementation begins before task 13's repaired full gates deliver successfully.
The revised work queue governs isolation, load checks, bounded push retries and
required stops. Later successful receipt counts, if any, are preserved separately;
the first failed receipt is never overwritten or relabeled as a pass.


`catalogue-repair-release/receipt.json` and its two real Chrome screenshots show
22 entries and exactly the three retained lesson paths at 1280 and 390 pixels,
with zero page errors. Both screenshots were visually read. A fresh six-tree
protection check remains byte-identical, and the Owner's r7 preview responds.
These new catalogue captures supplement the original 20-screen retirement set;
they do not replace it or the task-12 reading receipts.


After this repair, `pnpm verify` exits 0 in `verify-after-push-repair.log`:
UI `713 passed` (two new regressions), all other unit totals unchanged;
`176 docs`, `166 current files, 340 local links`, audit/doctor `0 warning(s)`.
The six formerly red browser cases now say `6 passed (3.2m)` in
`catalogue-repair-browser.log`, with every original assertion retained.
The follow-up ordinary push is recorded separately under
`.scratch/overnight-20261003/13-repair-push/`; its receipt is the authority for
full complete/timing results and final remote delivery, not the focused pass.
