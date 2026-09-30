---
id: PLAN-V7-08-MENU-AND-TIDY
title: "V7 · 08 Four doors, one name for a lesson, and no author speech"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - navigation
  - copy
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 08 · Four doors, one name for a lesson, and no author speech

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 3
  (the breadcrumb's first cell), 7 ("在产品里找路"), 8 ("复习和练习"), 10 (two
  everyday numbers), the small issues one to five, and the ledger "功能一个都没丢",
  which is the acceptance list for where every old entry goes.
- The learner surface is identical in both modes except the port answers and
  the author workbench; binding decision L1 makes the "实验室" row visible only
  in the authoring build, which is the workbench exception, not a new boundary.
- Learner-visible strings go through the repository's current i18n mechanism in
  zh-CN and en.
- Depends on none of 01–07. Independent; but run it after 05 if 05 is still
  queued, because it moves 成长 under 我.

## 1 Outcome

Every screen offers four labelled doors — 学习, 复习, 图鉴, 我 — on desktop and
phone (including the map), every old entry is reachable where the ledger says,
the product calls a lesson "第 N 关" everywhere, no computer-speak or author
notes reach a learner, and a release check refuses a planted author note.

## 2 What the Owner said

> 「别丢功能……有些面板，开了可能调一些 3D 的，这块以后肯定要删掉。但现在你删掉的话，我就调不了了。」

Binding decisions: B2 (four doors, 成长 folds into 我), G2 ("第 N 关"), E1
(planets without courses say "即将开放 · 开放时告诉我"), L1 (lab only in the
authoring build).

## 3 What "done" looks like

- Doors: 学习 (islands, find a course), 复习 (due cards, practise a few, mistakes),
  图鉴 (knowledge cards, words, favourites, my notes, interactive courseware),
  我 (avatar panel, 成长, membership, account, settings, help). Phone bottom bar
  has the same four with text, and it is present on the map.
- 设置 → 实验室 (authoring build only) holds the avatar workshop, the three
  courseware labs, island appearance tuning and the author workbench; URL
  parameters that open tuning keep working.
- Review page: due cards first with a time estimate; "再练几道" draws mistakes
  first, then only from lessons the learner has finished (today it draws from
  all content, so a beginner is asked about web layout); the free-grading-used-up
  moment is where membership appears.
- Naming: "节" → "关" wherever it means a lesson; "账号" everywhere (no "帐户");
  "快捷操作：空格或更多" removed.
- The breadcrumb's first cell shows the course name, not "…".
- Planets without courses: "即将开放 · 开放时告诉我" with an email capture.
- On phones the lesson medallion above each stone is half its current size,
  full only for the selected lesson.
- Author speech: internal lesson classifications, layout explanations and code
  identifiers are gone from learner text, and a check in `pnpm verify` scans the
  learner-visible strings and published catalogue text and fails on a planted
  author phrase.

## 4 Out of scope

- Deleting any lab or tuning panel.
- Course prose under `apps/local/studies/` — when the author-speech check finds
  text inside a lesson, file it for the course-writing workflow instead of
  editing the lesson; the check may carry a dated allow-list for those findings.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- A browser spec walks the ledger: every "现在在哪" entry is reached from its
  "改完在哪" location, in the delivery build and (for the lab) the authoring build.
- The author-speech check has a test that plants a phrase and sees it fail.
- Capture: both builds' menus, phone bottom bar on the map, review page.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history. Navigation specs that asserted the old
twelve entries are rewritten in the same commit and named in its body.

## 7 Report back

Gate numbers verbatim, captures, the allow-listed lesson findings.

## Implementation and acceptance boundaries

Both shells use one translated list of four destinations. Mobile keeps their
names on the map; contextual shortcuts are a separate control, not a fifth
door. Me and the rail share the original avatar/today/streak/week/rest projection.
Growth contains the rank, seventeen derived badges and folded daily goals/XP.
Settings keeps author laboratory discovery last and absent in delivery; existing
labs, appearance tools and parameterized direct URLs were not deleted.

