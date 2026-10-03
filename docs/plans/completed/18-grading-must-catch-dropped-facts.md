---
id: PLAN-18-GRADING-MUST-CATCH-DROPPED-FACTS
title: "18 · Grading must catch dropped required facts"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-10-03
last_reviewed: 2026-10-03
domain: execution
tags:
  - grading
  - regression
  - pipeline
related:
  - REF-WORK-QUEUE
  - PLAN-12-PIPELINE-STEP-LESSONS
  - PLAN-13-RETIRE-OLD-COURSES
---

# Task 18 · Grading must catch dropped required facts

## 1 Authority and order

**Do this task after 13, before 14.** Do not renumber the queue. Owner authorized
this repair on 2026-10-03 as the freeze exception for a feature that did not
actually work: SW-T12-001 is a grading failure, not a request to rewrite a lesson.
One task, one commit, one ordinary push; no deployment or course publication.

Task 12 stays active awaiting Owner reading. The fourth lesson's authoring r7,
prose, real responses and writing receipts stay intact. The typo `水龙龙头` waits
for Owner reading and joins that feedback in review → fix; do not change it here.

## 2 Preserved failure

Task 12 source was delivered as `1444152dc6a1ffcd4ae1ec6263c4a5d35a76dcde`.
Evidence root: `.scratch/primm-engine/task12-20261003/`.

- `owner-reading-1280/receipt.json` retains the original real Make response,
  submission and passing `/grade` response; `7-make-own.png` shows the false pass.
- `owner-review-brief.md` records SW-T12-001. The 166-character original answer
  dropped the photos, repair deadline and one-month delay from the required facts.
- `edit-one-part/preview.json` identifies the exact native preview source and
  its immutable recovery hash. Use that lesson's actual exercise and all four
  rubric entries, not a re-created exercise with easier expectations.
- `owner-reading-1280-complete/receipt.json` retains a later learner-corrected
  work. It does not replace the original failure.

Copy the exact bad answer and necessary immutable grading inputs into a normal
regression fixture with provenance and source hashes. Never regenerate the bad
answer with a model, shorten it, or overwrite its original receipt.

## 3 Reproduce before fixing

Add a stable regression that runs the existing grading decision with the fixed
original answer. Preserve/replay the recorded structured model verdict where
needed to isolate generation variance. Demonstrate that the unfixed decision
accepts this incomplete work; save the failing regression and its output before
changing behavior. Identify the precise seam the reproduction covers. Replaying
an HTTP `pass` without running the actual grading decision is not a reproduction.

Inspect and record the local preview, authoring host grading, delivery small-model
grading and pipeline sample-evaluation paths. Name the shared decision logic and
any actual divergence. Do not assume the preview and delivery are identical.

## 4 Repair outcome

An answer missing a fact required by its grading criteria must fail. Required
criteria cannot be averaged away by fluent writing, a successful tone change,
an overall model score or a self-reported model `pass`. Make the decision shared
where both modes implement the same product rule, preserving their AI-source
port boundaries. The delivery path must enforce the same requirement.

The original bad answer must fail through both relevant paths. Include focused
cases that omit each of photos, repair deadline and delay individually, plus a
complete answer and a faithful paraphrase that still pass. Missing, incomplete
or contradictory per-criterion evidence must not silently become success.
Use the smallest general repair supported by the actual schemas and decision
logic; do not hard-code this lesson ID or the photographed sample answer.

Retain deterministic-first grading, provider-kit access, metering and quota
boundaries. Use fixed provider replies/mocks for ordinary tests. Authorized real
creative sample evaluation stays on the existing task 12 pipeline; do not start
paid cloud acceptance or deploy while repairing grading.

## 5 Fourth-lesson sample evaluation

Pipeline trial runs also grade their real samples. After the fix, run the existing
sample evaluator again for the selected fourth-lesson version against its saved
real responses. Preserve previous scores/receipts and write new results under a
separate run identity. Do not rerun the Writer or earlier Fixers to obtain a more
convenient answer. Report each sample's required-criterion results and explain
changed verdicts. If a necessary sample must be generated, identify why and retain
the unmodified output separately.

Record the exact source/package hashes, evaluator version, before/after counts,
commands and receipt paths in this task. A failed sample remains a failed sample;
do not substitute the learner-corrected work or rewrite course prose here. Any
teaching correction returns to task 12's review → fix after Owner feedback.

## 6 Acceptance and delivery

- The fixed real-answer regression is red before repair and green after it;
  original bad work fails in preview and delivery decision paths, required-fact
  omission cases fail, and complete/paraphrased work still passes.
- Native preview browser evidence shows the preserved incomplete work does not
  receive completion credit. Verify delivery enforcement through its actual
  grading boundary with isolated provider replies and learner data.
- Re-evaluated fourth-lesson samples and all failures are recorded here.
- Task 12's pending lesson, typo and original receipts remain untouched and
  unpublished. Preserve existing learner history; this repair prevents new false
  passes and does not silently rewrite historical answers or progress.
- `pnpm verify` is green; the complete browser floor is at least 431 and timing
  retains 40 cases (use any higher task 13 delivered counts). No test deletion.
- Before normal push, one-minute load is below 20 and no other Playwright suite
  is running. Quote gate counts and keep the push receipt. Apply the queue's
  2026-10-03 failed-case isolation and bounded push retry before stopping.
  If a model route is exhausted, preserve its error and use the authorized
  available route; only an unfixable full gate or an Owner-only action stops work.

Move this plan to completed in its single delivery commit only when these gates
are met. Then continue to 14 according to the queue.

## 7 Delivery record

The exact preserved answer is in
`apps/university-ai/src/primm/fixtures/task18-dropped-facts.json`; it was copied
from `owner-reading-1280/receipt.json` without model regeneration. Its fixture
hash is recorded in the file, together with the recovery package hash and the
fourth lesson's native activity/exercise. The red reproduction is
`.scratch/overnight-20261003/task18-red-before-fix.json` and its unchanged log is
`.scratch/overnight-20261003/task18-red-before-fix.log`: before the repair, the
existing runtime decision returned a pass for the 166-character answer. The
post-fix runtime regression is `runtime.test.ts`; it keeps the original answer
failing, fails each of photo, one-week deadline and one-month delay separately,
and passes a complete answer plus the faithful `现场图` paraphrase.

The rule now lives in the shared `@pieai/university-core` helper
`requiredFactCoverage`. Native preview grading atomizes every authored criterion
into quoted facts and rejects fabricated or incomplete evidence; delivery sends
the authored PRIMM checklist to the metered service, which applies the same
helper before returning a host pass. The browser port still keeps the AI-source
boundary and only sends the public checklist; the service cannot independently
authenticate that client-supplied checklist against a published package. This is
an existing delivery-content boundary and is recorded for Owner review rather
than widening this freeze repair.

The saved fourth-lesson sample evaluator is
`.scratch/overnight-20261003/task18-sample-evaluate.mjs`, run against the saved
v7 response with a deterministic structured fact grader (no new model output).
Receipt: `.scratch/overnight-20261003/task18-sample-evaluate.json`.
Results: `samples.v7.make` (169 Unicode characters) changed from the historical
false pass to **fail**, the preserved original (166 characters) is **fail**, and
the separately retained Owner-corrected work (206 characters) is **pass**.
Criterion 3 fails on both missing photo evidence and missing one-week deadline;
the corrected work passes both. The sample output is a new run identity and does
not replace task 12's receipts or prose. The existing preview screenshots remain
the native browser evidence; the new runtime and delivery boundary tests are the
regression evidence for the grading outcome.
