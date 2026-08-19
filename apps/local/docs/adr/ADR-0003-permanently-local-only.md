---
id: ADR-0003
title: Keep UniversityLocal Permanently Local-Only
type: decision
status: accepted
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
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
superseded_by: null
---

# ADR-0003: Keep UniversityLocal Permanently Local-Only

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

## Decision

1. UniversityLocal never integrates with SwimmerBackend or any other application
   backend.
2. It does not prebuild backend clients, auth, sync outboxes, upload queues, remote
   fallbacks, cloud schemas, or deployment configuration.
3. Courses, notes, snapshots, UA maps, learner state, and backups stay in the
   configured local study shelf.
4. Git may version UniversityLocal application code, schemas, skills, and public
   fixtures. Personal `studies/` data remains ignored and uses explicit local
   backups.
5. A future consumer `University` lives in a separate repository. It may reuse
   validated domain contracts and may adopt SwimmerBackend under its own product,
   privacy, and deployment decisions.
6. Any earlier document that describes SwimmerBackend as a future UniversityLocal
   sync candidate records a superseded possibility, not current authority.

## Consequences

UniversityLocal stays small, inspectable, offline-capable, and easy to move. It
avoids split-brain local/cloud truth and prevents speculative infrastructure from
contaminating the personal workflow. Cross-device access is not a UniversityLocal
feature; if it becomes a product requirement, it belongs to `University`.
