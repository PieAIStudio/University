---
id: PLAN-INTERACTION-FIRST-EXPERIMENT
title: Interaction-first lesson experiment
type: plan
status: active
canonical: false
owner: ai-assisted
created: 2026-09-16
last_reviewed: 2026-09-16
domain: learning
tags:
  - lesson-reader
  - interaction
pinned: false
related:
  - SPEC-0001
---

# Interaction-first lesson experiment

## Scope

The sole worktree for this session is `.worktrees/interaction-first`, on
`codex/interaction-first`. Owner explicitly authorized consolidation of the two
Codex experiment branches. Local preservation commits and their merge are part
of that consolidation; no mainline merge, push, production publication or cloud
writes are authorized. Do not open another worktree for this lesson experiment.
Other sessions' branches, including `claude/interaction-research`, remain outside
this task. Course writes stay in the isolated authoring corpus.

## Steps

- [x] Inspect routers, recall, source isolation and native recovery contract.
- [x] Amend V5 before implementation; publish the schema handoff in
      `.scratch/interaction-path-schema.md`.
- [x] Add typed path validation, deterministic rules and generic fixtures.
- [x] Add shared accessible round UI and isolated in-memory attempt evidence.
- [x] Add opt-in authoring checks; prove native isolated round trip.
- [ ] Run focused checks, real browser evidence, `pnpm verify`, default `pnpm e2e`.
- [x] Integrate three real bilingual samples through native revision, recovery
      export, reactivation and the guarded content importer.

## Design and reuse

Inherit SwimmerUIKit buttons, panels and tokens; extend LearningActivity and
LessonReader. Reuse existing activity localization and recovery/export paths.
Existing contrast and repair engines assume different tasks and result shapes;
the bounded semantic-piece rubric needs its own small pure evaluator. No new
dependencies, model calls, progress backend or canvas text. The path is guided
practice; first attempts and help survive retry/reset within this reader visit.
Leaving the lesson, revision, locale or account discards this in-memory draft.

## Evidence and closeout

Evidence: `.devspace-visual/interaction-first/`. Command receipts and outstanding
issues are recorded here when checks finish. Original sources remain read-only;
native recovery writes only to the worktree's `.scratch/interaction-studies`.

### Review iteration R2

The recovered implementation was not accepted merely because files existed.
Independent Gemini Flash review (`acceptance-r2/detector.md`) identified a
repeated fifth question after the artifact, a contradictory “format undecided”
tail, repeated date-selection between samples, and unlabeled comparison drafts.
The revision removes those tails, distinguishes source selection from locating
an unsupported draft sentence, and starts the third artifact from a real
prefilled teaching draft. These are teaching designs over verified public
records, not transcripts of live AI calls.

The first fresh mobile pass found the one-control tool row wasting a second
line and feedback scrolling its next button off screen. The scoped layout
keeps the existing feedback-control safety lane, uses a one-row toolbar, shows
the photo once with optional recall, and scrolls feedback and next action
together. An activity-definition change also resets its state even when its
occurrence slot remains the same. The legacy reader and thirteen games remain.

Focused tests passed: 20 core-rule cases, 5 UI cases, and 2 native pipeline
cases. Full verification initially stopped at formatting of the new
`lesson-spine.d.mts`; that was corrected, not waived. Full final verification
and browser acceptance are recorded below once complete. A separate review
also caught a formatter damaging the old evidence-token examples in the
authoring skill; the original examples and unrelated formatting were restored.

The native revisions shortened only `understanding-ai` by 8,427 served bytes;
all five other course byte counts and package hashes were unchanged. The old
aggregate byte guard incorrectly called this missing source evidence. The
importer now checks each course independently and allows a shorter public-source
revision only after verifying both immutable package hashes, unchanged lesson
identities, increased changed-lesson revisions, and identical sources, assets,
cards and exercises. Missing packages, code-evidence shrink, removed material
or same-hash shrink still fail; growth elsewhere cannot conceal shrink. No
`--allow-shrink`, evidence-mode switch or manifest reset is used.

