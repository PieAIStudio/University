---
id: PLAN-V7-03-SPLASH-AND-FIRST-MEETING
title: "V7 · 03 Splash, transition screen and 涟's first meeting"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-28
domain: learning-experience
tags:
  - v7
  - onboarding
  - uikit
related:
  - REF-WORK-QUEUE
  - ADR-0012
supersedes: []
superseded_by: null
---

# Task 03 · Splash, transition screen and 涟's first meeting

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) stations 1
  ("打开 App：开屏动画") and 2 ("第一次见面：涟来打招呼").
- Brand-kit-first: the installed SwimmerUIKit 2.11.0 already exports `GameSplash`.
  Consume that published component; University supplies claims and readiness,
  not a second splash renderer. No further kit release is needed for this task.
- 涟 is SwimmerNerveKit 0.7.0 (ADR-0012's September 28 amendment). Its
  `createNerveOpening` carries product cards and updates pages inside one opening;
  `createGuidanceWalk` points to registered real destinations (one step here).
  University supplies the language getter through its existing I18nKit reader.
  Do not fork the kit or add a conversation/model service.
- Learner-visible strings go through whichever i18n mechanism the repository
  uses when this task starts (`packages/ui/src/i18n` today; SwimmerI18nKit once
  its adoption lands), in zh-CN and en.
- Depends on none of 01–02. Independent.

## 1 Outcome

A newcomer opening University sees rotating true selling points over a real
loading bar, taps once to enter an island that is already complete (music may
start with that tap), is greeted only by 涟 — one question per page — and within
three taps is standing at lesson 1 with its chest pointed out.

## 2 What the Owner said

> 「它在第一次打开的时候必须出现。然后在转场的时候，如果没有卡顿就不用出现。」「点击之后……音乐就能播放起来。」
> 「如果一些选择、智能的面板都在（涟）那里面的话，就更统一了。」「分页是 OK 的呀，分页反而降低了认知负担。」
> 「你要加的第三样，在我说的那个开屏动画里面就得提及……」 (why not just ask ChatGPT)

Binding decision I1: on the web, a tap enters every time; desktop and phone
apps enter automatically when loading completes.

## 3 What "done" looks like

- Splash: two or three selling-point lines per opening, one keyword lit in each,
  rotating across visits, from V7's list of seven. The line "当下最强的几家
  AI，在这里一起用" is withheld until the delivery build's AI grading is live.
  The why-not-ChatGPT line always appears on a learner's first opening.
- The progress bar tracks real readiness: island geometry, trees, avatar
  downloaded and first frame drawn. It never sits at a fake 99%. "点一下，开始"
  appears only at 100%. The existing loading principle "不强迫任何人多看两秒"
  still holds: no deliberate delay.
- Transition screen: same look, one line and the bar, no tap; shown only when a
  scene change (planet → island, lesson → island) is still not drawn after 2 s.
- The white welcome dialog is gone. 涟's panel carries: page 1 greeting and the
  two path cards (button inside each card), "不知道选哪个？我帮你选" and
  "我用过 AI，先测一下"; page 2 appears only for "帮你选" (two fixed questions,
  rule-based, no model call); page 3 is 涟 flying to lesson 1's stone:
  "这是你的第 1 关。旁边的木箱，学完就归你。" — one step, dismissable.
  "已有账号？登录" and "直接选课" stay as small text on page 1. Returning
  learners never see this sequence.
- On a phone the two path cards stack and the panel does not cover lesson 1's
  stone.

## 4 Out of scope

- 涟's "继续第 N 关" for returning learners: task 04.
- The membership page's copy of the why-not-ChatGPT line: task 09.
- Course-duration estimates ("大约 5 周") are shown only once measured; until
  then show the lesson count.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Browser specs: first open shows the splash and no welcome dialog; the enter
  control appears only when the scene reports ready; a fast transition (<2 s)
  never shows the transition screen and a throttled one does; a newcomer reaches
  lesson 1 in at most three taps; a returning learner sees none of it.
- Capture: phone and desktop, splash mid-animation, 涟 pages 1–3.
- Existing onboarding and welcome specs that asserted the old dialog are
  rewritten to the new behaviour in the same commit, and the commit body names
  each one; the pass count may not fall.

## 6 Delivery discipline

One task, one commit, one push in this repository (the UIKit release is its own
commit and release in its own repository first); stop if the complete gate
cannot go green; never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, the UIKit version released, the captures, anything
noticed but not done.

## 8 Implementation and acceptance

The inherited red-gate, academy and cloud-return repairs are already on remote
main. Their retained push log reports `413 passed (26.9m)`, `37 passed (5.5m)`
and `PUSH_EXIT=0`; the following documentation commit is `f086017f`. These are
the inherited baseline, not task 03's acceptance results.

`OpeningSplash` composes the published UIKit component. The scene reports real
content, asset and nested-Suspense readiness after its existing output pass;
reading the loader's store in that pass avoids render-phase state updates.
The same component covers only slow later transitions, with a bounded visible
hold and an explicit recovery state on timeout. Web entry is a real button press.

The retired welcome dialog is replaced by product cards in one Nerve opening.
Two real catalogue routes, fixed preference questions, test/browse/sign-in exits
and a one-step registered destination share the existing scope and controller.
The obstacle-aware close-up frames the real avatar and unopened chest using the
actual perspective aspect; no island, scenery or chest placement is changed.
It waits for the current canvas attempt's framing before pointing. Cancelled
measurements cannot revive when the same lesson becomes ready again.

T1, T4 and U2 now exercise this flow rather than the retired dialog. W3/W4 moved
to `WelcomeCards.test.tsx` with additional cases, not deleted coverage. Ordinary
route specs use `harness/learner-test` to press the ready-only launch button;
they never remove the cover or fake readiness. The isolated authoring fixture
strips legacy learning fields from HTTP responses only, preserving real content
and the owner's database. Its lesson matcher excludes images and other assets.

### Acceptance evidence

The final implementation passed the complete local and browser gates before
this plan left the active queue. Retained local evidence lives under
`SCRATCH/v7-execution/`:

- `opening-final-focused.log`: `9 passed (2.0m)`, including both modes, 1440px
  Chinese, 390/320px English, re-entry and the existing chest ceremony.
- `opening-map-regression-r2.log`: `33 passed (2.8m)` across introduction,
  navigation, Nerve questions/comparison, context recovery and chest opening.
- `opening-timing-r2.log`: `2 passed (45.6s)`, `TIMING_EXIT=0`; held required
  models do not admit the learner, slow transitions require two seconds, and
  returning to the already-drawn overview does not flash a cover.
- `opening-cancelled-layout-red.log` reproduces the stale callback; the fixed
  `opening-cancelled-layout-green.log` reports `6 passed`.
- `opening-recovery-focused.log`: `1 passed (30.8s)`, `E2E_EXIT=0`; a restored
  canvas frames again before the guide returns and still enters the real lesson.
  Reintroducing the stale receipt in `opening-recovery-stale-receipt-red.log`
  makes the same case fail with the guide stuck at `unavailable`. The correct
  per-attempt check was restored before final validation.
- `opening-verify-r3.log`: `VERIFY_EXIT=0` for the final camera and lifecycle
  code, including all workspace tests, builds, boundaries and document checks.
- `opening-e2e-all-candidate.log`: `421 passed (19.1m)` in the default lane,
  `39 passed (5.4m)` in the single-worker timing lane, `E2E_ALL_EXIT=0`.
  The default lane includes the new canvas-restore regression. No browser
  case was removed or made skippable, and no timing threshold was relaxed.
- `opening-candidate-source.json` fences the 109 changed implementation/test
  paths by SHA-256 against base `f086017f`; final validation used those bytes.
  The normal pre-push hook remains mandatory; this candidate pass is not a
  hook bypass or a production release.

Actual screenshots remain in `SCRATCH/e2e/v7-opening/` (mode, locale, width and
page in each filename). `opening-final-independent-review.txt` is retained as
independent commentary, not rewritten into a pass: it accepts the desktop and
finds the narrow views crowded. Direct inspection of the same 320px captures
confirms the rabbit, first stone and adjacent wooden chest remain identifiable
and clear of the guide text; both route buttons and sign-in/browse text remain
inside the image. Foreground locked stops are not the first stone. The browser
onboarding checks separately retain button bounds, hit testing, no horizontal
overflow, and zero axe violations. Screenshots do not prove physical-device
interaction. The broader experience suite still reports its pre-existing
accepted feedback-dialog exit/accessibility debt; this task neither removes
that baseline nor represents the entire site as free of accessibility issues.

### Boundaries and superseded findings

Native `autoStart` is tested at the shared component boundary; no installed
Electron/Capacitor host or physical phone is claimed as verified here. The
untranslated course preview is explicitly identified in English; this task does
not translate or publish course content. No model, voice, authentication, billing,
reminder delivery, production deployment or backend release is enabled.

Earlier logs and critics are kept: the heading-level and unreachable horizontal
hint-scrolling failures, the authoring legacy-progress fixture, render-phase
loader notifications, premature screenshots and near-field occlusion led to the
fixes above. `opening-verify-r2.log` was green before the final camera/lifetime
changes and is not reused for them. The interrupted `opening-verify-final.log`
is not a successful gate. Tool-layer blocked diagnostics were not retried through
another channel. Task 04's continue/wrap-up flow remains the next independent
task. The two owner-supplied reference directories remain outside this task's
commit. Native-host and physical-device acceptance stay explicitly unclaimed;
the completed implementation and gates here are the shared web application.
