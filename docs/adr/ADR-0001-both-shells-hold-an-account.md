---
id: ADR-0001
title: Both Shells Hold An Account
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-22
last_reviewed: 2026-08-22
domain: shells
tags:
  - shells
  - backend
  - identity
pinned: false
related:
  - SPEC-0001
  - SPEC-0003
supersedes: []
superseded_by: null
---

# ADR-0001: Both Shells Hold An Account

## Context

One sentence — "UniversityLocal must not depend on, integrate with, upload to,
or prepare a sync lane for any application backend" — was governing two
unrelated things. It was written to protect the single producer of course
content. It also happened to forbid the learner having a name, which nobody
had argued for.

The stated cost of opening it was offline authoring. That premise was thin:
the authoring shell's central act is grading through an AI coding host, and a
host needs the network.

## Decision

Both shells sign in to SwimmerBackend and share one account, progress record,
review schedule, favourites and settings. One implementation, in the kit.

Storage is local-first. The disk keeps what only exists on disk — the
registered private repositories under `apps/local/studies/` and the prose being
written. The backend keeps account, progress, review, favourites, settings.

`GradingPort` is the single permitted divergence between the shells: clipboard
and AI coding host on one side, metered SwimmerAIKit on the other.

## Consequences

- `ProgressPort` has one implementation. `ContentPort` and `EvidencePort` keep
  theirs; see ADR-0002 and ADR-0003.
- The shells may no longer look like different products, so navigation, path,
  reader and settlement are built once in `packages/ui` and mounted twice.
- Offline authoring survives, unbought: the two halves of the data want
  opposite homes.

## Rejected

Backend as source of truth for everything. `studies/` is four private
repositories; that half does not go to a backend under any design.
