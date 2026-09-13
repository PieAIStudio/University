---
id: REF-WORK-QUEUE
title: "Work Queue"
type: reference
status: active
canonical: true
owner: "human"
created: 2026-09-13
last_reviewed: 2026-09-13
domain: "execution"
tags:
  - work-queue
  - verification
pinned: true
related:
  - REF-CURRENT-WORK
  - PLAN-MAINLINE-MAINTAINABILITY
---

# REF-WORK-QUEUE: Work Queue

## Purpose

One agent, one task at a time, on `main`. No branches, no worktrees, no parallel
lanes. This page is the running protocol; starting a working session takes one
instruction: *read this page, then begin.*

Queued tasks live in `docs/plans/active/`, sorted by filename. Finished ones move
to `docs/plans/completed/`.

Task documents are written with the user-scope `mainline-queue` skill, which
states outcomes and acceptance rather than file paths, because the task ahead in
the queue is changing the same code.

## Details

### How to run it

1. List `docs/plans/active/` and sort by filename. Take the **first unfinished**
   task. Re-read the directory before every task — do not carry a remembered
   list, because the queue changes while you work.
2. Read that task document in full. It is self-contained by design, and it is
   the only authority for its own scope.
3. Do the work. Run the gates the document names.
4. **One task, one commit, one push.**
5. Move the finished document to `docs/plans/completed/` and set its `status` in
   the same commit.
6. Return to step 1.

### The gates, and which one actually looks

| | Command | What it covers | Baseline 2026-09-13 |
| --- | --- | --- | --- |
| fast | `pnpm verify` | types, lint, format, unit tests, boundaries, build, docs | green at `9f5bc900` |
| docs | `pnpm doc-gov check` | governed frontmatter and integrity | 137 docs |
| complete | `pnpm e2e`, also run by `pre-push` | the real browser product | 235 passed / 6 skipped / 0 failed |

`pnpm verify` does not run the browser suite. "Verify is green" can therefore be
said perfectly honestly over a product that does not work. The suite cannot run
in CI either, because `apps/university/content` is generated, gitignored and
rebuildable only on the author's machine, so `pre-push` is the only place it ever
runs — the reasoning is kept in `lefthook.yml`.

That is why the push is not optional. A task that cannot go green cannot leave,
and the queue halts there instead of stacking later tasks on top of a break.

**Pass counts may rise, never fall.** A deleted test does not turn red; it
disappears. If a count drops, name the test that left and why, in the commit
body, before anything else.

### When to stop

- The complete gate will not go green — stop, do not start the next task, leave
  the work committed locally and write down what blocked it.
- The task document contradicts what the repository shows — stop and say so. A
  task document can be out of date; the repository is not.
- An explicitly independent task is blocked — step over it, take the next, and
  record what was skipped.

### Never

- Force-push or rewrite history. `origin/main` is the only undo button this model
  has, and a rewrite erases the thing it is meant to undo. Revert instead.
- Renumber queue entries while the queue is being executed; the executing session
  takes the first unfinished file, and renumbering changes what "first" means.
- Do work no queued document asked for.

### Why this shape

Parallel branches did not fail at merge; they failed at integration. Three lanes
that were each individually green produced 77 failing browser tests together,
because one lane narrowed the course catalogue while the others named the entries
it removed. Compatible lines, incompatible assumptions — and version control only
sees lines. A queue integrates after every task, when one change is in flight and
attribution is free. The dated record is in
[mainline maintenance](../../plans/completed/mainline-maintainability.md).

A branch remains correct for exactly one case: two pieces of work that must run
at the same time and touch the same files.

## Related Commands / Files

- `docs/plans/active/` — the queue; `docs/plans/completed/` — the archive
- `lefthook.yml` — where the complete gate is wired, and why it lives on push
- [Current work](current-work.md) — what each lane's authoritative entry is
