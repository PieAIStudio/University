---
id: PLAN-11-TEST-CATALOGUE
title: "11 · The browser suite runs on its own test catalogue"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-03
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
  `UniversityCourses/course-proposals/locked/README.md`.
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

**Scope amendment, 2026-10-02 (Claude-approved, relayed and authorized by the Owner):**
first verify the live browser `library` during a three-lesson rehearsal. A missing
in-bundle test catalogue is already within the content seam. If it is present,
necessary chest-Continue / wrap-up product corrections are now allowed: write a
failing reproducer before fixing; do not weaken assertions, increase deadlines or
replace screenshot baselines. At most two fix rounds; then stop with the minimal
reproducer and logs here. Acceptance requires all 431 browser cases in both the
reduced and normal release-catalogue runs, all 40 timing cases, and byte-for-byte
restoration of the release files before push. Keep one task commit.

**Subsequent Owner authorization:** compare the unchanged knowledge-album file
three times with the first-round fixes and three times on `d08df8ec`, recording
`uptime` each time. Preserve and restore the exact named stash. A screenshot race
may be corrected with the settled element's bounding box and a clipped page
screenshot, never a fake clock or weaker assertions. After reduced/normal 431 and
40 timing passes, add one explicit-path follow-up commit above `d08df8ec` and
push without rewriting it. The pending queue documents are a separate later
commit and push; this supersedes the earlier single-commit/two-round stop for
this explicitly requested continuation.

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

## 7 Execution evidence · delivered 2026-10-03

**Task 11 is delivered.** The Owner-authorized second push completed the unchanged
pre-push gates: `431 passed (25.1m)` and `40 passed (6.1m)`. Local and remote `main`
are at `73a8b587`, with `d08df8ec` preserved as its parent. The earlier standalone
reduced/normal catalogue and timing checks remain valid, with production bytes
restored. The final receipt below owns the current conclusion; prior failed
attempts and tool-stop records are chronological evidence, not current blockers.

### Implemented boundary

`e2e/prepare-catalogue.mjs` restores test-owned authoring storage through the real
recovery importer and bakes it through the real delivery importer. Both browser
modes, the role selector, native answer readers and the timing launcher use
`.scratch/e2e-catalogue/<online-port>/`. The API has its own project root rather
than reading the author's personal source-root preference. Vite's explicit
embedded-manifest override was the initial isolation's only product-code seam;
the subsequently authorized chest/readiness repairs are recorded below.

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

### Reopened under the Owner's Claude-reviewed authorization

The Owner subsequently authorized the bounded investigation and necessary product
repair recorded in section 3. Task 11 is still not accepted. The old negative
receipts above remain evidence, not a baseline to bless or a reason to skip tests.

**Library hypothesis excluded by a live browser probe.**
`TASK11_REHEARSAL_NAME=rehearsal-library-probe node .scratch/task11/run-rehearsal.mjs --probe-library`
reduced the real release to one course / three lessons. At landing, just before
chest Continue and after wrap-up, the actual browser module
`/src/content/library.ts` still held all five frozen test courses and matched the
test manifest including hashes. The settlement course and loaded lesson were
present; the actual online content port named both test studies. The existing
Vite `selectedContentManifest` seam works. No new manifest workaround was applied.

The probe returned `4 passed (2.3m)` (two widths collected by two inherited
projects, not four distinct behaviours). It is not a full gate. Evidence:
`.scratch/task11/rehearsal-library-probe/{browser.log,library-375.json,library-1440.json,receipt.json}`;
its receipt verifies all original bytes and HEAD restored. The small diagnostic
spec/config live in `.scratch/task11/library-probe.*` and never ship.

**Failure-first product regressions.** With the original behaviour (the host's
scene-key expression merely extracted unchanged), the new application tests
returned `3 failed | 13 passed (16)`; the renderer-wrapper tests returned
`1 failed | 11 passed (12)`. Logs are `.scratch/task11/regression-before.log` and
`.scratch/task11/world-regression-before.log`. Existing assertions were not changed.

- `use-chest-opening.test.tsx`: the existing six-second throw fallback reaches
  `done`, the learner presses Continue, and a delayed renderer callback arrives
  during the existing 950ms camera return. The callback unconditionally rewrote
  `leaving` to `done`, resurrected the reward card and cancelled navigation.
