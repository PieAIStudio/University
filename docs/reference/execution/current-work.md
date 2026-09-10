---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-10
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related:
  - PLAN-CONTINUOUS-WORLD-DELIVERY
  - ADR-0008
  - ADR-0009
  - REF-LOCAL-DEVICE-TESTING
  - REF-FEEDBACK-BACKEND-GAP
  - REF-V5-JOURNEY-REVIEW
  - ADR-0010
---

# Current Work

This page routes active work; it does not duplicate project rules, task states,
test totals, CLI/model choices or execution history. Read only the matching row.

## Active lanes

| Task | Authoritative entry |
| --- | --- |
| Mainline iteration, teaching contracts and remaining 3D acceptance gates | [Continuous world delivery](../../plans/active/continuous-world-delivery.md), starting with its current continuation section; preserve the implemented pipeline and follow the remaining task IDs rather than restarting the scenes |
| Learner-visible design | [Player journey V5](../player-journey/v5/index.html), including decision M; only consult V4 for behavior V5 does not amend |
| Technique, measurement scope and rejected alternatives | [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) |
| Shared blueprint/field, projections and source entry points | [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) |
| Local preview, iPhone/Android, Web-to-local tools | [Local device testing](local-device-testing.md) |
| Course authoring and each lesson's teaching shape | [Parity contract](../../specs/active/SPEC-0001-universitylocal-parity-contract.md), then the single [write-lesson contract](../../../apps/local/.agents/skills/write-lesson/SKILL.md); use `apps/local` workflows and keep publication separate |
| Which interactive activity a lesson gets, and where it sits | [Activity selection](../../../apps/local/.agents/skills/write-lesson/references/activities.md), decided with the variant at step 3 of [write-lesson](../../../apps/local/.agents/skills/write-lesson/SKILL.md); every new lesson carries at least one — `LessonCreationProposalSchema` requires it and refuses an activity the prose never points at. Lessons written before 2026-09-09 are counted, not failed, by `lint-lessons` |
| Activity payloads, engines and difficulty tiers | [Component contract](../../../packages/ui/src/learning-play/README.md), [interaction design](../../../packages/ui/src/learning-play/DESIGN.md) and [prior acceptance evidence](../../plans/completed/play-usability.md); an embedded activity never substitutes for a lesson's graded exercise, and `pnpm check:activities` names the lessons an engine change breaks, and checks that each activity's citation still points where it says |
| Where a learner starts, what is dimmed, and testing out of a unit | [V5 decision 12](../player-journey/v5/index.html); unlocking asks `CourseProgress.proven` (exercises passed), never `complete`, and self-report proposes what to test out of rather than unlocking anything |
| Whether difficulty adapts by itself | [ADR-0010](../../adr/ADR-0010-difficulty-moves-when-the-learner-moves-it.md): it does not. The learner moves it; the system never infers a level. Read it before adding anything that watches performance and re-routes |
| What a unit the learner tested out of looks like on the map | **Undecided, and it needs deciding before it is built.** `placeCourse` in `packages/world/src/Maps.tsx` gives each lesson tile one of `done` / `live` / `idle` / `locked`, and a lesson proved through the skip test currently gets `idle` — identical to one never opened. V5 §12 决定 E says proved is not learned, so it cannot borrow `done`; a fifth state is a learner-surface design decision that belongs in [the journey](../player-journey/v5/index.html) first. The unit-entry card already says it in words; only the scene is silent |
| Designed but unfinished learner/business capabilities | [V5 review](v5-journey-review.md), [payment](payment-backend-gap.md), [feedback](feedback-backend-gap.md), [reminders](review-reminders-backend-gap.md), [commercial model](commercial-model.md) |

## Work boundaries

The active plan records mainline work and explicitly started worktrees. Do not
pre-create future course or visual worktrees while main is still being refined;
create a lane from the then-current main only when the user actually starts it.
Recheck Git and process ownership before writing; a historical receipt is not
permission to reset, delete or take over another task. Preserve original material
before retiring a worktree. Preserving an experiment does not accept its behavior.

One browser app, two modes: `apps/university` uses `--mode delivery` or
`--mode authoring`; `apps/local` is the authoring Node server. Shared domain
logic is in `packages/core`, learner DOM in `packages/ui`, rendering in
`packages/world`. The complete boundary contract remains in root `AGENTS.md`.
Coordinate course IDs, ordering and shared learner contracts across lanes.

## Verification and recall

Use [the project baseline](../../policy/best-practice-for-this-project.md) for
worktree setup. Never rebuild content just to repair a preview. Run focused
checks, then `pnpm verify` for implementation; learner-visible changes also
need real browser evidence and the default E2E lane. A document-only cleanup
does not prove any new product behavior.

Recall relevant `docs/reference/learnings/**` with `pnpm pro-gov learn recall`.
Do not load all historical traps at startup. Current package versions, catalogue
counts and resource costs must come from runtime files or dated test receipts.

## History is opt-in

The earlier long catalogue is [archived](../../archive/execution/current-work-before-consolidation-2026-09-07.md).
It is evidence, not an instruction source; some old startup advice was superseded
by the baseline. Speech/TTS privacy and consent remain governed by V5, not by
the historical summary. A commit touching this pinned index uses
`Pinned-Override: REF-CURRENT-WORK`.

The delivery plan links its dated evidence archive when a specific result needs
tracing. Do not preload old handoffs, agent reports or all archives to resume work.
