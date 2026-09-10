---
id: REF-LEARNING-WORKFLOW-ISSUES-REGENERATING-A-PER-LESSON-DEBT-BASELINE-IN-A-WORKTREE-DELETES-THE-DEBT-OF-STUDIE
title: "Regenerating a per-lesson debt baseline in a worktree deletes the debt of studies it cannot see"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-10
last_reviewed: 2026-09-10
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# Regenerating a per-lesson debt baseline in a worktree deletes the debt of studies it cannot see

## Guidance

Symptom: running 'lint-lessons.mjs --update-baseline' in a git worktree rewrote apps/local/scripts/lesson-debt.json from 520 entries to 444, silently dropping 352 entries — every lesson belonging to the buzz and supaluv studies. Those lessons would then have failed hard the next time anyone linted them from the main checkout.

Root cause: studies arrive in a worktree as symlinks into a sibling checkout. When that checkout is not present (or the link resolves to nothing), the scan simply does not see those lessons — and --update-baseline rebuilds the file from what today's scan found, so unseen means deleted. The regeneration also grandfathered 82 lessons into 'detail' debt they had not previously been forgiven for, because a rebuild-from-today forgives whatever fails today.

Verified: diffing the file before and after showed both effects; reverting restored a clean tree.

Guidance: never regenerate a whole-repository baseline from a partial checkout. For a NEW ratcheted rule, prefer a dated cutoff over per-lesson ledger entries — compare the lesson's own manifest.updatedAt against the date the rule was introduced. It needs no file, it covers lessons the process cannot see, and it expires the same way a ledger entry does (a rewrite bumps the timestamp). Check that the data actually separates on a date first: here every lesson with an activity was touched after 2026-09-09 and every lesson without one before 2026-09-08, so the boundary sat inside a real gap rather than cutting through a working day.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