- `scene-interaction.test.tsx` and `WorldMapCanvas.test.tsx`: the same course has
  been drawn for its chest, but returning to its map changes both the host's
  route-based readiness key and Stage's overview-based key. With no new content
  requested, waiting for another frame can nevertheless reopen the existing
  two-second loading cover. The regressions retain that threshold and separately
  prove real loading, a different course, context loss and retry still invalidate
  readiness. This failure is independent of course count.

**Repair round 1.** The late star callback now advances only the current owner's
current chest while it is actually `throwing`. The host and retained Stage share
one resource key through course / lesson / chest views; overview availability
still follows the map route separately, and world-study identity keeps its
existing fallback. No camera parameters, renderer, loader, deadline or learning
record changes. Application regressions now return `19 passed (19)`, including
journey ownership checks; renderer-wrapper/readiness tests return `12 passed (12)`.
Logs: `.scratch/task11/round1-app-regressions.log` and
`.scratch/task11/round1-world-regressions.log`.

The first complete repair-round run is retained in
`.scratch/task11/accept-round1/`. `pnpm verify` exited 0. The reduced-catalogue
browser result was `1 failed` / `430 passed (32.2m)`. All three original blocked
journeys, plus dark-theme recap, passed; the only failure was
`knowledge-album.spec.ts:169`, the isolated desktop card/rank presentation.
It passed every assertion and then failed capturing `.rank-promotion` because its
normal five-second auto-dismiss detached the element while Playwright awaited
screenshot stability. This standalone synthetic page does not mount App or its
map/chest controller, so this is not a new failure of the repaired flow.
Normal-catalogue and timing gates did not run after that red result. The inner
`.scratch/task11/rehearsal-round1/receipt.json` proves byte-for-byte restoration,
and the outer receipt independently verifies the same 47 files/manifest/lexicon.

**Repair round 2, rejected and rolled back.** A test-only attempt installed a
browser clock before navigation, paused before the real scheduler grade and
planned to drive the ceremony before taking the original screenshot. No promotion
product code, timeout, expected image or original assertion was changed. It did
not work: both desktop and phone, each repeated twice, stayed at
`data-emblem-animating="false"` through the original 45-second assertion that
expects the ceremony to have started. It failed before the planned screenshot
and later expiry assertion. This is a new scheduling failure of the attempted
fixture, not evidence that the original product animation never starts.

The targeted command was:

```sh
pnpm exec playwright test --config e2e/playwright.config.ts --project=default \
  knowledge-album.spec.ts --grep 'three real card frames' --repeat-each=2 \
  --workers=4 --trace=retain-on-failure \
  --output=.scratch/task11/round2-focused-results
```

Output: `Running 4 tests using 2 workers`, then `4 failed`, exit 1; no passes.
Playwright resolved two workers for the two file repetitions despite the supplied
four-worker ceiling. Exact log: `.scratch/task11/round2-focused.log`; each case's
`error-context.md` and `trace.zip` remain under `round2-focused-results/`.
The minimal retained failing case is the `isolated 1440: three real card frames`
case in `.scratch/task11/round2-knowledge-album-attempt.ts`. Its exact patch is
`.scratch/task11/round2-knowledge-album-attempt.patch`, preserved before rollback.
The original first-round screenshot race has its distinct context under
`.scratch/task11/rehearsal-round1/browser-test-results/`; do not conflate them.

After the second round finished, the unsuccessful clock changes were removed
with guarded edits. `e2e/knowledge-album.spec.ts` is again byte-identical to the
checkpoint version, including every original assertion and screenshot operation.
The first-round product fixes and failure-first regression tests remain. No third
repair or further browser-suite retry was started. Normal-catalogue 431 and the
40 timing gate have **not** been earned; task 11 remains active and push is blocked.

The existing unpublished checkpoint remains `d08df8ec`; this continuation's
product fixes, new tests and this record are retained in the working tree. No
second task commit or history rewrite was performed. Another session's task 15
and its generated manifest entry are unrelated and have not been modified or
staged by this continuation.

