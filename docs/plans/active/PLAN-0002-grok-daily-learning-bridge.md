---
id: PLAN-0002
title: Grok Daily Learning And Knowledge Bridge
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: execution
tags:
  - grok
  - knowledge-capture
  - refresh
  - learner-data
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0003
  - ADR-0004
  - SPEC-0002
  - PLAN-0001
---

# PLAN-0002: Grok Daily Learning And Knowledge Bridge

## Goal

Turn the verified SupaLuv slice into a safe daily workflow: Grok Build teaches,
the owner can explicitly preserve a useful answer as evidence-backed knowledge,
the same local system schedules review, and a new local source commit produces a
clear refresh/staleness workflow without touching the source project or a backend.

## Scope

This plan includes permanent local-only and donor-first truth repair, atomic notes,
retrieval attempts, sessions, learner backup/reset, source refresh auditing, UA
engine provenance, immutable evidence preview, host-compatible skills/CLI, and
real Grok/browser verification.

It intentionally excludes SwimmerBackend, any other backend, implicit AI memory,
analytics theatre, code execution, and the three P1 question types until three
real owner sessions validate the daily bridge.

## Block 1 · Architecture And Governance

- [x] Re-run architecture reflection against the user's permanent local-only boundary.
- [x] Verify that a local commit is sufficient and GitHub push is not required.
- [x] Verify Grok Build project/router/skill/UA compatibility on the installed host.
- [x] Re-audit PBMLS, PBMLS-old, current UniversityLocal, and mature donors.
- [x] Select notes rather than mutating a formal course for every conversation capture.
- [x] Record ADR-0003, ADR-0004, SPEC-0002, donor map, and active work truth.
- [ ] Pass documentation governance after implementation truth is complete.

## Block 2 · Protect Existing Data

- [ ] Create a timestamped private SQLite backup of the current SupaLuv learner database.
- [ ] Verify the backup with SQLite integrity check and file mode.
- [ ] Archive/reset browser-generated QA learning state without touching source, UA, course, or notes.
- [ ] Make browser/integration tests use a temporary `studiesRoot` only.
- [ ] Implement learner backup, reset with exact confirmation, and restore with pre-restore backup.

## Block 3 · Atomic Knowledge Core

- [ ] Add note/card/origin schemas and safe `notes/` paths.
- [ ] Implement atomic, append-only note revisions and content hashes.
- [ ] Enforce active evidence rules and draft fallback.
- [ ] Implement idempotent capture proposal validation and dry-run receipt.
- [ ] Add active note-card enrollment without resetting existing FSRS state.
- [ ] Add note discovery and review-card lookup for the local service.
- [ ] Replace the Obsidian-writing project `knowledge-node` link with a UniversityLocal capture skill.

## Block 4 · Real Learning Events

- [ ] Migrate SQLite with append-only `retrieval_attempt`.
- [ ] Persist the answer and timing before card reveal.
- [ ] Keep retrieval attempts separate from FSRS rating events.
- [ ] Enforce one open session per study and expose start/status/end workflows.
- [ ] Associate Web exercise/review/progress events with the current open session.
- [ ] Report session counts and outcomes without invented mastery metrics.
- [ ] Refresh Today when a ts-fsrs short-term due card becomes available.

## Block 5 · Source Refresh

- [ ] Add dirty/branch/HEAD status without modifying the source repository.
- [ ] Generalize snapshot and UA prepare/finalize beyond SupaLuv-specific scripts.
- [ ] Bind UA source, revision, and content hash into analysis identity/manifest.
- [ ] Canonicalize UA node comparison.
- [ ] Audit all course and note evidence against a target snapshot/analysis.
- [ ] Persist deterministic freshness reports and hashes.
- [ ] Mark only affected active course/unit containers stale; never auto-rewrite content.
- [ ] Prove an unpushed local commit refresh, default dirty refusal, and explicit
  commit-only acknowledgement without source mutation.

## Block 6 · Host CLI And Skills

- [ ] Add one host-neutral `pnpm university -- ...` CLI.
- [ ] Implement `status`, `capture`, `session`, `learner`, and `refresh` command families.
- [ ] Keep command business logic in workflow services rather than the CLI parser.
- [ ] Add project-local `capture-study-knowledge` and `refresh-study` skills.
- [ ] Update `teach-from-study` to start/end sessions and offer explicit capture.
- [ ] Add Grok Build quick start, natural-language examples, `/privacy`, and failure recovery guidance.
- [ ] Add a conditional `grok inspect` smoke gate without creating `.grok` copies.

## Block 7 · Evidence Experience

- [ ] Expose a bounded immutable Git-blob snippet service.
- [ ] Add path, file-size, line-count, binary, symlink, tree, and gitlink tests.
- [ ] Adopt a pinned maintained Shiki bundle after license/version verification.
- [ ] Show context and cited-line emphasis in the Web evidence rail.
- [ ] Persist pre-reveal card answers from both course and note cards.
- [ ] Show atomic captured notes separately from formal courses while sharing Today review.

## Block 8 · Verification And Baseline

- [ ] Run focused schema, repository, migration, workflow, and API tests.
- [ ] Run typecheck, zero-warning lint, format check, all tests, build, and docs checks.
- [ ] Run desktop and 390 px browser QA against a temporary study shelf.
- [ ] Run a real Grok Build discovery/capture smoke and inspect privacy guidance.
- [ ] Prove SupaLuv Git HEAD/tree/status are unchanged by the full workflow.
- [ ] Reconcile every SPEC-0002 acceptance item and plan checkbox.
- [ ] Create UniversityLocal's first Git baseline only after the complete gate passes.
- [ ] Perform the required capture-learning closeout decision.

## Acceptance

- [ ] SPEC-0002 acceptance is fully evidenced.
- [ ] UniversityLocal has no backend dependency, client, sync placeholder, or cloud write.
- [ ] The owner can use Grok Build without knowing internal workspace, JSON, or SQLite paths.
- [ ] All personal learner-state mutations are backed up and source-isolated.

## Closeout

When complete, move this plan to `docs/plans/completed/`, set `status: completed`,
and add a receipt with exact commands, test counts, data backup paths, host/browser
evidence, source-repository before/after proof, and the initial Git commit ID.
