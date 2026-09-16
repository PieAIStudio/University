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

Original implementation: `codex/interaction-first` at `0d962d12`. Gameplay
continuation: `codex/interaction-gameplay`, based on a preserved working diff
and untracked-file snapshot of that lane. The prior directory was still being
updated during inspection; the continuation therefore owns a separate checkout
and a full copy of the isolated public-source studies. No commit, push, publication,
cloud writes, other checkout edits or writes through linked studies. The
director owns real lesson writing and independent review. This is a local
extension of the shared reader and existing activity/recovery contract.

## Steps

- [x] Inspect routers, recall, source isolation and native recovery contract.
- [x] Amend V5 before implementation; publish the schema handoff in
      `.scratch/interaction-path-schema.md`.
- [x] Add typed path validation, deterministic rules and generic fixtures.
- [x] Add shared accessible round UI and isolated in-memory attempt evidence.
- [x] Add opt-in authoring checks; prove native isolated round trip.
- [ ] Run focused checks, real browser evidence, `pnpm verify`, default `pnpm e2e`.
- [ ] Integrate director samples if available; otherwise leave exact commands
      and remaining acceptance items. No indefinite wait for content.
- [ ] Gameplay continuation: tangible live artifact, document-shaped evidence,
      compact mobile layout, explicit feedback and accessible interaction.
- [ ] Same-checkout before/after browser flows, independent visual critic,
      focused and full checks; leave a verified local preview for Owner.

### Gameplay direction and evidence boundary

The prior round is functional, but reading it as a player exposes a form-like
ending: candidate sentences precede the work, and every selected sentence adds
three large controls. The first phone screen also gives 56px of its width to a
floating feedback control. This continuation changes those observed affordances,
not the brand, content facts or grading contract. The output remains an authored
exercise artifact, never a fabricated live model response.

Research informs design, not efficacy claims: Duolingo's official chess-course
description (https://blog.duolingo.com/chess-course/) describes moving from guided
puzzles toward actual play; the PENS authors' overview
(https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)
links usable controls, clear feedback and meaningful choice with need satisfaction.
These motivate a usable task and visible consequences, not more compulsory taps.
Neither source proves this prototype improves learning or exceeds Duolingo.

Fresh continuation evidence lives in `.devspace-visual/gameplay/`. Inherited R2
receipts remain in the original worktree's `.devspace-visual/interaction-first/`.

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
issues are recorded here when checks finish. The source root remains read-only;
native recovery writes only to an explicitly initialized isolated root.

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
expanded wording. No test timeout or learner completion rule was relaxed.
