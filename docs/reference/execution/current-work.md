---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-08
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
---

# Current Work

This page routes active work; it does not duplicate project rules, task states,
test totals, CLI/model choices or execution history. Read only the matching row.

## Active lanes

| Task | Authoritative entry |
| --- | --- |
| 3D delivery, remaining defects and verification | [Continuous world delivery](../../plans/active/continuous-world-delivery.md), starting with its current continuation section; the local `SCRATCH/HANDOFF.md` only points here, not to dated handoff copies |
| Learner-visible design | [Player journey V5](../player-journey/v5/index.html), including decision M; only consult V4 for behavior V5 does not amend |
| Technique, measurement scope and rejected alternatives | [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) |
| Shared blueprint/field, projections and source entry points | [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) |
| Local preview, iPhone/Android, Web-to-local tools | [Local device testing](local-device-testing.md) |
| Course authoring | [Parity contract](../../specs/active/SPEC-0001-universitylocal-parity-contract.md); use `apps/local` workflows and keep publication separate |
| Designed but unfinished learner/business capabilities | [V5 review](v5-journey-review.md), [payment](payment-backend-gap.md), [feedback](feedback-backend-gap.md), [reminders](review-reminders-backend-gap.md), [commercial model](commercial-model.md) |

## Work boundaries

3D works in sibling `University-3d` on `codex/continuous-island`; course work is
separate. Recheck Git and process ownership before writing. Do not reset,
delete, merge or claim ownership of other worktrees from historical receipts.
Preserving an experiment does not accept its behavior.

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
