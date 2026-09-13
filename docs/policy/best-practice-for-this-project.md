---
id: POLICY-PROJECT-BEST-PRACTICE
title: Best Practice for This Project
type: policy
status: stable
canonical: true
owner: project
created: 2026-05-08
last_reviewed: 2026-09-13
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

Create worktrees only under the repository's ignored `.worktrees/` directory.
After `git worktree add`, run one command from the new checkout:

```sh
pnpm worktree:prepare .
```

Or run `pnpm worktree:prepare .worktrees/<lane>` from main. The existing
`scripts/link-studies-into-worktree.mjs` owns this workflow: preserve tracked
and existing study paths, supply missing private studies, project only approved
public app environment fields, install the frozen dependency graph, and rebuild
this checkout's content through `pnpm content`. It preserves the tracked import
date so an unchanged input does not produce a date-only diff. Review any other
generated diff; do not discard it blindly.

The command also refreshes the E2E cache baseline and saves four independently
reserved ports in ignored `.scratch/worktree.json`. The source choice lives in
the existing ignored `apps/local/university-local.config.local.json`, so ordinary
authoring startup, source freshness and E2E all read the same choice without a
global environment override. Existing focus/settings are preserved.
`pnpm e2e` reads those settings; explicit `E2E_*_PORT` values still win.
`--e2e-port-base <port>` selects four consecutive ports instead. A busy port is
an error, never permission to reuse or kill another task's server. Inspect PID
and cwd before stopping your own interrupted process.

An existing real `apps/local/studies/studies` isolation copy moves intact to
`.scratch/worktree-studies`, with its old path retained as a symlink. The API's
root guard stays unchanged. Existing isolation destinations are not replaced;
unrelated configuration fields and owner environment files are preserved.
`--studies-root <path>` explicitly selects an already marked
alternative source. The owner's three old sibling worktrees are not moved by
this command.

Each worktree owns its generated content: an old link to main's content cache
is preserved under `.scratch/` before regeneration, never followed for a
destructive rebuild. Source freshness and evidence-shrink guards remain enabled;
there is no `--allow-shrink`. The ignored PGS bridge under `.worktrees/` keeps
tracked governance/skill links intact without modifying their shared source.

After preparation run `pnpm verify` and `pnpm e2e`. Repeat preparation after a
merge or branch switch changes course inputs. Do not rebuild from an incomplete
campus or restore a generated manifest merely to hide a shrinking diff.

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
