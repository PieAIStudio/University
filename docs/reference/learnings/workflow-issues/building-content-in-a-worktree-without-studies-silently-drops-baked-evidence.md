---
id: REF-LEARNING-WORKFLOW-ISSUES-BUILDING-CONTENT-IN-A-WORKTREE-WITHOUT-STUDIES-SILENTLY-DROPS-BAKED-EVIDENCE
title: "Building content in a worktree without studies silently drops baked evidence"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-28
last_reviewed: 2026-08-28
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

**What to do.** Only commit `imported.json` from a checkout that has
`apps/local/studies`. In a worktree, either leave the file alone — the content
build is a local convenience for running the dev server, not an artefact that
branch owns — or `git checkout -- apps/university/src/content/imported.json`
before committing. If a diff shows `servedBytes` moving in one direction across
every course while `sha256` holds still, that is this, not a content change.
