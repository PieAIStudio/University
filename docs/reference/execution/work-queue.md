---
id: REF-WORK-QUEUE
title: "Work Queue"
type: reference
status: active
canonical: true
owner: "human"
created: 2026-09-13
last_reviewed: 2026-10-03
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

Queued tasks live in `docs/plans/active/`. Follow the explicit Owner order below;
filename order is the fallback for entries not covered by it. Finished ones move
to `docs/plans/completed/`.

Task packs are written with the user-scope `task-pack-queue` skill, which
states outcomes and acceptance rather than file paths, because the task ahead in
the queue is changing the same code.

## Details

### Current Owner order · 2026-10-03

**11 → 12 → 13 → 18 → 14 → 16 → 17.** Tasks 11 and 12 have been pushed; task 12 awaits Owner reading.
Complete task 13, then run task 18 before 14. The writing pipeline is the beta bottleneck and the Owner
needs its fourth lesson early. This replaces the prior after-17 instruction.
Tasks 06, 09 and 15 remain Owner-held and are skipped until their stated authority
or factual prerequisites are supplied; candidate-package availability does not
release task 15.

When task 12 has passed its gates and produced the unpublished fourth lesson,
commit/push its pipeline changes, leave it active as **awaiting Owner reading**,
provide `pnpm primm:preview` with full-length real answers, and proceed to 13.
Return to 12 through review → fix when feedback arrives. Task 13 must preserve
that unpublished fourth lesson. Owner added
[18: required facts must survive grading](../../plans/active/18-grading-must-catch-dropped-facts.md)
on 2026-10-03 under the freeze exception for a feature that did not actually work:
**after 13, before 14**, using the preserved real false-pass answer for a stable
regression, repairing preview and delivery enforcement, and re-evaluating the
fourth lesson's samples. Its typo waits for Owner feedback in task 12.
Task 14 moves pipeline writes through the same
content-root configuration. Task 16's A stage is local-only and goes to Claude;
task 17 stops after R0 for Claude review and retains pipeline tests plus a native
dry-run at every stage. Each task pack owns its detailed acceptance boundary.

### How to run it

1. Re-read `docs/plans/active/` before every task. Take the **first unfinished,
   unblocked task** in the current Owner order, applying each pack's explicit
   skip/wait rules; use filename order for other entries. Do not carry a
   remembered list, because the queue changes while you work.
2. Read that task document in full. It is self-contained by design, and it is
   the only authority for its own scope.
3. Do the work. Run the gates the document names.
4. **One task, one commit, one push.**
5. Move the finished document to `docs/plans/completed/` and set its `status` in
   the same commit.
6. Return to step 1.

### The gates, and which one actually looks

| | Command | What it covers | Baseline 2026-10-02 (`26a296fe`) |
| --- | --- | --- | --- |
| fast | `pnpm verify` | types, lint, format, unit tests, boundaries, build, docs | green |
| docs | `pnpm doc-gov check` | governed frontmatter and integrity | 168 docs |
| complete | `pnpm e2e`, also run by `pre-push` | the real browser product | 430 passed / 0 failed |
| timing | `pnpm e2e:timing`, also run by `pre-push` | frame-time and loading budgets | 40 passed / 0 failed |

The current browser floor is **431**, with all 40 timing cases retained: task 11's
[actual push receipt](../../plans/completed/11-test-catalogue.md) records delivery
at `73a8b587` on 2026-10-03. The table above remains the dated pre-task baseline.
The first baseline, 2026-09-13 at `9f5bc900`, was 137 docs and 235 browser tests.
When the default ports are busy, run the suites on another block with
`E2E_ONLINE_PORT`, `E2E_LOCAL_WEB_PORT`, `E2E_LOCAL_API_PORT` and
`E2E_GRADING_PORT`.

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
