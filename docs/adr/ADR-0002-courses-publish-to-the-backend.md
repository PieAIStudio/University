---
id: ADR-0002
title: Courses Publish To The Backend, Behind A Gate
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-22
last_reviewed: 2026-08-22
domain: content
tags:
  - content
  - backend
  - entitlement
pinned: false
related:
  - SPEC-0001
  - ADR-0001
supersedes: []
superseded_by: null
---

# ADR-0002: Courses Publish To The Backend, Behind A Gate

## Context

Courses reach delivery as static JSON: `pnpm content` writes 8.5 MB into
`apps/online/content/`, fetched at `/content/<study>/<course>.json`.

> Path only, 2026-08-25: the two apps became `apps/university`, so that
> directory is `apps/university/content/` and it is copied into the bundle only
> by the delivery build. The URL, the size and everything this record decided
> are unchanged.


Reachability was therefore never the problem. **Entitlement is.** Those files
are served unauthenticated, so every course is free to anyone who opens
devtools or runs `curl`. A commercial product cannot charge for a file it has
already shipped.

## Decision

Course packages publish to SwimmerBackend, and the delivery shell reads them
from there under an entitlement check.

Publishing is a deliberate act, separate from writing. A package pushed from
the authoring shell arrives as a draft; a customer sees it only after it is
published.

The single producer is unchanged: `apps/local` is the only place a lesson is
authored, and `apps/online` still cannot author one. What changed is where the
bytes travel, not who writes them.

> Naming only, 2026-08-25: those two are now the authoring server and the
> delivery build of one app. The producer is still one, and it is still the
> filesystem side.

## Consequences

- SPEC-0001's "content leaves only as a recovery export written to disk" is
  replaced by "content leaves only through publish, and publish is gated".
- The draft/published distinction becomes a real state rather than a habit.
- Free-tier scope becomes a decision that can be made, because there is now
  something to withhold.

## Rejected

Leaving courses as static files and adding a paywall in front of the app. The
files stay fetchable at their own URLs; a paywall over a public file is
decoration.
