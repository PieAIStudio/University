---
id: ADR-0001
title: Both Shells Hold An Account
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-22
last_reviewed: 2026-08-26
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

Both shells sign in to SwimmerBackend and share one account document containing
progress, review schedule, answers, reader marks, vocabulary, favourites,
practice history and settings. One implementation, in the kit.

The cloud document is canonical for learner/account data. Each shell keeps a
durable browser/SQLite cache and an outbox so a lesson can continue while
disconnected; binding the account merges and flushes that document. The disk
keeps what only exists on disk — the registered private repositories under
`apps/local/studies/` and the prose being written.

At the time of this decision, `GradingPort` was the only named divergence
between the shells: clipboard and AI coding host on one side, metered
SwimmerAIKit on the other. ADR-0006 supersedes that narrow enumeration with
three port boundaries. This account and learner-data decision remains in force.

## Consequences

- `ProgressPort` has one implementation. `ContentPort` and `EvidencePort` keep
  theirs; see ADR-0002 and ADR-0003.
- The shells may no longer look like different products, so navigation, path,
  reader and settlement are built once in `packages/ui` and mounted twice.
- Offline authoring survives, unbought: content sources remain local, while
  learner data can travel to another computer as soon as it has connectivity.

## Rejected

Sending `studies/` and in-progress prose to the backend. Those are four private
repositories and authoring sources; they remain local under every design.
