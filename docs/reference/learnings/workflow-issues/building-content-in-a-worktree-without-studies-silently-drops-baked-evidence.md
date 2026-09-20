---
id: REF-LEARNING-WORKFLOW-ISSUES-BUILDING-CONTENT-IN-A-WORKTREE-WITHOUT-STUDIES-SILENTLY-DROPS-BAKED-EVIDENCE
title: "Building content in a worktree without studies silently drops baked evidence"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-28
last_reviewed: 2026-09-16
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "University content build"
capture_mode: pgs-native
---

# Building content in a worktree without studies silently drops baked evidence

`pnpm content` bakes evidence snippets out of `apps/local/studies`. That
directory is the authoring checkout and it is not present in a fresh worktree,
so the importer prints one line — `baked 0 evidence snippets (no checkout at
…/apps/local/studies)` — and carries on producing a complete, internally
consistent `apps/university/src/content/imported.json` with every `servedBytes`
several kilobytes smaller than it should be.

Nothing downstream objects. `sha256` and `packageBytes` are unchanged, so the
revision checks pass, and `pnpm verify` is green. The only visible symptom is
that a branch which happened to run `pnpm content` carries a hundred-line diff
against a branch that did not, and whichever one merges last wins.

This actually shipped into a merge: a terrain branch that had rebuilt content
in its own worktree took `servedBytes` down across all fifty-three courses, and
it was only caught because regenerating on the main checkout flipped every
value back in the same direction.

**Current prevention (2026-09-13).** The importer now refuses an unexplained
shrinking write. Use `pnpm worktree:prepare .` in a newly created worktree to
supply real sources before rebuilding; the [project baseline](../../../policy/best-practice-for-this-project.md)
owns the workflow. Do not discard a generated diff merely to hide the symptom.
If `servedBytes` moves down across every course while `sha256` holds still,
investigate source completeness and evidence mode before accepting the result.
The measurements above retain the original failure, not today's gate behavior.

**Shorter authored text is a different case (2026-09-16).** Removing redundant
rounds in three public-source lessons reduced one course by 8,427 served bytes;
the other five packages and byte counts stayed identical and all 131 repository
snippets still baked. The importer now checks each course, not just the total,
so growth elsewhere cannot mask a loss. A smaller changed public-source package
is accepted only when both immutable hashes verify, lesson identities remain,
changed lessons advance revision, and evidence, assets, cards and exercises are
identical. Missing prior bytes, removed material, same-hash shrink and repository
evidence shrink remain errors. The exact regression is
`apps/university/scripts/import-shrink.test.mjs`; this is not permission to use
`--allow-shrink` or reset the baseline to conceal a missing source.
