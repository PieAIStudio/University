---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-27
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
  - ADR-0011
  - ADR-0012
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
| English reading aids missing on PRIMM lessons | [PRIMM reading tools gap](primm-reading-tools-gap.md): the PRIMM reader ships without foreign-language mode or the reading-detail toggle, so an English learner meets five lessons in a row without them. Recorded rather than fixed on 2026-09-21 by Owner ruling, and the browser gate no longer raises it — this document is the only alarm left |
| Four-course archipelago draws three names | [Archipelago framing gap](archipelago-framing-gap.md): the world camera does not avoid the opaque right rail the way the course overview does, so one of `browser-ai`'s four course names is not drawn and an island dragged to the right edge has no room for its entry button. Recorded rather than fixed on 2026-09-21; the browser gates no longer require the fourth name, so this document is the only alarm left |
| How work is queued, run and gated on the mainline | [Work queue](work-queue.md); one task, one commit, one push, because `pnpm verify` does not run the browser suite |
| Published versus locked course packages | [Locked-package record](../../../apps/local/course-proposals/locked/README.md); runtime counts come from the generated catalogue, not historical handoffs |
| Retiring a course package is blocked on the browser suite | The Owner asked on 2026-09-22 for `browser-ai` and `ai-for-real-life` to be retired; it was attempted and rolled back. `e2e/harness/catalogue.ts` resolves its content roles out of the shipped catalogue and throws at import when one has no course, and three more specs assume the catalogue keeps providing a bilingual `connect`, a servable course on disk, and a study with more than one island. The four measured failures are the specification for the fixture study that unblocks it — see [the locked-package record](../../../apps/local/course-proposals/locked/README.md) |
| Reviving the locked AI foundations course | [AI foundations revival](../../plans/active/ai-foundations-revival.md); follow its phase boundary and unresolved recovery requirements before resuming |
| Map guide 涟 (SwimmerNerveKit) | [ADR-0012](../../adr/ADR-0012-the-map-guide-comes-from-nerve-model-free-first.md): phase one is live on the world and course maps — fixed questions answered from the map, no model and no cost. Since 2026-09-28 on Nerve 0.7.0 / UIKit 2.11.0 / I18nKit 0.2.0, with University supplying the language engine for Nerve's own catalogs (ADR-0012 amendment of that date); the kit's `NerveLiquidInteraction` is the entry, places are registered by identity through `registerElementTarget`, the panel's `onBoundsChange` feeds label avoidance, the archipelago compares two chosen islands read-only (`createObjectSelection`), and Settings carries `NerveDetailsPanel`. The [journey section](../player-journey/v5/index.html#map-guide) owns behaviour. Phase two (conversation, `createNerveConversation`) waits on an Owner cost decision, metering through SwimmerAIProviderKit and a real AG-UI host; voice waits on an authorised connection |
| 3D learning games (the map's challenge node) | [ADR-0011](../../adr/ADR-0011-3d-learning-games-are-assembled-from-one-kit.md): every 3D game is five layers — content projected from lessons (`packages/core/src/game-content`), rules, scene blocks (`packages/world/src/game-kit`), one frame (`packages/ui/src/game-frame`), assembly (`apps/university/src/game`). 庭院拦截 is the first; the learner's avatar (SwimmerAvatarKit 0.7 actions) is the hero. The [journey section](../player-journey/v5/index.html#courtyard-intercept) owns behaviour. The old invaders/cloud editions are still in the play lab until retired; the other old games are re-assembled only after the Owner judges them on the review desk |
| Production deploy | On hold by Owner ruling (2026-09-23) until lessons 1–3 are rebuilt as samples, their authoring workflow exists and every interaction component has been judged once. `main` moves ahead of production on purpose. Lessons 1–3 landed on 2026-10-01 as replacements in the old first three lessons' identities of `understanding-ai/first-useful-step` (hand-written version-3 steps, `assemble-steps --replace`) and await the Owner's reading; the authoring-workflow update (D2) follows it |
| Mainline iteration, teaching contracts and remaining 3D acceptance gates | [Continuous world delivery](../../plans/active/continuous-world-delivery.md), reading its integrated-mainline continuation first; pre-merge sections are historical evidence, not open task assignments |
| Learner-visible design | [Player journey V7](../player-journey/v7/index.html), approved for building on 2026-09-27, and its [amendment one](../player-journey/v7/lesson-steps-amendment.html) (2026-10-01: inside a lesson — steps, eight actions, the 3D courtyard stage, materials, after the lesson — recorded from the Owner's 2026-09-28/30 interaction-component rulings); it amends [V5](../player-journey/v5/index.html) (including decision M), which still holds wherever V7 is silent; only consult V4 for behavior neither amends |
| Building V7 (chests and monsters, opening, splash, 涟 continue, badges and cards, menu tidy, before-charging pages) | The numbered V7 tasks run by [the work queue](work-queue.md). Charging stays off, production is on hold, and `09-` still needs Owner legal facts. Implemented: `01-`, `02-`, [03: splash and first meeting](../../plans/completed/03-v7-splash-and-first-meeting.md), [04: wrap-up, continue and avatar panel](../../plans/completed/04-v7-wrap-up-continue-and-avatar-panel.md), and [07: weekly bosses, species rotation, retained crowns and growth statistics](../../plans/completed/07-v7-weekly-boss.md). Each task's complete pre-push receipt remains its delivery boundary. [05: album, badges and ranks](../../plans/completed/05-v7-badges-ranks-and-knowledge-cards.md) has final local/browser acceptance and uses the published card component. The [authored-link request](knowledge-card-authoring-request.md) owns the missing course links and starter-title mismatch; do not invent earned cards. [06: wardrobe and pack transport](../../plans/active/06-v7-review-wisps-card-packs-and-cosmetics.md) owns the locally verified, deliberately closed service candidate and the unresolved Backend migration/registration acceptance. Its real wisp-return test now includes completing review. [08: four doors and native practice](../../plans/completed/08-v7-menu-doors-naming-and-author-speech.md) has complete local/browser acceptance; its receipt and normal push own delivery. [09: membership, help and policy destinations](../../plans/active/09-v7-before-charging.md) owns the implemented page candidate, management-readiness guards and remaining Owner legal facts; unpublished policy status is not formal policy approval. Real reminder delivery, trial/included grading and payment rollout remain separately gated. Tasks 03/04 own their native-device and synthetic-account evidence boundaries |
| Completed map navigation and the current owner walkthrough | [Map navigation evolution](../../plans/completed/map-navigation-evolution.md): selection, on-demand shortcuts, avatar/vertical-title folded rails and object-bound shared labels are implemented. Do not restore persistent directory/overview buttons or reopen the approved design; continue from new owner feedback |
| Technique, measurement scope and rejected alternatives | [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) |
| Shared blueprint/field, projections and source entry points | [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) |
| Local preview, iPhone/Android, Web-to-local tools | [Local device testing](local-device-testing.md) |
| Course authoring and each lesson's teaching shape | [Parity contract](../../specs/active/SPEC-0001-universitylocal-parity-contract.md), then the single [write-lesson contract](../../../apps/local/.agents/skills/write-lesson/SKILL.md); use `apps/local` workflows and keep publication separate |
| Which interactive activity a lesson gets, and where it sits | [The one component table](../../../apps/local/.agents/skills/write-lesson/references/components.md), decided with the variant at step 3 of [write-lesson](../../../apps/local/.agents/skills/write-lesson/SKILL.md); every new lesson carries at least one — `LessonCreationProposalSchema` requires it and refuses an activity the prose never points at. Lessons written before 2026-09-09 are counted, not failed, by `lint-lessons` |
| Activity payloads, engines and difficulty tiers | [Component contract](../../../packages/ui/src/learning-play/README.md), [interaction design](../../../packages/ui/src/learning-play/DESIGN.md) and [prior acceptance evidence](../../plans/completed/play-usability.md); an embedded activity never substitutes for a lesson's graded exercise, and `pnpm check:activities` names the lessons an engine change breaks, and checks that each activity's citation still points where it says |
| Where a learner starts, what is dimmed, and testing out of a unit | [V5 decision 12](../player-journey/v5/index.html); unlocking asks `CourseProgress.proven` (exercises passed), never `complete`, and self-report proposes what to test out of rather than unlocking anything |
| Whether difficulty adapts by itself | [ADR-0010](../../adr/ADR-0010-difficulty-moves-when-the-learner-moves-it.md): it does not. The learner moves it; the system never infers a level. Read it before adding anything that watches performance and re-routes |
| What a learner's assessed-but-unread lesson looks like on the map | The [map-node journey amendment](../player-journey/v5/index.html#map-learning-nodes) adds a distinct proof outline, not the ordinary read-complete state. Proof is tied to the assessed revision; older unversioned records are preserved. [Map learning nodes](../../plans/active/map-learning-nodes.md) owns verification; the lane is absorbed into main (see below), which is not the same as released to production |
| Account progress migration and real cross-device/RLS acceptance | [Backend runbook and its adjacent SQL](swimmer-backend-migration.md); existence is not proof of execution, and remote operations still require owner authority |
| Designed but unfinished learner/business capabilities | [V5 review](v5-journey-review.md), [payment](payment-backend-gap.md), [feedback](feedback-backend-gap.md), [reminders](review-reminders-backend-gap.md), [commercial model](commercial-model.md) |
| Product changes and remaining product gates | [Product completeness](../../plans/active/product-completeness.md); its integration handoff describes the already-merged lane. Historical [before/after comparison](product-before-after/before-after.md) explains its changes; current product decisions remain in [V5](../player-journey/v5/index.html#product-lightness) |

## Absorbed lanes (merged, not in flight)

这三条实验分支已在 2026-09-20 收回主线，闸门全绿；分支和 worktree 已于 2026-09-25 删除，历史只在 git log 里。它们留在这里是因为各自的
计划仍然拥有范围、验收口径和尚未决定的事项——读它们是为了知道当时为什么那样做，
**不是为了接着做**。它们不是待办。

| Lane | Authoritative entry |
| --- | --- |
| PRIMM lesson engine and step lessons | [Interaction-first experiment](../../plans/active/interaction-first-experiment.md), absorbed into the mainline on 2026-09-20 as the last of the experiment lanes. Course content follows this lane and nothing else. PRIMM version 3 — one action per screen inside the five phases 猜/跑/看/改/做 — is built, `ask-about-a-picture` is landed in it with ten steps as 1/2/2/3/2, and the other seven PRIMM lessons stay version 2 until the production line writes their steps. Do not publish without a separate instruction. |
| Playable 3D learning arcade and selective prop finishing | [3D play-lab experiment](../../plans/active/interaction-3d-playlab.md), absorbed into the mainline on 2026-09-20. The catalog's `3D组件` group holds six game-specific scenes and the three retained garden editions; `/play-lab/prop-finish` compares ten actual map props under original, soft-sculpted, physical-bevel and material-aware finishes. The wax-island study was rejected and retired, with its commit and evidence kept. The plan owns scope and acceptance; the retained finishes are still lab findings, not an approved map change |
| Personal tasks, practice games and coverage checkpoints on the course map | [Map learning nodes](../../plans/active/map-learning-nodes.md), absorbed into the mainline on 2026-09-20. Generated lessons stay private to the learner, game practice is kept distinct from assessed skipping, and native lesson/review identities are reused. Since 2026-09-23 each node also stands on the island as its own object (gate, pennant, notice board with stepping stones), placed by `courseLearningSites` on free ground; the DOM chip above it stays the pick target — see ADR-0008 R57. The plan owns preview boundaries and evidence; do not change the first-five authoring lane |

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