The focused browser suite passed all 13 cases (three real lessons, two modes,
two languages, plus package coverage). The first default full-suite attempt
caught a real test-contract mismatch: the shared settlement helper still
searched only for “我读完了”, while the interaction design explicitly names
the same confirmation “我学过这一版了”. The run was stopped after preserving
its failure log; both valid visible labels are now accepted, and that helper
opens the actual full explanation before confirming. Grading, settlement and
avatar-location assertions are unchanged. The authoring smoke uses the same
expanded wording. No browser-test timeout or learner completion rule was relaxed.

The full unit/integration run later exposed a separate existing profile test's
5-second execution deadline: its full UIKit badge wall took 3.372 seconds alone,
10.226 seconds in the full run, and 5.147 seconds in an app-suite recheck. Its
lazy avatar is replaced only in that DOM test; real browser coverage retains
the renderer. The two whole-profile DOM cases now have an explicit 15-second
execution budget, with every assertion retained. This is not a claim that the
product got faster, nor a change to a browser performance threshold. The whole
app suite then passed 58 files / 305 cases and its two baked-grid checks.

All unit suites passed in the next full run. Its later brand-token gate then
caught two legacy prototype references to the nonexistent `--game-ui-border`;
both now use the kit's real `--game-ui-border-subtle`. The gate was retained.

The independent visual reviewer actually read four fresh mobile screenshots
and reported no Owner-trial blocker (`acceptance-r2/visual-critic.md`). The
director separately completed the source-check/repair flow, copied its output,
and verified that its handoff focuses an empty independent-answer field. The
scoped interface detector returned no findings. These establish operability,
not human motivation, delayed retention, independent mastery or conversion.

## R2 sample baseline (preserved before consolidation)

The indexed local package is
`sha256:b5fc23c79d23c5e9a595a4e5d41eae6ced144e6f226cacfdc134ef4cde1c2fc6`.
All three lessons are in `ai-literacy/understanding-ai`, with four rounds each:

| Position | Lesson | Revision | Distinct end task |
| --- | --- | --- | --- |
| 1 | `first-useful-step/ask-about-a-picture` | 4 | Build a photo request with separate evidence checks |
| 3 | `first-useful-step/name-the-result` | 3 | Assemble an explicit historical information-card request |
| 19 | `check-what-matters/follow-a-claim` | 3 | Repair a prefilled caption, retaining verified facts and its source |

The full original explanations, source records, card IDs and independent
exercise IDs remain. Old three-character checks are not represented as a
rigorous transfer evaluation. Production publication and mainline integration
are not part of this experiment. The old `c9be...` package and scratch drafts
are historical evidence, not additional live courses or queued work. The optional
scratch image-deletion proposal was not applied; the accepted source-check
lesson remains revision 3, including its first-round image.

The retained delivery preview is `http://127.0.0.1:23150`; append
`/ai-literacy/understanding-ai/` and a lesson path from the table. Its listener
was verified to belong to this worktree, not main; recheck ownership on resume.

## Consolidated workbench continuation

The short-lived `codex/interaction-gameplay` lane extended the same three
samples: live editable artifact, stable toggled piece bank, optional reorder,
choice-specific visual feedback, a real image beside the final caption, and a
scoped mobile toolbar position for the existing feedback control. It fixed a
duplicate React key that could leave stale image disclosure controls. The
other lane's explicit CSS package export/import, real brand border token, and
statically discoverable translation keys are retained, not overwritten.

The two native isolated source corpora were byte-identical. Both source versions
are preserved by local checkpoint commits and an ignored reconciliation snapshot
under `.scratch/interaction-consolidation/`. The original R2 records remain in
`.devspace-visual/interaction-first/`; gameplay before/after images, independent
review and interrupted full-run logs are preserved in `.devspace-visual/gameplay/`.
Those old images identify their original worktree/port; merged acceptance needs
fresh captures from the retained checkout.

No earlier partial full run is accepted as a green regression. The interrupted
parallel run reached a heavily loaded Mac (load average above 230) and a world
geometry timeout. Rerun verification sequentially with `VITEST_MAX_WORKERS=1`,
which the installed runner supports, without raising assertions or deadlines.
The independent screenshot critic's breadcrumb clipping finding is fixed with
real text ellipsis. A scrolled-away page title is not evidence that the current
question or recovery button is blocked; validate their measured bounds instead.
The sound button is not TTS, and reorder is keyboard/button operation, not drag.
Human enjoyment, retention, transfer and conversion remain unmeasured.
