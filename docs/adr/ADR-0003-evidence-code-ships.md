---
id: ADR-0003
title: Evidence Code Ships To The Delivery Shell
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-22
last_reviewed: 2026-08-22
domain: content
tags:
  - evidence
  - parity
pinned: false
related:
  - SPEC-0001
  - ADR-0002
supersedes: []
superseded_by: null
---

# ADR-0003: Evidence Code Ships To The Delivery Shell

## Context

The shared reader already renders cited source with highlighted line ranges
when given an `evidenceBasePath`. The authoring shell passes one; the delivery
shell does not, so a paying learner saw coordinates where an author saw code.

That was recorded as a disclosure decision: shipping snippets means publishing
~19,600 lines across 314 files of the cited repositories.

Checked rather than assumed. Three of the four studies cite repositories the
owner controls. The fourth, `buzz`, cites `github.com/block/buzz`, which is
public and **Apache 2.0** — redistribution is expressly granted. There was no
third-party exposure to weigh.

## Decision

The delivery shell renders evidence exactly as the authoring shell does: real
lines, highlighted range, same component. Verifiable evidence is the product's
central claim, and a coordinate is not evidence.

`pnpm content` bakes the cited ranges into the course package. Anchors are
1,597, median 9 lines, longest 104 — split per course and loaded lazily, as
lesson screenshots already are.

## Consequences

- `EvidencePort` still differs by shell — the authoring side reads a live
  checkout, the delivery side reads baked ranges — but what a learner sees no
  longer does.
- Apache-2.0 attribution for `buzz` travels with the baked ranges.

## Rejected

Author-chosen per-anchor opt-in. It defends against an exposure that does not
exist here, at the cost of an authoring chore per anchor and a product whose
central claim is true only sometimes.
