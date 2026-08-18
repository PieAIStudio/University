---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-18
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related: []
---

# Current Work

This is the short, current handoff for an AI or human opening the repository.
It is not a task diary.

## Current Focus

Design the product before building it.

The repository was created on 2026-08-18 and registered in the PieAI portfolio
as a `web3d-default` target. It currently contains governance scaffolding, the
parity contract, a user-journey design, and a DOM placeholder page. There is no
product implementation and no 3D scene yet.

The immediate work is revising the user journey, not writing features.

## Order Of Work

1. **User journey V2.** V1 lives at `docs/reference/player-journey/v1/`. It is a
   first opinionated draft written from outside this repository and is expected
   to be argued with. V2 is authored here.
2. **Vertical slice.** One course, end to end: import a UniversityLocal recovery
   package → world map → one level → deterministic grading → one review the next
   day. Prove the pipeline before widening it.
3. **The rest**, in the order the journey's gap ledger says — not in the order
   that is most fun to build.

## Standing Constraints

- Courses are imported from UniversityLocal, never authored here. See SPEC-0001.
- UniversityLocal is never modified to push to this product.
- 3D owns the map and the rituals. Reading, answering, reviewing, account and
  payment are 2D DOM through SwimmerUIKit.
- All model calls go through SwimmerAIKit, tiered cheapest-first.
- The first `<Canvas>` commit must satisfy Web3D capability baseline rules 1-5
  and withdraw the matching `scheduled-migration` exceptions from the portfolio
  manifest in the same change.

## Open Decisions

Tracked as decision cards in the user journey, not resolved here.
