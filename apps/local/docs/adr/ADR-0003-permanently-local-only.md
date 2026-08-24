---
id: ADR-0003
title: Superseded: Keep UniversityLocal Permanently Local-Only
type: decision
status: superseded
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-08-24
domain: architecture
tags:
  - local-only
  - product-boundary
  - backend
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0001
  - ADR-0002
  - SPEC-0002
supersedes: []
superseded_by: ADR-0001-both-shells-hold-an-account
---

# ADR-0003: Keep UniversityLocal Permanently Local-Only (Superseded)

> Superseded on 2026-08-24 by the repository-level account decision in
> `docs/adr/ADR-0001-both-shells-hold-an-account.md`. The historical local-only
> decision is retained for traceability; it is no longer product authority.

## Context

UniversityLocal is the owner's personal campus, operated by a local coding host in
the same spirit as AnvilLocal. Earlier foundation documents left open a possible
future SwimmerBackend sync lane. The owner has now made the stronger and clearer
product decision: a commercial `University` may be built later, but it is a
separate product and repository. Turning UniversityLocal itself into a local/cloud
hybrid would mix personal infrastructure with account, sync, deployment, privacy,
and multi-user responsibilities it does not need.

Local storage and model-host privacy are also separate questions. Keeping data out
of SwimmerBackend does not imply that a hosted AI model receives no prompt or code
context; each host's privacy controls must be checked independently.

## Former Decision

1. UniversityLocal never integrated with SwimmerBackend or any other application
   backend.
2. It did not prebuild backend clients, auth, sync outboxes, upload queues, remote
   fallbacks, cloud schemas, or deployment configuration.
3. Courses, notes, snapshots, UA maps, learner state, and backups stayed in the
   configured local study shelf.
4. Git may version UniversityLocal application code, schemas, skills, and public
   fixtures. Personal `studies/` data remains ignored and uses explicit local
   backups.
5. A future consumer `University` lived in a separate repository. It could reuse
   validated domain contracts and adopt SwimmerBackend under its own product,
   privacy, and deployment decisions.
6. Any earlier document that describes SwimmerBackend as a future UniversityLocal
   sync candidate records a superseded possibility, not current authority.

## Consequences

The former decision kept the shell small and offline-capable. It did not survive
the 2026-08-24 product rule: local and online are now one learner product, with
one cloud account document and one shared learner-data contract. Only the AI
grading source remains different. Authoring sources and study snapshots still
stay on the local shelf and are not uploaded as part of learner sync.
