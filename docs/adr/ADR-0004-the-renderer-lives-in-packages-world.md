---
id: ADR-0004
title: The Renderer Lives In packages/world
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
pinned: false
related:
  - SPEC-0001
  - SPEC-0003
supersedes: []
superseded_by: null
---

# ADR-0004: The Renderer Lives In packages/world

## Context

SPEC-0001 says the shared kit must not own a renderer. SPEC-0003 says both
shells render one world. Read together those look contradictory, and the
contradiction was derived independently more than once.

## Decision

The scene lives in `packages/world`, a package of its own. `packages/ui` stays
at zero `three`.

"The shared package" in SPEC-0001 means the parity kit — `packages/core` and
`packages/ui`. It does not mean "any package both shells import".

## Consequences

- A unit test of the lesson reader never stands up a WebGL mock.
- Importing a Markdown component cannot drag in a renderer.
- `apps/local` installs `three` only when it depends on `packages/world`, which
  is a decision it makes once and in public.

## Rejected

Putting the scene in `packages/ui`. It makes every consumer of the reader pay
for a renderer.
