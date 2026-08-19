---
id: ADR-0004
title: Require Donor-First Engineering
type: decision
status: accepted
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - donor-first
  - open-source
  - engineering
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - SPEC-0002
  - REF-UNIVERSITY-LOCAL-LEARNING-DONOR-MAP-2026-07-20
supersedes: []
superseded_by: null
---

# ADR-0004: Require Donor-First Engineering

## Context

PBMLS and PBMLS-old contain useful learning ideas but also demonstrate the cost of
building schedulers, grading heuristics, disconnected components, and storage
contracts without enough external evidence. UniversityLocal already benefits from
directly reusing ts-fsrs and adapting Understand Anything. The owner requires the
same discipline for every substantial capability, including replacements of code
that already works.

Popularity alone is not proof. A wholesale donor transplant can import stale
frameworks, incompatible data ownership, inaccessible interactions, security risk,
or a different product's complexity.

## Decision

1. A non-trivial feature starts with donor research across official ecosystems,
   mature open source, and relevant Pie projects.
2. Intake compares license/provenance, maintenance, security, accessibility,
   architecture and data ownership, stack fit, operating cost, and migration risk.
3. Use a maintained dependency directly when its contract fits. Otherwise adapt
   the smallest proven pattern and retain UniversityLocal-owned domain contracts.
4. Record adopted, deferred, and rejected candidates. If local invention remains
   necessary, record why no suitable donor exists.
5. Revisit existing implementations when a donor is materially safer or better,
   but do not rewrite merely because a newer library exists.
6. Never copy PBMLS, PBMLS-old, or another application wholesale. Never adopt a
   scheduler, automated grading claim, or memory metric without independent
   validation.

## Consequences

Research becomes part of delivery time, but avoids longer cycles of rediscovering
known defects. UniversityLocal can reuse proven mechanics while keeping its own
local-only, evidence-bound product identity. Donor maps become durable engineering
evidence rather than a list of inspirational links.
