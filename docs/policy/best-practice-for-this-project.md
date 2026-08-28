---
id: POLICY-PROJECT-BEST-PRACTICE
title: Best Practice for This Project
type: policy
status: stable
canonical: true
owner: project
created: 2026-05-08
last_reviewed: 2026-08-28
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
pnpm install --prefer-offline
pnpm --filter @pieai/university-core build          # vite cannot resolve the core package without it
ln -sfn <main-checkout>/apps/university/content apps/university/content
for d in buzz general sample supaluv turing-pact university-local; do
  ln -sfn <main-checkout>/apps/local/studies/$d apps/local/studies/$d
done
```

Without them the dev server serves `课程读不出来 shelf: 404`.

**Do not run `pnpm content` to fix that.** With no `apps/local/studies` it
rebuilds the tracked manifest with every course's `servedBytes` reduced by the
evidence it could not read, while the hashes stay put — silent, and green under
`pnpm verify`. It has happened three times. `import-courses.mjs` now refuses the
shrinking write, and the error names the three ways out.

## Believing a red test

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

- Product behaviour a learner can see: `docs/reference/player-journey/` (v5).
- What technique draws each part of the island, and what was already tried and
  rejected: `docs/adr/ADR-0008-one-locked-technique-per-island-element.md`.
  Change a lock by amending the ADR with a measurement, never by editing the
  renderer alone.
- Everything else: the rules in `AGENTS.md`, which are not repeated here.
