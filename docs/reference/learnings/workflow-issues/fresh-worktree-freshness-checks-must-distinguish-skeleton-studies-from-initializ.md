---
id: REF-LEARNING-WORKFLOW-ISSUES-FRESH-WORKTREE-FRESHNESS-CHECKS-MUST-DISTINGUISH-SKELETON-STUDIES-FROM-INITIALIZ
title: "Fresh worktree freshness checks must distinguish skeleton studies from initialized studies"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-09-08
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

# Fresh worktree freshness checks must distinguish skeleton studies from initialized studies

## Guidance

When a repository tracks an apps/local/studies README and gitignore skeleton, checking only whether the directory exists makes check-export-freshness treat every committed recovery export as a real source and fail with ENOENT. Detect at least one valid child study.json before comparing; skip only when none exists, while keeping stale-source mismatches red when initialized studies are present.

## Keep a real-source override out of the test process

Run `pnpm verify` without `UNIVERSITY_LOCAL_STUDIES_ROOT`. If the worktree only
contains the skeleton, follow it with a separate read-only source check:

```sh
UNIVERSITY_LOCAL_STUDIES_ROOT=/absolute/path/to/initialized/studies pnpm check:export-freshness
```

Do not place that override on the entire `pnpm verify` invocation. The config
loader gives it precedence over a test fixture's temporary project config, so
CLI and HTTP tests can open the real campus instead of their fixture. The
observed symptom was 27 failures across CLI, HTTP and recovery tests, including
`ENOENT` for `sample-study/study.json` beneath the real source root. Removing the
inherited override made the same tests pass; the separately scoped freshness
command then confirmed all four exports against their real courses. This is an
invocation boundary, not a reason to weaken freshness or fixture assertions.

If an override accidentally reaches a fixture run, check for created files and
database writes before proceeding. Preserve user data; an old fixture-like
directory name alone does not prove that the current run created it.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