Review shows actually due cards first. Rehearsal loads only completed current
levels and their native deterministic questions; it no longer quizzes a fresh
learner from the global concept bank. The existing QuestionStep and a shared
PracticeRoundComplete retain keyboard focus, explicit final-feedback acknowledgement,
reduced motion and the finite three-question ending. An explicit `practice`
purpose in the existing log updates mistakes without changing official completion,
first-try rewards, lesson summary or XP. No paid grader is called.

The actual authoring exercise was revision 1 while its published lesson edition
was 3. The old largest-number mistake fallback concealed a later native miss.
The shared mistake fold now accepts an optional current-content resolver; native
practice supplies the questions it has really loaded. No counter is renamed and
no saved history is rewritten. The negative-control unit failed first; both
confirmed and migrated prerequisite-history browser cases are retained. This
bounded repair does not claim a broader progress-history migration.

Daily goals and explicit domain contact intent use the scoped account document.
Passive reads preserve absent preferences, independent topic clocks merge, and
withdrawal clears the current address. Opening a form never gives consent, and
the page explicitly says announcement mail is not connected. Late content
responses and old-account actions are discarded; failure remains visible and
retryable. Mobile feedback lives in Me, retains unsent text, and now meets the
44px/Escape/focus-return contract instead of relying on its old tolerated exception.

The compact breadcrumb names an actual ancestor/course. Phone medallion paint
alone halves; its button remains 44px and selected paint returns to full size.
Interface values use the approved nouns without rewriting stable lookup keys or
course prose. Catalog variant/layer/layout implementation notes are removed. The
publication check rejects injected author notes in interface/catalogue/content
JSON while retaining ordinary instructional comparisons and code examples.

### Preserved evidence

Early checks caught optional-preference round-trip changes, stale expected
nouns, a nonexistent fixture role, native revision priority, excessive question
header spacing and weak contrast of newly visible footer names. Each was repaired
without dropping tests or relaxing geometric, timing or 4.5:1 requirements.
Original failures remain in `SCRATCH/v7-execution/menu-*.log`.

Actual screenshots live in `SCRATCH/e2e/menu-doors/` and
`SCRATCH/e2e/practice-flow/`. Test prerequisite history is explicitly synthetic;
questions and expected answers come from existing published/authoring fixtures,
not a second answer bank. Submissions, review scheduling, wisp disappearance,
focus and completion still run through the product. These receipts do not prove
physical devices, live cloud accounts, mail delivery, course publication or
production deployment. Final local and normal-push receipts remain required.

The continuation separated standalone `.native-practice` from the reader's
existing `.lesson-practice` CSS, retained the actual 44px medallion hit test,
and bound Lian's gestures to Review and the explicit shortcut command rather
than the removed menu entries. Its phone seat now clears the tab bar. The
retired author-note container's CSS and its baseline exemption were removed;
fixed-colour registry locations moved with the deleted lines, with all 27
materials and their reasons unchanged and no new debt allowance.

### Full-journey regression closeout

The broader inherited suite exposed old seven-link assertions, mobile feedback
expectations and a real duplicate course-aside action. The course island's aside
is again read-only; Find a course belongs to the world overview, and the new
browser ledger actually follows it into the catalogue. Old short-window checks
now require exactly the four approved addresses and all four real hit targets.
Mobile feedback tests follow Me → Help and retain the invisible-control negative
control, five-point hit check, account-field separation, keyboard and focus return.
Desktop feedback checks remain unchanged. The initially hidden Me entry after an
expanded sign-in form is scrolled normally before its unchanged hit test.

The expanded Library traversal also reproduced an author-only escape hatch:
the shared courseware catalogue printed raw ids, laboratory links and layout
rationale. Library now selects the same renderer's learner presentation; the 57
playable entries remain, while the three historical layout-comparison documents
and all diagnostic links remain at the original laboratory address (60 entries).
The controlled learner test failed before this change and the two presentation
checks plus the three original registry tests then passed. Both builds' learner
Library and every author Settings laboratory link are exercised by the ledger.
The author desk's feedback GET uses an explicitly empty fixture; writes and every
other hosted call are blocked. That is not real feedback-service acceptance.

