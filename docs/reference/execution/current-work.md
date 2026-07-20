---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related: []
---

# Current Work

This file is the current project work index. It is not the agents-routing algorithm.

## Current Focus

- Current phase: Grok daily-use bridge and trustworthy knowledge compounding.
- Current active plan: PLAN-0002.
- Current active spec: SPEC-0002.
- Current proof target: complete one real Grok Build session that teaches from a
  committed SupaLuv snapshot, captures an evidence-backed atomic note, derives a
  review card, persists the learner's retrieval attempt, and survives restart.

## Accepted Direction (2026-07-20)

- Run UniversityLocal local-first from an AI host; public/mobile cloud access is a
  later capability, not a first-build dependency.
- Analyze only a commit-pinned snapshot. A dirty source stops refresh by default;
  after explicit owner acknowledgement, UniversityLocal may analyze the immutable
  commit while recording that all dirty files were excluded.
- UniversityLocal is permanently local-only and never connects to SwimmerBackend
  or another application backend. A future commercial `University` is a separate
  repository and may own a separate SwimmerBackend contract.
- Grok Build is the preferred daily teacher; Codex and Claude Code remain supported.
  The Web UI presents learning and
  review flows without a second runtime model integration in the first phase.
- Version application code, configuration, schemas, and skills in Git. Keep
  personal learning data out of Git and use the local SQLite backup path.
- Use a mixed daily flow: due review plus project-goal learning.
- Integrate pinned Understand Anything through a UniversityLocal-owned full-analysis
  adapter. Keep runtime worktrees temporary and make small upstream fixes only when
  reproducible evidence proves a UA defect.
- Keep UniversityLocal pinned to the verified portfolio SwimmerUIKit `1.2.0`
  baseline.
- Keep personal study containers under root-level `studies/<study-id>/` by
  default, with an explicit configuration escape hatch for another data root.
- Reserve `University` for a possible future consumer product in a separate
  repository; do not turn UniversityLocal into a mixed local/SaaS boundary.
- Treat donor research as an implementation gate. Current promoted patterns are
  atomic Markdown notes (Foam/SilverBullet), ts-fsrs scheduling, and immutable
  source snippets; feature-volume donors remain deferred or rejected explicitly.

## Foundation Verification Receipt (2026-07-20)

- UniversityLocal declares and installs `@pieai/swimmer-ui-kit@1.2.0`, imports its
  shared stylesheet once from `src/main.tsx`, and passes the complete
  `pnpm verify` gate.
- The PGS portfolio baseline is `1.2.0`. A fresh 19-repository AI health scan
  reports every actual UIKit consumer as declared, installed, and aligned at
  `1.2.0`; AnvilLocal remains correctly not applicable.
- Full repository verification passed for HQ, PGS, Anvil, Collapse,
  OwnMySpace, Sea, Show, YaZu, and UniversityLocal. TuringPact already used
  `1.2.0` and required no change.
- Break passed typecheck, 142 tests, and its production build, but its complete
  gate remains blocked by pre-existing formatting drift in 14 product files.
- SupaLuv passed typecheck, 650 tests, and its workspace build, but its complete
  gate remains blocked by two pre-existing React hook lint errors in
  `apps/web/src/creator/AssetBay.tsx`.

## Current Constraints

- UniversityLocal is personal teaching infrastructure, not a Pie consumer-product
  line.
- External project repositories stay clean; study artifacts belong to UniversityLocal
  by default.
- The architecture must align with HQ's TypeScript/Vite/React direction and the
  relevant Swimmer kits without introducing a backend or irrelevant game
  infrastructure.
- The completed SPEC-0001 and PLAN-0001 remain the foundation receipt. New product
  scope is governed by SPEC-0002 and PLAN-0002; cloud sync is outside this
  repository's permanent product boundary.

## Implementation Receipt (2026-07-20)

- Identity migration, PGS registration, root-level `studies/`, path safety,
  schemas, local SQLite/FSRS, shallow bare Git snapshots, UA data mapping, atomic
  course revisions, activation gates, evidence freshness, secure loopback API and
  Today/Studies Web flows are built.
- SupaLuv is registered with one historical UA import and both historical/current
  clean snapshots. Its ready 2.9.4 full analysis covers all 606 eligible files,
  contains 1,542 nodes, 2,656 edges, 9 architecture layers and a 10-step Chinese
  Tour.
- The active `founder-engineer` course contains one lesson, one short-answer
  exercise and four cards. Browser proof completed the lesson, recorded one wrong
  and one correct exercise attempt, scheduled one FSRS review and preserved the
  result across reload.
- Studies now reports source snapshot and ready-UA counts while stating that UA
  native maps/tours are course evidence, not formal courses.
- UA analysis IDs are configuration-bound, and SQLite can transactionally replay
  append-only review events to verify or rebuild card projections.
- Official Understand Anything 2.9.4 skills are installed and actively used through
  the isolated UniversityLocal workspace.
- The project-local `teach-from-study` skill defines the shared teaching workflow
  for Grok Build, Codex, and Claude Code.

## Completed Proof History

Completed plans and specs live in:

- `docs/plans/completed/`
- `docs/specs/completed/`

Do not move completed work back into active. Create a new plan and link the completed record as provenance.
