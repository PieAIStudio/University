---
id: POLICY-PROJECT-BEST-PRACTICE
title: Best Practice for This Project
type: policy
status: stable
canonical: true
owner: project
created: 2026-05-08
last_reviewed: 2026-09-08
domain: project-policy
tags:
  - project-policy
  - ai-development
pinned: true
related:
  - POLICY-DOC-AGENT-RULES
  - POLICY-DOC-TYPES
supersedes: []
superseded_by: null
---

# Best Practice for This Project

Every task reads this file, so it holds only what a session needs on arrival and
cannot get from the code. It used to hold a list of the *kinds* of rule that
could live here and no actual rules, which meant every task paid for it and no
task learnt anything.

## Working in a worktree

A fresh worktree cannot run the app until three things are done, because the
generated content and the personal campus data are both gitignored:

```
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @pieai/university-core build          # vite cannot resolve the core package without it
ln -s <main-checkout>/apps/university/content apps/university/content
ln -s <main-checkout>/apps/local/studies apps/local/studies/studies
UNIVERSITY_LOCAL_STUDIES_ROOT="$PWD/apps/local/studies/studies" pnpm start
```

These commands are for a fresh worktree with absent link targets. Inspect an
existing path rather than replacing it. Keep the tracked `apps/local/studies`
skeleton; the nested link makes its children resolve to real directories.
Per-study links are skipped by the shelf's `Dirent.isDirectory()` filter.
The explicit `UNIVERSITY_LOCAL_STUDIES_ROOT` selects the nested root for the
authoring server; the e2e launcher already detects that same layout. See the
verified [worktree learning](../reference/learnings/workflow-issues/building-content-in-a-worktree-without-studies-silently-drops-baked-evidence.md).

Prefer a sibling worktree when the project's tracked skill links point to the
sibling ProjectGovernanceSystem checkout: preserving the directory depth keeps
those relative links valid without editing governed asset links.

Without them the dev server serves `课程读不出来 shelf: 404`.

**Do not run `pnpm content` to fix that.** With no `apps/local/studies` it
rebuilds the tracked manifest with every course's `servedBytes` reduced by the
evidence it could not read, while the hashes stay put — silent, and green under
`pnpm verify`. It has happened three times. `import-courses.mjs` now refuses the
shrinking write, and the error names the three ways out.

## Believing a red test

Keep `pnpm verify` and unit tests free of a real-campus
`UNIVERSITY_LOCAL_STUDIES_ROOT` override. CLI and HTTP tests construct temporary
project roots, but the environment override wins over their configuration and
can send a test to personal study storage instead. Scope that variable only to
the intended preview command or the standalone `pnpm check:export-freshness`
check. A full verify that skips source freshness on the worktree skeleton needs
that separate, correctly scoped check; globally exporting the variable is not
the fix.

This suite is sensitive to machine load. With several agents running, tests that
pass alone fail together — `island-blueprint`, `kenney-r01-assets` and the grass
plan are the usual ones. **Re-run the single file before concluding anything is
broken.**

## Evidence

Browser-visible changes need a real browser pass and a screenshot, and the
screenshot has to be compared against one taken the same way: same worktree,
same viewport, same theme, same URL. A before/after captured by two different
setups is not evidence, and has already been mistaken for some.

## Where decisions live

Keep current-work as a short index, the active plan as the only task-state list,
and each decision in its existing ADR. Condense repeated rationale there; move
dated execution narratives to a clearly marked archive without dropping task
IDs, unresolved findings or evidence. Archive commands are not current authority.
Do not load archives by default or copy runtime versions/counts into startup rules.

- Product behaviour a learner can see: `docs/reference/player-journey/` (v5).
- What technique draws each part of the island, and what was already tried and
  rejected: `docs/adr/ADR-0008-one-locked-technique-per-island-element.md`.
  Change a lock by amending the ADR with a measurement, never by editing the
  renderer alone.
- Everything else: the rules in `AGENTS.md`, which are not repeated here.
