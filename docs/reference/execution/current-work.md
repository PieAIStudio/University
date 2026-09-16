---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-15
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related:
  - REF-WORK-QUEUE
  - PLAN-UIKIT-LIQUID-CTA-MIGRATION
  - PLAN-AI-READINESS-ALIGNMENT
  - PLAN-CONTINUOUS-WORLD-DELIVERY
  - ADR-0008
  - ADR-0009
  - REF-LOCAL-DEVICE-TESTING
  - REF-FEEDBACK-BACKEND-GAP
  - REF-V5-JOURNEY-REVIEW
  - ADR-0010
  - REF-PRODUCT-COMPLETENESS-REVIEW
  - PLAN-PRODUCT-COMPLETENESS
  - PLAN-AI-FOUNDATIONS-REVIVAL
  - PLAN-INTERACTION-FIRST-EXPERIMENT
---

# Current Work

This page routes active work; it does not duplicate project rules, task states,
test totals, CLI/model choices or execution history. Read only the matching row.

## Integrated mainline (reviewed 2026-09-13)

The course, product and visual branch commits are merged into `main`; the
integration baseline is `9f5bc900`. On 2026-09-13 the three lanes, their
worktrees and both stale remote branches were removed after each was verified to
hold nothing `main` lacked. At that checkpoint, `main` was the only branch and
checkout; the later Owner-authorized interaction experiments are separate work.
Ordinary mainline development proceeds as a sequential queue — see
[the work queue](work-queue.md). Recheck Git and listener ownership rather than
replaying an old merge or using a remembered port. The completed [PGS alignment](../../plans/completed/ai-readiness-alignment.md)
and [UIKit migration](../../plans/completed/uikit-liquid-cta-migration.md) retain
their separate acceptance records. The completed [mainline maintenance](../../plans/completed/mainline-maintainability.md)
includes ordinary authoring-start source selection as well as fresh-worktree
E2E acceptance; earlier failures and remaining uncertainties are retained there.
New mainline work follows the applicable lanes below.

## Active lanes

| Task | Authoritative entry |
| --- | --- |
| Published real-source beginner courses and remaining account-service prerequisites | [AI literacy commercial release](../../plans/active/00-ai-literacy-commercial-release.md); both bilingual paths are live and the final release gates passed. Continue only the named AuthKit/mail/account-deletion/cross-device prerequisites or a newly reproduced issue; do not restart course production. Actual payments remain disabled |
| Interaction-first sample lessons in the single Codex experiment worktree | [Interaction-first experiment](../../plans/active/interaction-first-experiment.md); use `.worktrees/interaction-first` / `codex/interaction-first`. The temporary gameplay lane was merged and removed; do not recreate it |
| How work is queued, run and gated on the mainline | [Work queue](work-queue.md); one task, one commit, one push, because `pnpm verify` does not run the browser suite |
| Published versus locked course packages | [Locked-package record](../../../apps/local/course-proposals/locked/README.md); runtime counts come from the generated catalogue, not historical handoffs |
| Reviving the locked AI foundations course | [AI foundations revival](../../plans/active/ai-foundations-revival.md); follow its phase boundary and unresolved recovery requirements before resuming |
| Mainline iteration, teaching contracts and remaining 3D acceptance gates | [Continuous world delivery](../../plans/active/continuous-world-delivery.md), reading its integrated-mainline continuation first; pre-merge sections are historical evidence, not open task assignments |
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
| Account progress migration and real cross-device/RLS acceptance | [Backend runbook and its adjacent SQL](swimmer-backend-migration.md); existence is not proof of execution, and remote operations still require owner authority |
| Designed but unfinished learner/business capabilities | [V5 review](v5-journey-review.md), [payment](payment-backend-gap.md), [feedback](feedback-backend-gap.md), [reminders](review-reminders-backend-gap.md), [commercial model](commercial-model.md) |
| Product changes and remaining product gates | [Product completeness](../../plans/active/product-completeness.md); its integration handoff describes the already-merged lane. Historical [before/after comparison](product-before-after/before-after.md) explains its changes; current product decisions remain in [V5](../player-journey/v5/index.html#product-lightness) |

## Work boundaries

Work is queued, not branched. Do not create a branch or worktree for ordinary
sequential work; the queue in `docs/plans/active/` carries it, and a branch is
correct only when two pieces of work must run at the same time and touch the same
files. Recheck Git and process ownership before writing; a historical receipt is
not permission to reset, delete or take over another task. Preserve original
material before retiring a lane, and preserving an experiment does not accept its
behavior.

One browser app, two modes: `apps/university` uses `--mode delivery` or
`--mode authoring`; `apps/local` is the authoring Node server. Shared domain
logic is in `packages/core`, learner DOM in `packages/ui`, rendering in
`packages/world`. The complete boundary contract remains in root `AGENTS.md`.
Coordinate course IDs, ordering and shared learner contracts across lanes.

## Verification and recall

Use [the project baseline](../../policy/best-practice-for-this-project.md) for
worktree setup and the single preparation command after input changes. Never
rebuild from an incomplete campus just to repair a preview. Run focused
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

The completed [course-lane handoff and overlap map](../../archive/execution/liquid-and-difficulty-handoff-2026-09-11.md)
retains the original difficulty-result gap, failed trials and merge rationale;
its package versions, lesson-debt counts and old worktree commands are historical.
The earlier [3D research](../../archive/execution/3d-references-2026-08-21.md) retains
provenance and rejected alternatives, not current camera/renderer instructions.

The delivery plan links its dated evidence archive when a specific result needs
tracing. Do not preload old handoffs, agent reports or all archives to resume work.