The first repair subset was `29 passed (3.4m) / 1 failed`, and its sole remaining
inline-feedback scroll issue passed the subsequent run. Screenshots were inspected
for the phone Review door and the actual native AI activity inside Library;
copy, controls, bottom labels and the no-progress boundary remain visible. The
initial held-pointer adoption and globe-return failures passed unchanged in that
subset; only the final complete gate may supersede their original failures.

The held-pointer check did recur in the complete run. Its bounded diagnostic
passed three isolated runs, then failed all four concurrent runs with captured
trusted events: pointerdown hit the late transition splash, not the chest;
pointerup reached the chest, so the browser correctly emitted no button click.
Waiting once for absence of the splash still allowed it to appear before the
raw press. The check now reuses `humanClick`'s existing pre-press hit testing,
with a `whilePressed` callback for the same anonymous adoption. It never moves,
re-presses or follows a detached target after the press. Two harness regressions
prove the held timing and that moving a target away during the hold still gets
no click; the original invisible-overlay and hover-shift regressions remain.
The exact down/up/click events must all be trusted and address the original
button exactly once. Four repeats of that case and the five harness cases
passed: `24 passed (1.2m)`, `E2E_EXIT=0`. No product callback, account scope,
loading duration or test threshold was weakened for this repair.

### Final local acceptance

The retained final candidate passed `menu-verify-r16.log`: `VERIFY_EXIT=0`.
Its complete browser run `menu-e2e-r16.log` finished with `460 passed (26.2m)`,
`39 passed (5.4m)` and `E2E_ALL_EXIT=0`. On resumption the implementation
snapshot's 2,139 source/configuration files still matched except the three
held-pointer regression files described above; those files were changed before
both final runs. No covered source was edited after that verification. Normal
pre-push reruns the complete browser gate and remains the remote-delivery boundary.

Remaining boundaries: announcing an unopened domain records consent only, not a
mail subscription; physical phone permissions and real backend accounts were not
validated here. No author-note content exceptions were introduced. No course
prose, published package, production deployment or payment switch was changed.

### Resumed normal-push check

The first push of `9f73c07e` ended `1 failed / 459 passed (28.2m)`,
`PUSH_EXIT=1`: one English authoring reading-tools scenario left the native
settings disclosure closed. Its unchanged isolated case passed `1 passed
(37.9s)`; four concurrent diagnostic repeats also passed, with trusted down,
up and click on the same summary. Those receipts do not reproduce the original
failure or establish a product defect. The test now waits for this new
document's fonts (the prior lesson's font receipt was insufficient), then
requires the actual disclosure's open state as well as the original visible
English contents and width limit. There is no second click or synthetic open.
Both modes and lesson shapes passed eight guarded repeats (`8 passed (1.2m)`).
Temporary event instrumentation was removed; the final complete verification
and ordinary push still have to judge the resulting candidate.

The next four-worker push returned `3 failed / 457 passed (25.4m)`, with
three missing authoring DOM snapshots; all three unchanged cases passed the
focused trace-enabled run (`3 passed (1.1m)`). The two-worker normal push kept
the same 45-second action/expect and 240-second test limits, with no concurrent
heavy verification, and those cases passed. Contention is not a proven cause.
That run instead ended `1 failed / 459 passed (38.4m)`, `PUSH_EXIT=1`, at the
embedded prototype's pre-press hover check.

The prototype failure also occurred alone (`menu-prototype-hover-repro.log`),
and its trace is retained. A separate controlled hover movement reproduced the
helper waiting on an obsolete pointer coordinate for 45 seconds while the
same target had moved from x=88 to x=388. It now repeats only the bounded
pre-press targeting, retaining real child hover, child hit testing and the
exact parent iframe hit (not merely any iframe). Once pressed it never retries.
The three harness guards cover the movement and invisible parent/child covers;
all four original catalogue cases remain. Final subset: `7 passed (41.3s)`,
`E2E_EXIT=0`, in `menu-prototype-pointer-fixed.log`. This establishes the
targeting repair, not the precise cause of every earlier intermittent failure.
The resulting complete local check passed (`menu-prototype-verify.log`,
`VERIFY_EXIT=0`). The next normal push remains the final browser boundary.

