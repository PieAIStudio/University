---
id: PLAN-MAP-LEARNING-NODES
title: Personal lessons, practice games and checkpoints on the course map
type: plan
status: active
canonical: true
owner: project
created: 2026-09-18
last_reviewed: 2026-09-19
domain: learning-experience
tags:
  - learning
  - course-map
  - personalization
related:
  - SPEC-0001
  - ADR-0009
supersedes: []
superseded_by: null
---

# Map learning nodes

## Scope and baseline

Owner authorized a separate experiment, `codex/map-learning-nodes`, under
`.worktrees/map-learning-nodes`. Base `ca2c7d3f` includes committed main and the
existing PRIMM/game work. Main has concurrent navigation changes; do not absorb,
edit, reset or commit them. No push, deployment, shared-study mutation or public
course publication is part of this task.

## Product decisions

Three different promises, not three ways to earn the same completion flag:

- **My task**: an optional need-driven lesson, generated only on request. A
  private, validated native lesson; learning enrolls its cards in the existing
  review scheduler. A failed generation is not a ready lesson. Do not put
  learner text or personalized packages on the public shelf.
- **Play to practise**: a side-path game using nearby course material already
  studied or proved. Three minutes is an optional session target, not a forced
  speed test. Pause, leave, retry and untimed practice remain possible. Game
  points do not prove lessons or silently rate FSRS memory strength.
- **Checkpoint**: a visible segment-boundary assessment. It names the lessons
  covered, tests each rather than extrapolating a lucky sample, and records
  proof without pretending the learner read them. Unassessable material cannot
  be silently skipped. No new review cards for unread skipped lessons.

Group by existing unit boundaries and stable lesson order, normally 3–5 lessons.
Do not append all three mandatory tasks after every block. Personal and game
nodes are optional; checkpoints are available before studying a familiar block.
Course lesson count/order and island blueprint stay unchanged. Project simple
accessible DOM markers from the existing road; no new 3D art direction.

The local pilot must be useful while production capabilities remain honest.
Reuse the authoring workflow, lesson schema, shared reader, ProgressPort and
brand model transport. Generation is bounded, cancellable and idempotent; no
arbitrary executable HTML, shell commands, untrusted URL fetching or automatic
paid requests. A production capability that is not connected explains that
boundary instead of serving a fake result.

## Work checklist

- [x] Inspect main, preserve concurrent work, create and prepare the one worktree.
- [x] Inspect existing skip-test, content/authoring, game and review paths.
- [x] Record learner behavior in the current journey before implementing.
- [x] Implement deterministic block planning and map node placement.
- [x] Implement checkpoint coverage/proof using the shared assessment domain.
- [x] Implement a replayable, pausable game session over nearby course content.
- [x] Implement private native lesson generation, learning and review integration.
- [x] Verify errors, cancellation, account separation, retry and duplicate writes.
- [x] Walk the actual map and all three flows on desktop and touch-size layouts.
- [x] Run focused checks and full verification; preserve any unrelated failures.
- [x] Provide the exact worktree preview and a truthful completion/limits receipt.

## Evidence and tradeoffs

The first release optimizes user task relevance, practice and honest proof, not
new scenery or maximum course count. Personal generation has a bounded per-request
model cost; do not call it free unlimited commercial infrastructure. No pricing
or subscription policy is changed. Scope growth stops at the three end-to-end
node behaviors; real learner efficacy and production multi-user operations are
separate validation, not results inferred from passing tests.

Design reference: Duolingo separates optional practice/side quests from the
course path. Its product descriptions are precedents, not efficacy evidence:
<https://blog.duolingo.com/ways-to-practice-in-duolingo/> and
<https://blog.duolingo.com/new-duolingo-home-screen-design/>.

## Current implementation boundaries

The first playable slice generates text-based PRIMM lessons from the surrounding
installed, already-reviewed source corpus. It does not research arbitrary new
webpages, promise every requested topic is supported, or publish personal
requests. The owner preview sends the learner's need to the configured writing
service after an explicit Generate action; the input warns against including
sensitive information. It is not an offline-only claim. Native lesson creation,
independent teaching review and Gemini Flash wording polish precede readiness.

Generation survives closing its dialog. The need being written and unfinished
input are recoverable; drafts are scoped to account and segment. The local
loopback owner namespace is deliberately not production authentication. Public
hosting, authenticated per-user quotas, billing, private-content cross-device
storage and broad source discovery remain separate release prerequisites.

The first game is a multi-board matching relay, reusing the existing connection
engine and exact reviewed card content. It is one reusable game, not a claim that
all historical arcade prototypes are integrated. It only draws from studied or
proved nearby lessons; no eligible material produces an explanation, not a
fabricated deck. Completion records practice, not memory strength or skip proof.

Checkpoints cover every native exercise in each eligible lesson. An existing
question explicitly asking to copy one of two quoted choices can render those
same choices as buttons; the original exact answer key remains authoritative.
Open-ended practical work is listed as not assessed instead of being inferred
from a few fact questions. The first PRIMM lessons therefore cannot be skipped
through this short-answer checkpoint; the ordinary practical task remains usable.
This is a navigation recommendation, not a certificate of comprehensive mastery.

## Acceptance evidence

Original and resumed results stay in `.devspace-visual/map-learning-nodes/`
and `.scratch/map-nodes-*.log`; the closeout receipt names the final runs.
The first resumed English failures came from the test fixture submitting the
Chinese reference answer: the public-content localizer intentionally does not
expose private `expectedAnswer` fields. The corrected test reads native localized
references and verifies each against its exact key before submitting it.
Six focused browser cases then passed without loosening product grading.

Full verification initially encountered unrelated world geometry timing limits
under host load. Preserve those failures and rerun without changing the CPU
budgets; an isolated pass is not a full-verification pass. Real-user learning
benefit and scalable commercial operation are not inferred from these checks.

Final scoped browser regression passed all six cases across both modes and
languages (`.scratch/map-nodes-resume-e2e-release.log`). Personal draft, grade
restoration and review inclusion passed seven focused tests. The full world
suite passed all 991 assertions when serialized with `--maxWorkers=1
--no-file-parallelism`, with its original timing budgets unchanged. The default
parallel `pnpm verify` run is still recorded as failed, not relabelled as passing.

An actual new request to turn a group notice into a departure reminder passed
native authoring, independent review and Flash polish. Browser play completed
Run, Investigate, Modify and Make, corrected the AI's stale-floor draft, restored
the saved assessment after reopening, copied the final work and added one card
to the native FSRS queue. The existing model still sometimes gives an inaccurate
reason for a failure; it is not promoted into checkpoint certification.

The release-gate continuation passed builds and content/public-boundary checks
but found `ai-literacy/understanding-ai` recovery freshness divergent from the
shared main study source. This branch does not own that source and has not
rewritten the other lane's course or recovery export to hide the difference.
Remaining gates were executed separately and recorded. Align course source and
recovery with the chosen integration baseline before merging or publishing.

Owner preview: `http://127.0.0.1:23160/ai-literacy/understanding-ai?lang=zh-CN`;
private authoring service: `http://127.0.0.1:23161`. The review receipt is
`.devspace-visual/map-learning-nodes/owner-review-brief.md`. Keep this plan active
for Owner review and the explicitly unimplemented release prerequisites above;
do not interpret a playable local slice as production completion.
