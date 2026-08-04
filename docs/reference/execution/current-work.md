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

## UA Content Gate Receipt (2026-08-04)

Two full UA analyses of the same TuringPact snapshot were accepted as `ready`
and neither was usable. `assertUaGraphComplete` passed both, because it checks
structure — unique ids, no dangling edges, one layer per file-level node, valid
Tour — and neither defect was structural.

- 85% of one analysis's function summaries were template-generated. 964 function
  and class nodes collapsed onto 40 prose skeletons.
- The other silently skipped 56 of 766 files, including `world-runtime`
  scenes, layout, venues, movement, input and performance. Quality metrics
  cannot see this: a skipped file emits no nodes to score.

Built and covered by tests:

- `server/ua/quality.ts` is a pure function with no I/O, consumed both by
  `finalizeUaAnalysis` as a hard gate and by the new `refresh verify` verb.
  One implementation, no second source of truth.
- Coverage compares `fingerprints.json` keys against graph top-level nodes as
  exact set equality. Both files were already read by finalize, so the gate adds
  no I/O. Top-level nodes are identified by `id === "<type>:<filePath>"`, since
  UA emits `pipeline` for `.yml` and `document` for `.md`.
- Template collapse strips code-like tokens and counts distinct prose skeletons.
  Stripping *all* ASCII was rejected: it leaves an empty skeleton for every
  English summary and would permanently reject any `--language en` analysis.
- Analyses gained a `superseded` status, `refresh retire`, and dependency
  refusal with `--force`. The variant mirrors `ready`'s shape so existing
  readers of `graphHash` keep narrowing.
- `evaluateEvidenceFreshness` threw on a non-ready bound analysis, so retiring an
  analysis a course depended on deadlocked the very `refresh audit --apply` path
  meant to mark that content stale. Integrity and authority are now separate:
  `validateEvidence` accepts `superseded`, freshness reports it as a stale reason.

Verified on real data, not fixtures: `refresh verify` exits 1 on the templated
analysis (duplicateRatio 0.968) and 0 on the re-analyzed one (766/766 coverage,
965 distinct skeletons). The templated analysis was retired, then deleted.

A second pass closed two gaps the first one left:

- `refresh verify` needed a merged `knowledge-graph.json`, which does not exist
  until Phase 3, so a long Phase 2 ran unwatched. It now picks its stage from
  disk — graph when the graph exists, otherwise `intermediate/batches.json` —
  and reports per-batch coverage plus cross-batch template collapse. Batches
  with no output yet are `pending`, not failures. Replaying the historical run
  with the repair outputs removed reproduces the incident exactly: 710/766,
  four incomplete batches missing 15, 24, 9 and 8 files.
- Analysis identity is deterministic, and `prepare` threw on any status other
  than ready or preparing, so retiring an analysis made its identity slot
  permanently unusable. Since analysis quality depends on how the host drives
  its subagents — which is not in the identity hash — re-running an identical
  configuration is a legitimate need. `prepare` now allocates `-retryN`,
  resuming an interrupted retry rather than orphaning it.

`pnpm verify` passes at 24 test files / 239 tests.

## SupaLuv Re-analysis Receipt (2026-08-04)

The gate found the same disease in SupaLuv's `ready` analysis
`ua-feeb848f-v294-zh-full`, recorded earlier as covering "all 606 eligible
files": 605 graph nodes against 606 fingerprints, and 936 function and class
summaries collapsing onto 329 skeletons at a 0.80 duplicate ratio, 34 of them
sharing `创建或组装该模块需要的结构化结果与依赖`. The same project's
`legacy-import` analysis was healthy at 0.02, which is what made the defect
legible rather than looking like a property of the codebase.

SupaLuv was re-analyzed at its current HEAD `c9f0ec8d` as
`ua-c9f0ec8d-v2-9-4-zh-full-e98206c7358f1ff1-d0c838f811a5`: 622/622 files,
1579 nodes, 3745 edges, 8 layers, a 12-step Tour, no dangling edges, and every
one of the 622 container nodes assigned to exactly one layer. Template collapse
went from 0.80 to 0.014 — 957 summaries over 948 distinct skeletons. The only
duplicates are genuinely symmetric code: seven one-line getters, and matching
pairs like `stopMusic`/`stopAmbient`. That is the heuristic's known and accepted
false-positive class, and it is why the threshold is 0.30 rather than 0.

The run was watched with the new batch stage rather than throwaway scripts, and
the stage switched from `batches` to `graph` on its own once Phase 3 merged.

The old analysis was retired with `refresh retire`, superseded by the new one.
`refresh audit --apply` moved `founder-engineer` and its `narrative-authority`
unit to `stale`. Every stale reason was `UA node changed` — none were source
level, because the four files its 19 evidence references point to are
byte-identical between `feeb848f` and `c9f0ec8d`. Rebinding is therefore a
revision, not a rewrite: paths and line ranges survive, only the analysis
identity moves.

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
