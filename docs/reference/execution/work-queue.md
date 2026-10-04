---
id: REF-WORK-QUEUE
title: "Work Queue"
type: reference
status: active
canonical: true
owner: "human"
created: 2026-09-13
last_reviewed: 2026-10-04
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

### Current Owner order · 2026-10-04

**17 (R7 → R11) → 16 → overnight report.** Tasks 13, 18 and 14 have been
delivered. Task 17 R0–R6 are complete through pushed commit `5bfb0975`; each
remaining stage is one commit, one push and a complete gate. Task 16 follows
R11 and is skipped only if one of its three required kit versions is not
published. Task 12 remains active as **awaiting Owner reading** and is skipped;
06, 09 and 15 remain Owner-held and are skipped. Do not renumber entries.

Owner revised this order on 2026-10-04 after task 14's repair push. The R3
gate repair and push completed on 2026-10-05, R4 documentation convergence
completed in `73968ab9`, R5 reachability cleanup completed in `b41cfdd4`, and
R6 dependency hardening completed in `5bfb0975`; task 17 continues through R11
before task 16. The fourth lesson stays unpublished and
protected, and its typo waits for Owner feedback in task 12's review → fix
workflow.

Task 14 creates `/Users/yuanfei/PieAI/UniversityCourses`. Do not touch
`/Users/yuanfei/PieAI/UniversityContent`, another Codex's preparation repository.
If credentials prevent creating a private GitHub repository, create the local
repository, record the original failure, and continue.

Task 17 no longer depends on 16. After R0's measurement and target plan have
passed their gates and been committed and pushed, create empty
`.scratch/task17/r0-ready`. Check `.scratch/task17/claude-r0-review.md` every
five minutes for at most 60 minutes. Apply any review that arrives; otherwise
continue with the recorded plan. R1–R5 each retain one commit, one push, full
gates, pipeline tests and a native dry-run. No stage waits indefinitely for Owner.

Task 16 moves after 17 and depends on it. It remains held until UIKit 3's stable
release and the decoupled NerveKit `0.8.0` and AuthKit `0.8.0-rc.1` are published.
The App injects UIKit controls and the authentication client; the kits must not
depend on each other. Earlier coupled candidate tarballs do not release this hold.

Task 14's initial pre-push browser stop and its repair are recorded in
`completed/14-content-repository-integration.md`. The repair must finish with a
complete push before task 17 starts. Record judgment and deviations in the
owning task document. At completion or a required stop, write the detailed
Claude review report at `.scratch/overnight-20261003/REPORT.md`, including
commits, verbatim gate counts, refactor measurements and deletions, grading
evidence, incomplete/skipped work and plain-language Owner decisions.

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

Owner narrowed the stop conditions on 2026-10-03:

- A task's full gates cannot be made green. First run each failed case alone
  twice. If both passes support a load-related failure, wait for one-minute
  load below 20 and no other Playwright run, then retry the ordinary push once.
  If the full gate still fails, stop, leave the work committed locally, record
  the original failures and retry evidence, and do not start the next task.
- An action needs Owner himself: login, payment or release approval. Task 14's
  documented local-repository fallback for GitHub credentials is an exception.

Other discrepancies, unavailable model routes and reversible implementation
choices are decided within the authorized scope, with reasons recorded in the
owning task. Preserve original error text. Do not treat an outdated task pack
as a new permission gate; this Owner instruction supersedes earlier stop rules.
Before every push, require one-minute load below 20 and no other Playwright run.

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
