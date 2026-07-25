---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-25
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

- Current phase: operate the completed Grok daily-learning bridge and collect
  real owner evidence before adding more exercise formats.
- Current active plan: none.
- Current active spec: none.
- Current proof target: complete three normal owner learning sessions and record
  friction before deciding whether Predict Output, Micro-Parsons, or Explain with
  Rubric deserves the next bounded spec.

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
- The completed SPEC-0001/PLAN-0001 foundation and SPEC-0002/PLAN-0002 daily
  bridge remain the current receipts. Cloud sync is outside this repository's
  permanent product boundary.

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

## Daily Bridge Completion Receipt (2026-07-21)

- PLAN-0002 and SPEC-0002 are completed. Grok Build 0.2.106 discovers the project
  router, all three UniversityLocal learning skills, and Understand Anything
  2.9.4 without a duplicate `.grok/` tree.
- Natural-language “记一下” produced a validated atomic note/card proposal and a
  safe dry-run receipt. The isolated Web session then proved actual note review,
  pre-reveal answer persistence, FSRS rating, formal lesson completion, session
  event grouping, and persistence across local-service restart.
- Browser QA passed at desktop and 390 px after fixing two responsive overflow
  seams. The complete implementation gate passes 22 test files / 173 tests plus
  typecheck, zero-warning lint, format, build, and documentation governance.
- The real learner database remains reset and empty; recoverable local backups
  remain under the ignored `studies/supaluv/learner/backups/` shelf. SupaLuv's
  HEAD, tree, and full dirty-state receipt remain unchanged.
- UniversityLocal's initial baseline is
  `2d07593bf943801dd5ce2dfb39a52981c5a0fea4`; PGS registration is committed as
  `39ea12c370f7790da84cf157eac82b9fab2e0532` and the portfolio scanner reports
  UniversityLocal healthy with no backend capability.

## Hardening Receipt (2026-07-25)

First end-to-end owner-style pass over the built product, plus a defect audit of
the API, learner store, and Web client. Fixed and covered by tests:

- `pnpm verify` was failing at random. Two filesystem-bound suites land at 5-6s
  against Vitest's 5s default; `testTimeout` is now 20s.
- The HTTP server cached learner stores by path, so `learner restore` and
  `learner reset` left it reading and writing a replaced SQLite inode. Stores are
  now keyed on `dev:ino` and reopen when the file identity changes.
- Any one correct exercise completed the whole lesson and enrolled every card.
  Completion is now the AND over the lesson's auto-gradable exercises, read back
  from the attempt log.
- Attempt, lesson progress, and card enrolment were three independent writes.
  `#transaction` is re-entrant (SAVEPOINT under an outer `BEGIN IMMEDIATE`), so
  the outcome commits or rolls back whole.
- The exercise endpoint returned the reference answer on every response, which
  ends retrieval practice after one wrong guess. It is withheld until the answer
  is correct or two attempts are recorded at that revision.
- Study and lesson loads had no request guard, so a slow response could render
  one lesson's content under another lesson's locator.
- Today gave the due-count metric the wide column and squeezed the review card
  into a 319 px rail.
- `lefthook.yml` and `.github/workflows/docs-check.yml` were missing;
  `doc-gov doctor` now passes with 0 warnings.

## Accepted Risks

- **The API request token does not defend against other local processes.**
  `GET /api/bootstrap` hands the token out unauthenticated, so anything running
  as the same user can obtain it. That is deliberate and not a gap: the same
  process could read `studies/` directly, so a token cannot be the boundary
  there. What it does defend against is a web page in the browser — combined
  with the loopback `Host` allowlist, the loopback `Origin` check, the
  `application/json` requirement and a timing-safe comparison, it blocks
  cross-site requests and DNS-rebinding, which is the threat a local server
  actually faces. Adding OS-level authentication would only be warranted if
  UniversityLocal ever stopped being single-user and local-only, which the
  product boundary says it will not.

## Open Questions

- **Card schedule across content revisions.** `ensureCard` carries FSRS state
  forward when a card's `contentRevision` advances, and
  `rebuildCardStateFromReviewEvents` encodes the same rule, so the projection
  survives a rebuild. The cost is that a card due far out will not show
  rewritten text until that due date arrives. Changing the policy is not a
  projection edit — a reset would be undone by the next rebuild — it needs the
  reset recorded as an event in the append-only log. Decide whether that is
  worth a schema migration before the course content starts being revised
  regularly.
- **Accepted answers.** Short-answer grading compares one `expectedAnswer` after
  normalising case, spacing, wrapping quotes, and trailing punctuation.
  Synonyms are deliberately out of the grader; if they are wanted, they belong
  in `ExerciseSchema` as an accepted-answer list plus generator support.

## Completed Proof History

Completed plans and specs live in:

- `docs/plans/completed/`
- `docs/specs/completed/`

Do not move completed work back into active. Create a new plan and link the completed record as provenance.
