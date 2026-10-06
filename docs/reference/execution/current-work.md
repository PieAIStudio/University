---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-10-06
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
| Next mainline work | [20 · one UIKit, one checkout](../../plans/active/20-one-uikit-and-fewer-checkouts.md) is next: `packages/world` still resolves UIKit 2.14.0 beside the App's 3.0.0-rc.1, and task 17's `.worktrees/r2-baseline` is left over. Tasks 13, 18, 14 and 19 are delivered. Task 17 R0–R11 is complete through `0c1601a`; its health measurements and self-description alignment are recorded in the completed plan. Task 16 follows completed task 19 and is complete on published UIKit 3.0.0-rc.1, NerveKit 0.8.0 and AuthKit 0.8.0-rc.1. [The work queue](work-queue.md) owns the protocol and stop conditions. [12 · unpublished r7](../../plans/active/12-pipeline-writes-step-lessons.md) stays active **awaiting Owner reading**, protected and skipped; 06, 09 and [15](../../plans/active/15-account-center-and-closeout-adoption.md) stay Owner-held. |
| English reading aids missing on PRIMM lessons | [PRIMM reading tools gap](primm-reading-tools-gap.md): the PRIMM reader ships without foreign-language mode or the reading-detail toggle, so an English learner meets five lessons in a row without them. Recorded rather than fixed on 2026-09-21 by Owner ruling, and the browser gate no longer raises it — this document is the only alarm left |
| Four-course archipelago draws three names | [Archipelago framing gap](archipelago-framing-gap.md): the world camera does not avoid the opaque right rail the way the course overview does, so one of `browser-ai`'s four course names is not drawn and an island dragged to the right edge has no room for its entry button. Recorded rather than fixed on 2026-09-21; the browser gates no longer require the fourth name, so this document is the only alarm left |
| How work is queued, run and gated on the mainline | [Work queue](work-queue.md); one task, one commit, one push, because `pnpm verify` does not run the browser suite |
| Active versus retired course packages | The configured course repository keeps `course-proposals/retired/` and `course-proposals/locked/`; the current release catalogue contains only the accepted first three step lessons. Historical package failures remain in the external repository's records |
| Retiring old courses | The Owner decided on 2026-10-02 (T1) that every old course retires and only the new step lessons ship. It failed on 2026-09-22 because the browser suite takes its fixtures from the shipped catalogue; the measured reasons are retained in the configured course repository. Task `11-` has removed that dependency; the [task 13 record](../../plans/completed/13-retire-old-courses.md) owns retirement and its push receipt. The [AI foundations revival](../../plans/completed/ai-foundations-revival.md) is superseded by it |
| Direction decided by the Owner on 2026-10-02 | University is the one focus project. The first market is overseas; the Owner sells as an individual through Paddle (merchant of record) with payouts to Payoneer ([task 09](../../plans/active/09-v7-before-charging.md) carries the details). A small beta — 20 to 30 new lessons, 50 to 200 people — comes before mass production. New features are frozen until that beta ends; the exception is a feature that turns out not to really work, which gets fixed, together with whatever the fix needs. Old courses retire (T1); course content moves to its own repository (S1). Progress across product, content, growth and business is tracked on HQ's founder board (HQ `SPEC-0002`, `.hq/board/university.yaml`), not here |
| Map guide 涟 (SwimmerNerveKit) | [ADR-0012](../../adr/ADR-0012-the-map-guide-comes-from-nerve-model-free-first.md): phase one is live on the world and course maps — fixed questions answered from the map, no model and no cost. Since 2026-09-28 on Nerve 0.7.0 / UIKit 2.11.0 / I18nKit 0.2.0, with University supplying the language engine for Nerve's own catalogs (ADR-0012 amendment of that date); the kit's `NerveLiquidInteraction` is the entry, places are registered by identity through `registerElementTarget`, the panel's `onBoundsChange` feeds label avoidance, the archipelago compares two chosen islands read-only (`createObjectSelection`), and Settings carries `NerveDetailsPanel`. The [journey section](../player-journey/v5/index.html#map-guide) owns behaviour. Phase two (conversation, `createNerveConversation`) waits on an Owner cost decision, metering through SwimmerAIProviderKit and a real AG-UI host; voice waits on an authorised connection |
| 3D learning games (the map's challenge node) | [ADR-0011](../../adr/ADR-0011-3d-learning-games-are-assembled-from-one-kit.md): every 3D game is five layers — content projected from lessons (`packages/core/src/game-content`), rules, scene blocks (`packages/world/src/game-kit`), one frame (`packages/ui/src/game-frame`), assembly (`apps/university/src/game`). 庭院拦截 is the first; the learner's avatar (SwimmerAvatarKit 0.7 actions) is the hero. The [journey section](../player-journey/v5/index.html#courtyard-intercept) owns behaviour. The six island games are the only 3D games; the garden, factory, workshop and flight editions, the flat arcades, the research prototypes and the history pages were deleted from the play lab on 2026-10-01 (Owner G3), their screenshots kept in the [interaction-components album](../interaction-components/album.html) |
| Production deploy | On hold by Owner ruling (2026-09-23) until lessons 1–3 are rebuilt as samples, their authoring workflow exists and every interaction component has been judged once. `main` moves ahead of production on purpose. Lessons 1–3 landed on 2026-10-01 as replacements in the old first three lessons' identities of `understanding-ai/first-useful-step` (hand-written version-3 steps, `assemble-steps --replace`). The Owner played two-thirds of lesson 1 and accepted this version as the sample for now (2026-10-01), to iterate later; the authoring-workflow update (D2) is the next condition |
| 3D world: rules and the one open look item | The rules are [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md), [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md), [ADR-0011](../../adr/ADR-0011-3d-learning-games-are-assembled-from-one-kit.md) and the island-look-review skill. The round-by-round delivery to R59 is [history](../../plans/completed/continuous-world-delivery.md); its unticked boxes are superseded close-out evidence, not work. Open: R58-04, landscape density toward the reference images. Physical-device acceptance belongs with the real-environment gaps below |
| Learner-visible design | [Player journey V7](../player-journey/v7/index.html), approved for building on 2026-09-27, and its [amendment one](../player-journey/v7/lesson-steps-amendment.html) (2026-10-01: inside a lesson — steps, eight actions, the 3D courtyard stage, materials, after the lesson — recorded from the Owner's 2026-09-28/30 interaction-component rulings); it amends [V5](../player-journey/v5/index.html) (including decision M), which still holds wherever V7 is silent; only consult V4 for behavior neither amends |
| Building V7 (chests and monsters, opening, splash, 涟 continue, badges and cards, menu tidy, before-charging pages) | The numbered V7 tasks run by [the work queue](work-queue.md). Charging stays off, production is on hold, and `09-` still needs Owner legal facts. Implemented: `01-`, `02-`, [03: splash and first meeting](../../plans/completed/03-v7-splash-and-first-meeting.md), [04: wrap-up, continue and avatar panel](../../plans/completed/04-v7-wrap-up-continue-and-avatar-panel.md), and [07: weekly bosses, species rotation, retained crowns and growth statistics](../../plans/completed/07-v7-weekly-boss.md). Each task's complete pre-push receipt remains its delivery boundary. [05: album, badges and ranks](../../plans/completed/05-v7-badges-ranks-and-knowledge-cards.md) has final local/browser acceptance and uses the published card component. The [authored-link request](knowledge-card-authoring-request.md) owns the missing course links and starter-title mismatch; do not invent earned cards. [06: wardrobe and pack transport](../../plans/active/06-v7-review-wisps-card-packs-and-cosmetics.md) owns the locally verified, deliberately closed service candidate and the unresolved Backend migration/registration acceptance. Its real wisp-return test now includes completing review. [08: four doors and native practice](../../plans/completed/08-v7-menu-doors-naming-and-author-speech.md) has complete local/browser acceptance; its receipt and normal push own delivery. [10: the learner's house](../../plans/completed/10-learner-house.md) is implemented: keepsakes from blue and gold chests on shelves, the wardrobe merged in as coat rack and pack box, the 「用了」 wall calendar, and 「用了吗？」 on the return card. [09: membership, help and policy destinations](../../plans/active/09-v7-before-charging.md) owns the implemented page candidate, management-readiness guards and remaining Owner legal facts; unpublished policy status is not formal policy approval. Real reminder delivery, trial/included grading and payment rollout remain separately gated. Tasks 03/04 own their native-device and synthetic-account evidence boundaries |
| Completed map navigation and the current owner walkthrough | [Map navigation evolution](../../plans/completed/map-navigation-evolution.md): selection, on-demand shortcuts, avatar/vertical-title folded rails and object-bound shared labels are implemented. Do not restore persistent directory/overview buttons or reopen the approved design; continue from new owner feedback |
| Technique, measurement scope and rejected alternatives | [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) |
| Shared blueprint/field, projections and source entry points | [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) |
| Local preview, iPhone/Android, Web-to-local tools | [Local device testing](local-device-testing.md) |
| Course authoring and each lesson's teaching shape | [Parity contract](../../specs/active/SPEC-0001-universitylocal-parity-contract.md), then the single [write-lesson contract](../../../apps/authoring-server/.agents/skills/write-lesson/SKILL.md); use `apps/authoring-server` workflows and keep publication separate |
| Which interactive activity a lesson gets, and where it sits | [The one component table](../../../apps/authoring-server/.agents/skills/write-lesson/references/components.md), decided with the variant at step 3 of [write-lesson](../../../apps/authoring-server/.agents/skills/write-lesson/SKILL.md); every new lesson carries at least one — `LessonCreationProposalSchema` requires it and refuses an activity the prose never points at. Lessons written before 2026-09-09 are counted, not failed, by `lint-lessons` |
| Activity payloads, engines and difficulty tiers | [Component contract](../../../packages/ui/src/learning-play/README.md), [interaction design](../../../packages/ui/src/learning-play/DESIGN.md) and [prior acceptance evidence](../../plans/completed/play-usability.md); an embedded activity never substitutes for a lesson's graded exercise, and `pnpm check:activities` names the lessons an engine change breaks, and checks that each activity's citation still points where it says |
| Where a learner starts, what is dimmed, and testing out of a unit | [V5 decision 12](../player-journey/v5/index.html); unlocking asks `CourseProgress.proven` (exercises passed), never `complete`, and self-report proposes what to test out of rather than unlocking anything |
| Whether difficulty adapts by itself | [ADR-0010](../../adr/ADR-0010-difficulty-moves-when-the-learner-moves-it.md): it does not. The learner moves it; the system never infers a level. Read it before adding anything that watches performance and re-routes |
| What a learner's assessed-but-unread lesson looks like on the map | The [map-node journey amendment](../player-journey/v5/index.html#map-learning-nodes) adds a distinct proof outline, not the ordinary read-complete state. Proof is tied to the assessed revision; older unversioned records are preserved. [Map learning nodes](../../plans/completed/map-learning-nodes.md) owns verification; the lane is absorbed into main (see below), which is not the same as released to production |
| Account progress migration and real cross-device/RLS acceptance | [Backend runbook and its adjacent SQL](swimmer-backend-migration.md); existence is not proof of execution, and remote operations still require owner authority |
| Designed but unfinished learner/business capabilities | [V5 review](v5-journey-review.md), [payment](payment-backend-gap.md), [feedback](feedback-backend-gap.md), [reminders](review-reminders-backend-gap.md), [commercial model](commercial-model.md) |

## Absorbed lanes (merged, not in flight)

下面这些已经收回主线或已经上线，各自的计划已移到 `docs/plans/completed/`（2026-10-02 收拢）。读它们是为了知道当时为什么那样做，
**不是为了接着做**。它们不是待办；仍需真实环境验收的事项，归「Designed but unfinished」一栏的专题文档。

| Lane | Authoritative entry |
| --- | --- |
| Real-source beginner courses and shared accounts | Live since September; [history](../../plans/completed/00-ai-literacy-commercial-release.md). Real-inbox, cross-device account, manual account-deletion review and business acceptance live with the real-environment gaps under "Designed but unfinished"; actual payments remain disabled |
| Product completeness pass | Merged on 2026-09-13; [history](../../plans/completed/product-completeness.md). Its remaining real-environment acceptance moved to the gaps under "Designed but unfinished" |
| PRIMM lesson engine and step lessons | [Interaction-first experiment](../../plans/completed/interaction-first-experiment.md), absorbed into the mainline on 2026-09-20 as the last of the experiment lanes. Course content follows this lane and nothing else. PRIMM version 3 — one action per screen inside the five phases 猜/跑/看/改/做 — is built, `ask-about-a-picture` is landed in it with ten steps as 1/2/2/3/2, and the other seven PRIMM lessons stay version 2 until the production line writes their steps. Do not publish without a separate instruction. |
| Playable 3D learning arcade and selective prop finishing | [3D play-lab experiment](../../plans/completed/interaction-3d-playlab.md), absorbed into the mainline on 2026-09-20. Its nine 3D scenes were deleted on 2026-10-01 (Owner G3) in favour of the six island games; `/play-lab/prop-finish` compares ten actual map props under original, soft-sculpted, physical-bevel and material-aware finishes. The wax-island study was rejected and retired, with its commit and evidence kept. The plan owns scope and acceptance; the retained finishes are still lab findings, not an approved map change |
| Personal tasks, practice games and coverage checkpoints on the course map | [Map learning nodes](../../plans/completed/map-learning-nodes.md), absorbed into the mainline on 2026-09-20. Generated lessons stay private to the learner, game practice is kept distinct from assessed skipping, and native lesson/review identities are reused. Since 2026-09-23 each node also stands on the island as its own object (gate, pennant, notice board with stepping stones), placed by `courseLearningSites` on free ground; the DOM chip above it stays the pick target — see ADR-0008 R57. The plan owns preview boundaries and evidence; do not change the first-five authoring lane |

## Work boundaries

Work is queued, not branched. Do not create a branch or worktree for ordinary
sequential work; the queue in `docs/plans/active/` carries it, and a branch is
correct only when two pieces of work must run at the same time and touch the same
files. Recheck Git and process ownership before writing; a historical receipt is
not permission to reset, delete or take over another task. Preserve original
material before retiring a lane, and preserving an experiment does not accept its
behavior.

One responsive app, three shells and two modes: `apps/university` uses
`--mode delivery` or `--mode authoring` across browser, desktop and phone;
`apps/authoring-server` is the authoring Node server. Shared domain logic is in
`packages/core`, learner DOM in `packages/ui`, rendering in `packages/world`.
The complete boundary contract remains in root `AGENTS.md`.
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
