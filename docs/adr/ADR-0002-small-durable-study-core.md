---
id: ADR-0002
title: Keep Durable Study Data Small And Collocate Each Course
type: decision
status: accepted
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - storage
  - curriculum
  - evidence
  - simplification
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0001
  - REF-UNIVERSITY-LOCAL-ARCHITECTURE-REFLECTION-2026-07-20
  - SPEC-0001
  - PLAN-0001
supersedes: []
superseded_by: null
---

# ADR-0002: Keep Durable Study Data Small And Collocate Each Course

## Context

The first implementation preserved three complete SupaLuv worktrees and split one
future course across `curriculum`, `materials`, and `practice`. It used 725 MB before
the first lesson existed, made study-root moves unsafe, and allowed evidence to read
from a mutable checkout. A full-ref mirror also copied unrelated Codex checkpoint
refs. Tracked symlinks could resolve to external repositories or private files that
were not fixed by the SupaLuv commit.

PBMLS already demonstrated that a broad component set without one connected review
path does not create a usable learning system.

## Decision

1. A clean snapshot is a manifest containing commit, tree, and source-boundary
   metadata backed by a UniversityLocal-owned bare Git object repository. It is not
   a permanently checked-out source tree.
2. The object repository fetches only explicitly requested commits. It does not
   mirror every source ref.
3. Evidence is read only from regular Git blobs at the bound commit. Directory,
   symlink, submodule, and external-file traversal is rejected.
4. UA workspaces are reproducible runtime state. They are removed after success,
   failure, or cancellation; only the analysis manifest and UA data are durable.
5. External symlinks are recorded and excluded from UA. A linked repository that
   matters to teaching becomes an explicit study instead of an invisible live
   dependency.
6. The human-facing content model is `study → course → unit → lesson`. Lesson
   exercises and cards live with that lesson. Learner state remains separate in
   `learner/learning.sqlite`.
7. The first UI is organized around Today and Studies. Rich graph visualization,
   extra question types, analytics, exports, and cloud sync wait for evidence from
   three real learning sessions.
8. The local database contains only proven local learning state. UniversityLocal
   never adds a SwimmerBackend or other cloud-sync outbox; ADR-0003 makes this a
   permanent product boundary.

## Consequences

### Positive

- The durable study is movable, smaller, and easier for a human or AI host to
  inspect.
- Commit-bound evidence becomes genuinely immutable and cannot escape through a
  symlink.
- A course resembles an AnvilLocal book: its teaching content is found in one
  container.
- The implementation order follows learning value instead of page count.
- Future University product work can reuse IDs, schemas, evidence, and events
  without inheriting a local filesystem layout as a SaaS architecture.

### Negative

- UA must recreate a checkout before each analysis.
- External linked policy or source repositories require separate registration if
  their contents must be taught.
- UniversityLocal intentionally has no cloud synchronization; a commercial
  `University` would be a separate repository and product.
- Existing pre-proof SupaLuv worktrees and manifests require a one-time migration.
