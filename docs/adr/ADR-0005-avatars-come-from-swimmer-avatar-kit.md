---
id: ADR-0005
title: Avatars Come From SwimmerAvatarKit
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-22
last_reviewed: 2026-08-22
domain: architecture
tags:
  - packages
  - 3d
  - avatars
pinned: false
related:
  - ADR-0004
  - POLICY-SHARED-BRAND-KIT-FIRST
supersedes: []
superseded_by: null
---

# ADR-0005: Avatars Come From SwimmerAvatarKit

## Context

University shipped a vendored GLOSS generator at `packages/avatar` while
`@pieai/swimmer-avatar-kit` already published the same generator. File-by-file
SHA-1 of `packages/avatar/src/gloss/*.js` matched the kit's vendored copies.
Six-species pixel diffs were antialias noise, not a second renderer. The
measurements live in `docs/reference/learnings/avatar-kit-vs-vendored/`
(`measurements.json`, `humanoid-pair.png`, `humanoid-diff.png`).

Two copies of one generator is the first University rule broken: share the
code; one implementation of anything, ever. Brand-kit-first says the same
thing from the other side: if a kit cannot do the job, change the kit and
release a version; do not fork it here.

The package description that claimed the generator was "used by both shells"
was already false. Only `apps/online` imported it. `apps/local` never did.

Walk and run were not on either public API. Deleting the vendored copy does
not drop locomotion; neither surface ever exposed it.

## Decision

Delete `packages/avatar`. The delivery shell consumes
`@pieai/swimmer-avatar-kit`. Future avatar capability that University needs
and the kit lacks goes upstream, then University upgrades the published
version. University does not fork the generator again.

## Consequences

- `@pieai/university-avatar` is gone. The online shell imports recipe helpers
  from the kit root, `dressScene` from `/materials`, and `Avatar` from
  `/react-three-fiber`.
- The lab's mesh/vert/buildMs readout stays. Kit `onBuilt` hands an
  `AvatarHandle`; `handle.stats` is the same three numbers.
- Kindergrimm provenance stays in the kit (`NOTICE.md`, vendor lock).
  University does not re-vendor the upstream.

## Rejected

Keeping `packages/avatar` as a "thin University wrapper". A wrapper over
identical bytes is still a second copy, and it is where the next missing
method would be patched instead of sent upstream.
