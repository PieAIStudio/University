---
id: PLAN-0002
title: Grok Daily Learning And Knowledge Bridge
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-21
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
- [x] Pass documentation governance after implementation truth is complete.

## Block 2 · Protect Existing Data

- [x] Create a timestamped private SQLite backup of the current SupaLuv learner database.
- [x] Verify the backup with SQLite integrity check and file mode.
- [x] Archive/reset browser-generated QA learning state without touching source, UA, course, or notes.
- [x] Make browser/integration tests use a temporary `studiesRoot` only.
- [x] Implement learner backup, reset with exact confirmation, and restore with pre-restore backup.

## Block 3 · Atomic Knowledge Core

- [x] Add note/card/origin schemas and safe `notes/` paths.
- [x] Implement atomic, append-only note revisions and content hashes.
- [x] Enforce active evidence rules and draft fallback.
- [x] Implement idempotent capture proposal validation and dry-run receipt.
- [x] Add active note-card enrollment without resetting existing FSRS state.
- [x] Add note discovery and review-card lookup for the local service.
- [x] Replace the Obsidian-writing project `knowledge-node` link with a UniversityLocal capture skill.

## Block 4 · Real Learning Events

- [x] Migrate SQLite with append-only `retrieval_attempt`.
- [x] Persist the answer and timing before card reveal.
- [x] Keep retrieval attempts separate from FSRS rating events.
- [x] Enforce one open session per study and expose start/status/end workflows.
- [x] Associate Web exercise/review/progress events with the current open session.
- [x] Report session counts and outcomes without invented mastery metrics.
- [x] Refresh Today when a ts-fsrs short-term due card becomes available.

## Block 5 · Source Refresh

- [x] Add dirty/branch/HEAD status without modifying the source repository.
- [x] Generalize snapshot and UA prepare/finalize beyond SupaLuv-specific scripts.
- [x] Bind UA source, revision, and content hash into analysis identity/manifest.
- [x] Canonicalize UA node comparison.
- [x] Audit all course and note evidence against a target snapshot/analysis.
- [x] Persist deterministic freshness reports and hashes.
- [x] Mark only affected active course/unit containers stale; never auto-rewrite content.
- [x] Prove an unpushed local commit refresh, default dirty refusal, and explicit
  commit-only acknowledgement without source mutation.

## Block 6 · Host CLI And Skills

- [x] Add one host-neutral `pnpm university -- ...` CLI.
- [x] Implement `status`, `capture`, `session`, `learner`, and `refresh` command families.
- [x] Keep command business logic in workflow services rather than the CLI parser.
- [x] Add project-local `capture-study-knowledge` and `refresh-study` skills.
- [x] Update `teach-from-study` to start/end sessions and offer explicit capture.
- [x] Add Grok Build quick start, natural-language examples, `/privacy`, and failure recovery guidance.
- [x] Add a conditional `grok inspect` smoke gate without creating `.grok` copies.

## Block 7 · Evidence Experience

- [x] Expose a bounded immutable Git-blob snippet service.
- [x] Add path, file-size, line-count, binary, symlink, tree, and gitlink tests.
- [x] Adopt a pinned maintained Shiki bundle after license/version verification.
- [x] Show context and cited-line emphasis in the Web evidence rail.
- [x] Persist pre-reveal card answers from both course and note cards.
- [x] Show atomic captured notes separately from formal courses while sharing Today review.

## Block 8 · Verification And Baseline

- [x] Run focused schema, repository, migration, workflow, and API tests.
- [x] Run typecheck, zero-warning lint, format check, all tests, build, and docs checks.
- [x] Run desktop and 390 px browser QA against a temporary study shelf.
- [x] Run a real Grok Build discovery/capture smoke and inspect privacy guidance.
- [x] Prove SupaLuv Git HEAD/tree/status are unchanged by the full workflow.
- [x] Reconcile every SPEC-0002 acceptance item and plan checkbox.
- [x] Create UniversityLocal's first Git baseline only after the complete gate passes.
- [x] Perform the required capture-learning closeout decision.

## Acceptance

- [x] SPEC-0002 acceptance is fully evidenced.
- [x] UniversityLocal has no backend dependency, client, sync placeholder, or cloud write.
- [x] The owner can use Grok Build without knowing internal workspace, JSON, or SQLite paths.
- [x] All personal learner-state mutations are backed up and source-isolated.

## Closeout

Completed on 2026-07-21.

### Implementation And Verification Receipt

- Initial UniversityLocal baseline:
  `2d07593bf943801dd5ce2dfb39a52981c5a0fea4`.
- PGS registration commit:
  `39ea12c370f7790da84cf157eac82b9fab2e0532`.
- Final implementation gate: `pnpm verify` passed typecheck, zero-warning
  lint, format, 22 test files / 173 tests, production build, and all
  documentation checks. PGS `pnpm verify` also passed 43 doc-gov tests and 222
  pro-gov tests.
- Grok Build 0.2.106 `inspect --json` found the project router, the local
  `knowledge-node`, `refresh-study`, and `teach-from-study` skills, and
  Understand Anything 2.9.4. A real Grok `knowledge-node` invocation produced a
  valid evidence-bound proposal and `capture --dry-run` receipt without storing
  a raw transcript or mutating notes/learner state.
- Isolated browser QA used a copy-on-write temporary study shelf. It captured an
  active conversation note, reviewed its card with a persisted pre-reveal
  answer and FSRS rating, completed the course exercise, enrolled four course
  cards, restarted the local service, and preserved all state. The closed
  session recorded one retrieval, one review, one exercise, and one lesson
  progress event with score 1/1.
- Desktop and 390 px browser passes had no console errors. The narrow pass found
  and fixed Grid min-content and long-inline-code overflow; final document width
  equalled viewport width while evidence code scrolled inside its own bounded
  panel.
- Learner backup:
  `studies/supaluv/learner/backups/backup-20260720T145356992Z-bab254d8-3388-430d-b346-15c7ff4b6cc3.sqlite`;
  pre-reset backup:
  `studies/supaluv/learner/backups/backup-20260720T145359827Z-68329795-67b9-40fa-bc63-a71e7e562bce.sqlite`;
  reset receipt:
  `studies/supaluv/learner/backups/reset-20260720T145359827Z-71de01d7-dc3f-4edc-83d3-38a1ae16108e.receipt.json`.
  Integrity passed, files were mode `0600`, and the real learner tables were
  empty after QA reset.
- SupaLuv remained untouched: HEAD
  `feeb848f1e3b91ca13f6e222290b70a4ee74e11a`, tree
  `b1f66e80f6525c092226c64736ac8a150ab219a8`, and full dirty-status hash
  `66285cd3aa7877d552aabfe302be47fbdfc9e4a3a7be31ab7aff074af6e63cfc`
  matched the pre-work receipt. UniversityLocal `source/`, `ua/`, and `courses/`
  hashes also remained unchanged during learner/browser QA.
- Default dirty refresh refusal was exercised and explicitly stated that a
  local commit is sufficient while GitHub push is unnecessary. No dirty
  acknowledgement was supplied on the owner's behalf.
- The PGS portfolio scanner reported UniversityLocal `healthy`, zero
  recommendations, aligned runtime/package versions, no backend capability, no
  asset drift, and compliant Grok/Claude/Codex skill discovery.
