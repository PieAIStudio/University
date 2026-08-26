---
id: ADR-0007
title: Published Course Packages Are Separate From Entitlement
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-26
last_reviewed: 2026-08-26
domain: content
tags:
  - content
  - publication
  - entitlement
  - pricing
pinned: false
related:
  - ADR-0001
  - ADR-0002
  - SPEC-0001
  - SPEC-0003
supersedes:
  - ADR-0002
superseded_by: null
---

# ADR-0007: Published Course Packages Are Separate From Entitlement

## Context

Two questions had been stored as one decision:

1. Which course revision may reach a learner?
2. Which learner rights may carry a price?

The delivery build currently serves course JSON as public static files on
Vercel, under `/content/<study>/<course>.json`. It does not have a per-learner
course-package request or a backend entitlement check. That is also the
correct product boundary for V4/V5: course prose is never behind a paywall.
Potentially metered surfaces are AI and account sync.

ADR-0002 made backend transport and course entitlement one decision because it
assumed that a commercial course had to hide its package bytes. That assumption
does not match the deployed static delivery shape or the V4/V5 content rule.
The decision record remains history; this ADR supersedes it without rewriting
its body.

## Decision

### Publication is the content gate

The authoring/import/review/publish lane decides which exact, reviewed package
revision enters delivery. A learner may read a published revision only. Draft,
rejected, or replaced material must not be copied into the public delivery
artifact. The publish lane remains a separate implementation item; this ADR
does not claim that item is finished.

### Published delivery is public

The published package is a public static artifact. Delivery may serve it to an
unauthenticated browser, and a learner's ability to fetch course bytes does not
depend on a paid plan. Publication protects release quality and version
selection; it is not a money gate.

### Entitlement governs AI and sync only

The shared core exposes `readEntitlements`. Its read model contains the
selected plan, whether the source is the baseline or a remote grant, AI rights,
and sync entitlement/availability. It has no course, lesson, revision, or
content-access field. `ContentPort` and `ReaderPort` continue to answer where
published material comes from and how it is read; `GradingPort` continues to
answer where AI grading comes from. No new application port is introduced.

The single configuration home is
`packages/core/src/billing/plans.ts`. It currently contains one free baseline.
Paid plans may be added there with their AI/sync rights and a configured price;
until the product owner fills those values, no paid tier or price is promised.

### Missing remote state is deterministic

When the identity port is unconfigured, or a signed-in session has no usable
remote adapter, the read model uses the free baseline. Deterministic grading
and local learning remain available. Sync is reported as unavailable, rather
than being guessed as active. A signed-in session with a configured remote but
without a grant also uses the baseline, preserving the existing account-sync
contract while there is no entitlement table.

## Consequences

- Course bytes are intentionally not a commercial secret. A release must pass
  the publication gate, but the resulting static package is open to every
  learner.
- The entitlement model cannot accidentally become a course paywall because
  course access is not part of its shape.
- Pricing and future plan details are data in one shared configuration, not
  numbers embedded in screen copy or separate shell implementations.
- Payment will need a server-authenticated grant for AI/sync, plus explicit
  expiry, revocation, idempotency, and reconciliation rules. It must not add a
  course-package gate.

## Rejected

- Keeping course packages behind a backend entitlement check. That conflicts
  with the actual public static delivery artifact and tries to charge for
  course bytes that are already public.
- Adding a UI-only paywall over public course URLs. It would be a decoration,
  not an access boundary.
- Adding an entitlement port or a local wallet before the backend contract and
  product pricing exist. The skeleton is pure core resolution with injected
  facts, so both builds still share one implementation.
