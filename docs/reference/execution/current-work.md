---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-20
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
  - PLAN-INTERACTION-3D-PLAYLAB
  - PLAN-MAP-LEARNING-NODES
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
| PRIMM lesson engine and step lessons | [Interaction-first experiment](../../plans/active/interaction-first-experiment.md), absorbed into the mainline on 2026-09-20 as the last of the experiment lanes. Course content follows this lane and nothing else. PRIMM version 3 — one action per screen inside the five phases 猜/跑/看/改/做 — is built, `ask-about-a-picture` is landed in it with ten steps as 1/2/2/3/2, and the other seven PRIMM lessons stay version 2 until the production line writes their steps. Do not publish without a separate instruction. |
| Playable 3D learning arcade and selective prop finishing | [3D play-lab experiment](../../plans/active/interaction-3d-playlab.md), absorbed into the mainline on 2026-09-20. The catalog's `3D组件` group holds six game-specific scenes and the three retained garden editions; `/play-lab/prop-finish` compares ten actual map props under original, soft-sculpted, physical-bevel and material-aware finishes. The wax-island study was rejected and retired, with its commit and evidence kept. The plan owns scope and acceptance; the retained finishes are still lab findings, not an approved map change |
| Personal tasks, practice games and coverage checkpoints on the course map | [Map learning nodes](../../plans/active/map-learning-nodes.md), absorbed into the mainline on 2026-09-20. Generated lessons stay private to the learner, game practice is kept distinct from assessed skipping, and native lesson/review identities are reused. The markers are DOM glyphs projected from the authored road: the 3D art direction for these three node kinds is deliberately still open, and is scheduled after the remaining lane is absorbed. The plan owns preview boundaries and evidence; do not change the first-five authoring lane |
| English reading aids missing on PRIMM lessons | [PRIMM reading tools gap](primm-reading-tools-gap.md): the PRIMM reader ships without foreign-language mode or the reading-detail toggle, so an English learner meets five lessons in a row without them. Recorded rather than fixed on 2026-09-21 by Owner ruling, and the browser gate no longer raises it — this document is the only alarm left |
| Four-course archipelago draws three names | [Archipelago framing gap](archipelago-framing-gap.md): the world camera does not avoid the opaque right rail the way the course overview does, so one of `browser-ai`'s four course names is not drawn and an island dragged to the right edge has no room for its entry button. Recorded rather than fixed on 2026-09-21; the browser gates no longer require the fourth name, so this document is the only alarm left |
| How work is queued, run and gated on the mainline | [Work queue](work-queue.md); one task, one commit, one push, because `pnpm verify` does not run the browser suite |
| Published versus locked course packages | [Locked-package record](../../../apps/local/course-proposals/locked/README.md); runtime counts come from the generated catalogue, not historical handoffs |
| Reviving the locked AI foundations course | [AI foundations revival](../../plans/active/ai-foundations-revival.md); follow its phase boundary and unresolved recovery requirements before resuming |
| Mainline iteration, teaching contracts and remaining 3D acceptance gates | [Continuous world delivery](../../plans/active/continuous-world-delivery.md), reading its integrated-mainline continuation first; pre-merge sections are historical evidence, not open task assignments |
| Learner-visible design | [Player journey V5](../player-journey/v5/index.html), including decision M; only consult V4 for behavior V5 does not amend |
| Completed map navigation and the current owner walkthrough | [Map navigation evolution](../../plans/completed/map-navigation-evolution.md): selection, on-demand shortcuts, avatar/vertical-title folded rails and object-bound shared labels are implemented. Do not restore persistent directory/overview buttons or reopen the approved design; continue from new owner feedback |
| Technique, measurement scope and rejected alternatives | [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) |
| Shared blueprint/field, projections and source entry points | [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) |
| Local preview, iPhone/Android, Web-to-local tools | [Local device testing](local-device-testing.md) |
| Course authoring and each lesson's teaching shape | [Parity contract](../../specs/active/SPEC-0001-universitylocal-parity-contract.md), then the single [write-lesson contract](../../../apps/local/.agents/skills/write-lesson/SKILL.md); use `apps/local` workflows and keep publication separate |
| Which interactive activity a lesson gets, and where it sits | [Activity selection](../../../apps/local/.agents/skills/write-lesson/references/activities.md), decided with the variant at step 3 of [write-lesson](../../../apps/local/.agents/skills/write-lesson/SKILL.md); every new lesson carries at least one — `LessonCreationProposalSchema` requires it and refuses an activity the prose never points at. Lessons written before 2026-09-09 are counted, not failed, by `lint-lessons` |
| Activity payloads, engines and difficulty tiers | [Component contract](../../../packages/ui/src/learning-play/README.md), [interaction design](../../../packages/ui/src/learning-play/DESIGN.md) and [prior acceptance evidence](../../plans/completed/play-usability.md); an embedded activity never substitutes for a lesson's graded exercise, and `pnpm check:activities` names the lessons an engine change breaks, and checks that each activity's citation still points where it says |
| Where a learner starts, what is dimmed, and testing out of a unit | [V5 decision 12](../player-journey/v5/index.html); unlocking asks `CourseProgress.proven` (exercises passed), never `complete`, and self-report proposes what to test out of rather than unlocking anything |
| Whether difficulty adapts by itself | [ADR-0010](../../adr/ADR-0010-difficulty-moves-when-the-learner-moves-it.md): it does not. The learner moves it; the system never infers a level. Read it before adding anything that watches performance and re-routes |
| What a learner's assessed-but-unread lesson looks like on the map | The [map-node journey amendment](../player-journey/v5/index.html#map-learning-nodes) adds a distinct proof outline in this experimental branch, not the ordinary read-complete state. Proof is tied to the assessed revision; older unversioned records are preserved. [Map learning nodes](../../plans/active/map-learning-nodes.md) owns verification and later integration; this experiment does not declare the feature released on main |
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