Final closeout evidence: `.scratch/task11/owner-authorized-closeout.json` verifies
that the post-rollback code hash equals the exact first-round candidate that
passed `pnpm verify`, and all 47 production files plus imported/lexicon hashes
still equal the original values. Its fresh no-leak scan returned
`0 matches in 647 files; 6 production courses / 93 lessons`.
The final documentation gate returned `173 docs`, `163 current files, 333 local
links`, and zero audit/doctor warnings (including the other session's task pack).
No test listeners remain on 18093–18096 or 18893–18896. The continuation diff and
new regression file are also preserved under `.scratch/task11/owner-authorized-*`
without staging another session's files.

### Owner-directed six-run comparison and screenshot correction

The subsequent comparison ran only `e2e/knowledge-album.spec.ts`, three times
per candidate, with the same configuration and a fresh test-server lifecycle
per run. No assertions, clocks, deadlines or production files were changed.

| Candidate / run | Verbatim result | `uptime` load averages before | After |
| --- | --- | --- | --- |
| First-round fixes / 1 | `9 passed (2.4m)` | `13.96 12.93 15.20` | `13.16 13.19 14.95` |
| First-round fixes / 2 | `9 passed (2.4m)` | `12.50 13.05 14.89` | `16.63 13.81 14.87` |
| First-round fixes / 3 | `9 passed (2.3m)` | `15.78 13.68 14.82` | `21.19 16.50 15.77` |
| `d08df8ec` / 1 | `9 passed (2.3m)` | `17.83 16.21 15.69` | `14.36 14.84 15.17` |
| `d08df8ec` / 2 | `9 passed (2.7m)` | `14.36 14.84 15.17` | `33.47 19.28 16.68` |
| `d08df8ec` / 3 | `9 passed (2.7m)` | `33.47 19.28 16.68` | `19.51 20.99 18.05` |

All six exited 0. This does not reproduce a stable with-fixes-only regression,
nor does it prove that both candidates fluctuate: no failure occurred in this
sample. The earlier complete-run log still establishes the narrower failure:
automatic dismissal detached the promotion while its element screenshot waited
for stability. This isolated page does not mount the repaired App/chest flow.
The bounded correction therefore changes only that capture operation. Immediately
after the unchanged `data-emblem-animating="false"` assertion it reads the
promotion's bounding box, requires a non-null box, then calls `page.screenshot`
with that clip and the original screenshot path. Every original assertion,
product timer and animation remains unchanged; no clock is installed.

The exact stash was `b60aad9df98e946a5788a925daf4804437c12c14`, labelled
`task11-round1`. `git stash apply` restored it after the baseline runs; all 13
tracked/untracked changed files and their modes matched the pre-stash snapshot.
Only that SHA/label's stash was dropped. Reports and full before/after `uptime`
lines: `.scratch/task11/album-comparison/{with-fixes,baseline}/receipt.json` and
per-run logs/reports. `summary.json` and `restore-receipt.json` retain the combined
comparison and restoration result in the same directory. Production courses were
not reduced during this comparison. The subsequent acceptance result follows.

**Clipped capture verified, complete gate still blocked.** The focused album file
returned `9 passed (2.3m)` after the change. Both desktop and mobile promotion
screenshots were inspected and show the complete Bronze receipt, not an empty
crop; preserved copies live in `.scratch/task11/clip-focused-shots/`. The exact
source comparison in `.scratch/task11/clip-change-proof.json` proves every other
byte of the spec equals `d08df8ec`, preserving all original assertions and adding
no fake clock.

The new full run used `.scratch/task11/accept-final.mjs`; `pnpm verify` exited 0
with `175 docs`, `165 current files, 335 local links`, and zero audit/doctor
warnings. This working-tree docs count includes the queue packs reserved for the
Owner's separate later documentation commit. The reduced browser result was:

```text
  1 failed
    [default] › e2e/island-pick.spec.ts:484:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边
  430 passed (27.9m)
```

All nine album cases passed in this complete run, as did the previously blocked
chest/wrap-up journeys. The remaining failure occurred inside
`pickRightEdgeIsland`, before its actual right-edge/follow/overlap assertions:
`真实拖动没有把课程岛向预期方向平移`. The setup derives pointer gain from a
repositionable DOM label. A zero/negative label displacement is not yet proof
that the camera failed to pan; the exact cause has not been established. No
island test assertion, drag limit, timeout or product behaviour was changed.

Complete evidence: `.scratch/task11/rehearsal-owner-clip/browser.log`,
`browser-report/index.html`, `browser-test-results/` and `receipt.json`; the outer
receipt and fast log are under `.scratch/task11/accept-owner-clip/`. The failure
screenshot `SCRATCH/e2e/点靠右边缘的岛-进入动作不越过岛的右缘且不裁切-1790959111307.png`
was inspected. The inner and outer receipts both confirm all 47 production
content files, imported manifest and lexicon restored byte-for-byte, with HEAD
still `d08df8ec`. Normal-catalogue 431 and timing 40 did not run after this red.

An observation-only copy of the single island case was prepared under
`.scratch/task11/island-pan-diagnostic/`, retaining the original gestures and
guards while logging camera projection, pointer hit and label displacement. Its
execution request was blocked by the host tool safety check before launch; no
probe result is claimed, and no alternate execution route or whole-suite retry
was attempted. `source.json` identifies the unchanged original test snapshot.
This diagnostic is the next unresolved step, not a fix or acceptance receipt.

Task 11 stays active. No follow-up commit or push was made. The first-round
product fixes, regression tests, clipped capture and this record remain in the
working tree. The Owner's AuthKit `0.8.0-rc.0` supplement has been applied to the
pending task 16 document; the actual tarball SHA, package version and UIKit peer
range were independently checked, but no kit was installed or new account
interface enabled. Queue packs 15–17 and task 12's after-17 dependency remain
reserved for the separate documentation commit after task 11 passes and pushes.

### Owner-directed robust pan measurement · initial failed attempt

**Read-only attribution, before any new test run.** The first-round scene change
leaves world-map behaviour unchanged: `sceneKeyForView(view)` returns `view.kind`
for non-course views, exactly like the old `mapRouteKey`. App supplies the new
WorldMapCanvas `sceneKey` only when `inCourse`; otherwise Stage still uses the
same `courseViewKey ?? world:<study>` fallback. No world camera/pan logic changed.
The failing calibration was added in `d08df8ec`: `snapshot.sort(...)` and the
later `after.sort(...)` mutate their arrays, so `commonBefore = snapshot.find(...)`
selects the rightmost still-common name, precisely the target most exposed to
edge constraints and label repositioning. Its DOM centre is not a reliable
single-label proxy for camera movement.

**Retained evidence limitation.** Read the exact failure's `error-context.md`
under `.scratch/task11/rehearsal-owner-clip/browser-test-results/`; it records
the gain guard failure and three visible course names, not before/after geometry.
That case directory contains only this Markdown file. A recursive trace-file
search of the retained rehearsal returns **0**; the run's Playwright config has
`trace: "off"`. There is no trace to inspect and therefore no evidence here that
can confirm OR disprove a name switching to the other side on the failing step.
The failure screenshot is a single after-state, not that missing transition.
The prepared `island-pan-diagnostic` probe remains unrun.

**Authorized correction.** Gain now uses the median x displacement of all names
visible in both snapshots, divided by the signed pointer dx. With fewer than
three common names, use the one nearest the canvas centre, excluding the edge
target; no safe common name fails closed. Non-positive gain still throws the
original error. Snapshot sorting no longer mutates the inputs. The 50px limit,
ten attempts, 12px arrival tolerance, true edge pick, flip/follow/viewport/overlap
assertions and all timeouts stay unchanged. `right-edge-pointer-approach` is
attached in `finally`; each attempted drag records every common name's before
and after x, displacement, selected names, method and gain, including the failing
step. Pure regressions cover an edge-name outlier, even median, central fallback,
missing samples, both drag directions, and non-positive movement.

Validation will use the existing rehearsal runner and Playwright configuration:
under a three-lesson release, the original online/local island journeys each run
three times, then full reduced 431, normal 431 and timing 40. Any tool-blocked
command must be recorded here verbatim with the exact rejection, then execution
stops without another entry point. The Owner permits one explicit-path task-11
follow-up commit after `d08df8ec`, followed by ordinary push only after all gates
are green; pending queue documents remain a separate subsequent commit.

**This continuation stopped on an explicit tool rejection.** Before that
rejection, the pure measurement regressions completed with the original output:

```text
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The authorized reduced-catalogue focused run used the existing executable entry:

```sh
env TASK11_REHEARSAL_NAME=rehearsal-owner-median-focused E2E_ONLINE_PORT=18893 E2E_LOCAL_WEB_PORT=18894 E2E_LOCAL_API_PORT=18895 E2E_GRADING_PORT=18896 node .scratch/task11/run-rehearsal.mjs --island-pick-only
```

The runner's browser command was:

```sh
pnpm exec playwright test --config e2e/playwright.config.ts --project=default e2e/island-pick.spec.ts --grep 'F 点岛出现对象旁进入动作' --repeat-each=3 --trace=retain-on-failure
```

Final output (no successful cases):

```text
  6 failed
    [default] › e2e/island-pick.spec.ts:497:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边
    [default] › e2e/island-pick.spec.ts:505:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 本地端：同一套卡片，跟岛走
    [default] › e2e/island-pick.spec.ts:497:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边
    [default] › e2e/island-pick.spec.ts:505:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 本地端：同一套卡片，跟岛走
    [default] › e2e/island-pick.spec.ts:497:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边
    [default] › e2e/island-pick.spec.ts:505:3 › F 点岛出现对象旁进入动作 · 跟岛走 › 本地端：同一套卡片，跟岛走
rehearsal: original production catalogue restored byte-for-byte; University HEAD unchanged
```

All six stopped at the newly added insufficient-non-target-sample guard:
`没有足够的共同可见名牌测量真实拖动，不能用边缘目标冒充`.
This is not the original non-positive-gain error and is not proof of a product
pan regression. The implementation excludes the moving edge target from the
small-sample fallback and currently throws when no other common label remains.
That extra missing-sample behaviour has not passed acceptance; it must not be
reported as a successful fix or disguised by relaxing the original assertions.

The new `finally` attachment was present in all six retained traces. A successful
read of the trace attachments, before the rejected follow-up, showed for the
local `default-repeat2` case: on step eight the sole shared label was
`search-your-own-photos`, which was also the current edge target; its centre
moved from **1237.2615966796875** to **1318.04541015625**, a positive displacement
of **80.7838134765625** for pointer dx **50**. The selected non-target list was
empty, so measurement gain was null. This establishes missing eligible samples
in that case, not a reversed drag. It does not establish whether the OLD
untraced failure involved a label flipping sides. No new probe was launched.

The next request attempted only to summarize the newly retained ZIP trace
attachments and list their frame metadata. It was blocked before execution;
no result or generated `pan-evidence.json` from that request is claimed. Exact
request: `WebCodex-Mac.call_runtime_tool`, tool `run_script`, project
`agent:device-c7e3c2df3e0d49e0:university-95b71956`, session
`wc_sess_pOUdWikESH1-Hlo0`, language `python`, purpose `diagnostic`, timeout 60,
with the following complete script (typed script data, not a shell command):

```python
from pathlib import Path
import zipfile,json,collections
root=Path('.scratch/task11/rehearsal-owner-median-focused')
records=[]
for trace in sorted((root/'browser-test-results').glob('*/trace.zip')):
    with zipfile.ZipFile(trace) as z:
        for name in z.namelist():
            if name.endswith('.trace'):
                rows=[json.loads(line) for line in z.read(name).decode().splitlines()]
                for row in rows:
                    for a in row.get('attachments',[]):
                        if a['name']=='right-edge-pointer-approach':
                            value=json.loads(z.read(a['file']))
                            records.append({'case':trace.parent.name,'trace':str(trace),'evidence':value})
        last=records[-1]['evidence']['moves'][-1]
        print(json.dumps({'case':trace.parent.name,'steps':len(records[-1]['evidence']['moves']),'lastStep':last},ensure_ascii=False))
(root/'pan-evidence.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
first=sorted((root/'browser-test-results').glob('*/trace.zip'))[0]
with zipfile.ZipFile(first) as z:
    print('TRACE STRUCTURE',[(n,z.getinfo(n).file_size) for n in z.namelist() if n.endswith(('.trace','.network','.stacks'))])
    for name in z.namelist():
        if name.endswith('.trace'):
            rows=[json.loads(line) for line in z.read(name).decode().splitlines()]
            print(name,'TYPES',dict(collections.Counter(r['type'] for r in rows)))
            print('LAST FRAME KEYS',[(r.get('timestamp'),r.get('sha1')) for r in rows if r['type']=='screencast-frame'][-4:])
```

Exact rejection:

```text
This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.
```

Per the Owner's stop rule, no alternative entry, further test command, product
change, commit or push followed the rejection; only this required record was
written. The focused runner had already terminated and reported byte-for-byte
production restoration. Its complete log, six error contexts/traces with the
per-drag attachments, and restoration receipt remain in
`.scratch/task11/rehearsal-owner-median-focused/`. The full reduced suite,
normal 431 and timing 40 were not run in this continuation. HEAD remains the
existing `d08df8ec` checkpoint; all current fixes/tests and queue documents stay
uncommitted. Task 11 is not accepted and task 13 has not started.

### Resume: preserve a measured scale when the safe sample temporarily disappears

The Owner requested continuation through WebCodex. The earlier blocked trace
inspection is not retried. Its already-read attachment establishes why the six
focused cases stopped: the final common name became the edge target. Requiring
a fresh independent calibration on every drag was an extra restriction added
by this implementation, not a requirement for successful arrival.

The measurement rule is retained: all-common median, central non-target fallback,
and unchanged rejection of every measured non-positive gain. When no eligible
sample remains, keep only the last finite positive gain actually measured from
independent names during this same approach; initial/default gain cannot be
reused this way. The attachment keeps the measurement null and explicitly labels
calibration as retained, so it does not pretend the edge name was a safe sample.
The existing ten-drag / 50px limits and actual <=12px arrival assertion still
reject a stuck or reversed approach; all follow/flip/clipping/overlap assertions
remain unchanged. No product behaviour is modified in this continuation.

A failure-first pure regression replays the exact retained sole-label coordinates.
Before the correction it returned `tests 9 / pass 8 / fail 1`; evidence is
`.scratch/task11/pan-calibration-before.log`. After the correction it returned
`tests 9 / pass 9 / fail 0`; `.scratch/task11/pan-calibration-after.log` retains it.

### Final local acceptance · 2026-10-03

The original online/local island journeys each ran three times under the actual
three-lesson release: `6 passed (3.3m)`. The runner restored the production tree
before further gates. Evidence is `.scratch/task11/rehearsal-pan-calibrated-focused/`;
its `shots/online-picked-right.png` and `shots/local-picked-right.png` were inspected.
No initial/default gain is treated as a calibration, and missing samples remain
explicit in the `finally` attachment. All original arrival/follow/flip/overlap
assertions and timing budgets remain unchanged.

On the same frozen application/test source, the required gates returned:

```text
pnpm verify: exit code 0
431 passed (25.2m)
431 passed (27.7m)
40 passed (6.6m)
delivery-no-leak: 0 matches in 647 files; 6 production courses / 93 lessons
```

The two browser lines are the reduced and normal catalogue runs respectively;
all 431 current cases passed in each. There are no skipped replacements
or changed screenshot baselines. The first-round product fixes, screenshot-only
capture correction and independent pan calibration all share the exact candidate
`d5bb0c873937153bdd7ceaa0fdbecf16977321211c6aad07bad2d940272d439b`.

**An infrastructure timeout is not counted as a pass.** The original aggregate
job `wc_job_XYQDVA4fgmr2IFjy` requested 10800 seconds but terminated after 3600;
its exact stderr was `command timed out after 3600 seconds`. Verify and the full
reduced run had completed. The normal run had no failing cases in its retained
log, but no terminal result, so it was discarded as acceptance evidence. Process
inspection proved that its test runner and log writer were gone; only its own
orphan server group remained. That verified owner process was stopped, and the
partial results were preserved. Each remaining gate then ran as a separate
native execution within the executor's limit, without modifying source or test
timeouts. The full normal run above is a fresh 431-case run, not a sum of fragments.

Evidence, all relative to this repository:

- `.scratch/task11/accept-pan-calibrated/verify.log` and its `receipt.json` retain
  the completed fast/reduced gates and the interrupted aggregate state.
- `.scratch/task11/rehearsal-pan-calibrated-full/` retains the complete reduced
  browser log, HTML report, test results and byte-for-byte restoration receipt.
- `.scratch/task11/accept-separated/normal-browser.log`, `normal-browser-report/`
  and `normal-browser.json` retain the complete normal run.
- `.scratch/task11/accept-separated/timing.log`, `timing-report/` and `timing.json`
  retain all 40 timing cases; `no-leak.log`, `no-leak.json` and
  `delivery-no-leak.json` retain the fresh production scan.

Every successful remaining-gate receipt rechecks the exact source hash, unchanged
University HEAD and original production bytes. The production content tree is
still 47 files with SHA-256
`8118bdf75d2a645758fb184c54bd74a59885700a51186da5757352f7c1a62eab`;
imported manifest is
`298237f793b6a8f1a17e09fd0a9f741eceb0042441f2045ca91c93c031b0b119`,
and lexicon is
`8d1227ea24c504595294a802b4c37efdfe0db9cf886008f0f78e160456bc2660`.
No course was retired or published by task 11. The Owner authorized one
append-only follow-up commit above `d08df8ec`; that checkpoint is neither amended
nor squashed. Pending queue packs remain separate from this task's delivery.

### Actual pre-push failure and tool-stop record · 2026-10-03

The explicit-path follow-up commit was created as
`73a8b587a7a2d27f289fb125ef80ac457d42d8c5`, with parent
`d08df8ec0c3b6a8925f674603e1385d8e19ebf1f`. Commit hooks passed:
`172 docs`, `162 current files, 332 local links`, zero audit warnings.
The real `git push origin main` was started once from a clean working tree.
Its existing pre-push command remained unchanged and was not interrupted:

```sh
E2E_ONLINE_PORT=18693 E2E_LOCAL_WEB_PORT=18694 E2E_LOCAL_API_PORT=18695 E2E_GRADING_PORT=18696 pnpm e2e:all
```

It completed with exit 1 and the original browser result:

```text
  4 failed
    [default] › e2e/primm.spec.ts:535:7 › PRIMM steps authoring zh-CN ask-about-a-picture: one action per screen, teacher after it, one ending
    [default] › e2e/world-play-integration.spec.ts:39:7 › S 课程岛与学习玩法的整合边界 › authoring 1440px 真实导航往返不丢系列、课程或地图入口
    [default] › e2e/X.ai-literacy-english.spec.ts:31:7 › X delivery ai-for-real-life/words-for-a-real-reader: every English lesson, source and image is readable
    [default] › e2e/Y.english-campus.spec.ts:95:5 › Y English campus delivery › planet, study, course and lesson share one readable English journey
  427 passed (32.8m)
```

The PRIMM and X cases reported `page.goto: Target page, context or browser has been closed`.
The world-play and Y cases reported that course entry had not taken effect and
its entry button was no longer visible (`harness/map-actions.ts:163`). Those are
observed failure symptoms, not a diagnosed cause. No focused rerun or repair was
started after this result. The hook did not reach its timing command; the prior
standalone `40 passed (6.6m)` remains separate evidence, not a successful push.

The push receipt records these exact host load averages:

```text
11:05  up 1 day, 19:37, 1 user, load averages: 7.74 9.67 17.00
11:38  up 1 day, 20:10, 1 user, load averages: 95.76 111.65 87.33
```

The load rose sharply, but that alone does not prove why these four cases failed.
The failed push left `main` two commits ahead of `origin/main`; the latter remained
`35cd839490df13220e11c5e2f4fde213805a21d9`. No force push, hook bypass, amendment,
squash or second push was attempted. The complete raw log, receipt, HTML report
and test results are preserved under `.scratch/task11/pre-push-failure-73a8b587/`.
The original log/receipt are `.scratch/task11/push-task11.log` and `push-task11.json`.
The owned listeners on 18693–18696 were absent after the push terminated.

**A separate read-only preparation request was safety-blocked while that push was
already running.** It attempted to list headings from the existing interaction
specification for later queue work. It did not execute. Exact tool request:

```json
{
  "tool": "WebCodex-Mac.run_process",
  "arguments": {
    "project": "agent:device-c7e3c2df3e0d49e0:university-95b71956",
    "session_id": "wc_sess_pOUdWikESH1-Hlo0",
    "executable": "node",
    "args": [
      "--input-type=module",
      "-e",
      "import fs from 'node:fs'; const s=fs.readFileSync('docs/reference/interaction-components/spec.html','utf8'); for(const m of s.matchAll(/<h([23])[^>]*>([\\s\\S]*?)<\\/h\\1>/g)) console.log(m.index, m[2].replace(/<[^>]*>/g,'').trim());"
    ],
    "purpose": "diagnostic"
  }
}
```

Exact rejection:

```text
This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.
```

There was no alternate entry point or retry of that effect. New implementation,
validation and queue edits stopped. The already-running push was only observed
to its natural terminal result, honoring the Owner's instruction not to interrupt
its gates; only the existing failure evidence and this required stop record were
then saved. This post-push record is an uncommitted documentation-only change.

The separate queue-doc commit has NOT been made. Its four original documents
(12, 15, 16 and 17, including the latest AuthKit candidate information) remain in
stash `de1b7c8a76150db603dccfdf0af372fba39f8ff3`, label
`task11-pending-queue-docs`; their saved hashes are in
`.scratch/task11/queue-docs-before-stash.sha256`. This stash was not applied or dropped.

The Owner's 2026-10-03 order is retained as the next documentation instruction,
effective only after task 11 pushes: **11 → 12 → 13 → 14 → 16 → 17**; task 15
remains Owner-held. Its required amendments have not yet been applied: 12 starts
immediately after 11, keeps lesson four unpublished and stays active while waiting
for Owner reading, with later feedback routed through review → fix; 13 preserves
that unpublished lesson and retains it with 1–3 only after acceptance; 14 moves
pipeline writes with the same configured content root; 17 depends on 12 and runs
pipeline tests plus one dry-run after every stage; both queue indexes must match.
After that separate document commit/push, task 12 must provide a real
`pnpm primm:preview` reading path with full-length answers. No lesson-four draft,
preview or task-12 implementation was produced in this continuation.

### Owner-authorized load recheck and successful delivery · 2026-10-03

On the exact unchanged `73a8b587` candidate, the four cases that failed during
pre-push were each executed twice, serially on the isolated 18893–18896 test
ports. The test list was checked before execution: exactly eight executions from
four original cases, not eight different tests. No product code, assertions,
clock or test deadline changed. The result was:

```text
Running 8 tests using 1 worker
  8 passed (4.2m)
```

All eight were expected passes, with zero failures, flaky cases or skips. The
complete command, case identities and receipts are in
`.scratch/task11/overload-recheck/focused-receipt.json`, with `focused.log`,
`focused-results.json`, `focused-report/` and `focused-test-results/` beside it.
The before/after host observations were:

```text
12:30  up 1 day, 21:02, 1 user, load averages: 5.71 5.70 7.95
12:34  up 1 day, 21:06, 1 user, load averages: 10.19 8.33 8.48
```

This sample did not reproduce the four failures. It supports investigating host
contention, but does not prove that load was their sole cause.

The single additional push authorized by the Owner started only after checking
that the one-minute load was below 20 and no other Playwright process was running.
The working tree was clean, HEAD unchanged, and the remote had not diverged. The
previous stop record was saved separately rather than silently discarded.
The preflight and final host observations were:

```text
12:35  up 1 day, 21:06, 1 user, load averages: 8.71 8.12 8.40
13:06  up 1 day, 21:38, 1 user, load averages: 7.62 11.36 15.99
```

The normal `git push origin main` ran the complete existing hook without a
bypass, interruption or further retry. Its raw terminal result was:

```text
  431 passed (25.1m)
  40 passed (6.1m)
To https://github.com/PieAIStudio/University.git
   35cd8394..73a8b587  main -> main
```

Exit code was 0. Both `main` and `origin/main` resolved to
`73a8b587a7a2d27f289fb125ef80ac457d42d8c5`; ahead/behind was `0 0`.
The full push log, gate summaries, preflight process check and minute-by-minute
load samples are retained in `.scratch/task11/overload-recheck/push.log` and
`push-receipt.json`. `push-report/` and `push-test-results/` retain the final hook
lane's report; the earlier complete browser reports remain in their own run
directories. Owned push-test listeners were absent after completion.

After delivery, both the temporary stop-record stash and the exact queued-doc
stash `de1b7c8a76150db603dccfdf0af372fba39f8ff3` were applied by SHA. All five
restored files matched their saved SHA-256 values before only those two matched
stash entries were dropped. `overload-recheck/stash-restoration.json` records the
operation. The separate documentation change now carries the Owner's effective
11 → 12 → 13 → 14 → 16 → 17 order and its unpublished-fourth-lesson protections;
no course content, kit version or learner data is changed by that documentation.
