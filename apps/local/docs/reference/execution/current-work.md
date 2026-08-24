---
id: REF-CURRENT-WORK
title: Current Work
type: reference
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-08-17
domain: execution
tags:
  - current-work
  - navigation
pinned: true
related:
  - ARCH-CURRENT-WORK-RECEIPTS-2026-08
---

# Current Work

This is the short, current handoff for an AI or human opening the repository.
It is not a task diary, architecture document, or routing algorithm. Completed
proof receipts are preserved in
`docs/archive/current-work-receipts-2026-07-20-to-2026-08-08.md`.

## Current Focus

Operate and observe the hardened local teaching loop. The host can now continue
the correct lesson without guessing, current course content has a Git-safe
recovery form, and a moved source checkout can be rebound without losing study
or learner state.

No active plan or spec is registered. If this focus expands beyond the bounded
items below, create a plan rather than growing this page into another diary.

## Completed Hardening (2026-08-17)

- One read-only `teach next` view resolves focus, next lesson, due card,
  evidence, artifacts, and any open teaching session from the same learning
  overview used by the Web Today view. It scans every active study first;
  focused open sessions win, then newest session start time and stable IDs
  make multiple open sessions deterministic.
- Canonical course recovery packages export current active course state while
  excluding learner/UA/snapshot history. Content-addressed objects survive a
  failure before the index commit point, and the round-trip proof uses an empty
  studies root. The index preserves source `defaultRef`; imports preflight all
  known conflicts, are safe to rerun, and are not a cross-filesystem atomic
  transaction. Current exports live under `course-proposals/recovery/`.
- Every source snapshot rejects secret-like tracked paths before UA sees
  them. Legitimate large Web3D assets are not secrets and must not be rejected
  solely for size.
- `study source rebind` updates only the local source registration after
  the candidate repository proves every stored exact commit and tree.
- Refresh remains the orchestration workflow; `write-lesson` owns lesson prose,
  cards, exercises, variants, and evidence rebinding.

The verification gates below passed on 2026-08-17. Four current source
registrations also passed recovery import dry-run. The archived `ul-meta`
study is intentionally excluded from current recovery: its deleted source
checkout must not be recreated, and active
`university-local/four-layer-workbench` is the canonical successor. The old
study contained no learner records or notes, so its broken local registration
and empty shell were retired as well. Do not refresh TuringPact course content
while that source repository is being changed by another task.

## Stable Product Boundaries

- The local shell shares one SwimmerBackend account and cloud learner document
  with the online shell. Browser/SQLite state is cache/outbox; authoring
  sources and study snapshots remain local. Only the grading AI source differs.
- Analyze only commit-pinned snapshots. Dirty source files are excluded, and a
  dirty source requires explicit owner acknowledgement.
- External repositories stay clean; generated study data belongs under the
  configured UniversityLocal studies root.
- Application code, schemas, configuration, and project-owned skills belong in
  Git. Learner state, review history, snapshots, and UA runtime data do not.
- Grok Build is the preferred daily teacher; Codex and Claude Code remain
  supported. The Web UI does not add a second hosted model runtime.
- Current dependency versions and lesson counts come from `package.json`, lock
  files, manifests, and executable checks—not copied numbers in this page.

## Verification Gates

- `pnpm verify`
- `pnpm lint:lessons`
- Targeted CLI tests for `teach next`, course recovery, and source rebind
- Recovery export → empty-root import → export byte-for-byte round trip
- PGS asset check and AI-host routing smoke cases

For teaching state, use the CLI rather than interpreting this page:

```bash
pnpm university teach next
```

## Open Product Decisions

- Card scheduling currently carries FSRS state across content revisions. A
  rewritten card may therefore keep its old due date. Resetting it correctly
  would require a new append-only event and schema migration, not an in-place
  projection edit. Decide only after normal revision usage produces evidence.
- Exercises depend on an AI host for grading. Without a host, the learner answer
  can be recorded but the exercise cannot complete. Observe real daily use before
  adding a heuristic grader or another runtime model.

## Completed Evidence

- Foundation and daily bridge specs/plans: `docs/specs/completed/` and
  `docs/plans/completed/`.
- Detailed implementation receipts, including the Zero-Basics, self-study,
  expression, pedagogy, and reading-layer proofs:
  `docs/archive/current-work-receipts-2026-07-20-to-2026-08-08.md`.
- Current topology: `docs/reference/what-lives-where.md`.
- Host workflow guide: `docs/reference/using-university-local-with-grok.md`.

Do not move completed work back into active. Link it as provenance from a new,
bounded plan when additional work is authorized.
