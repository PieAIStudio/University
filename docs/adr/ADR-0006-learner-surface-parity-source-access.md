---
id: ADR-0006
title: Learner Surface Parity Uses A Source Access Port
type: decision
status: accepted
canonical: true
owner: human
created: 2026-08-26
last_reviewed: 2026-08-26
domain: shells
tags:
  - shells
  - parity
  - source-access
  - learner-surface
pinned: false
related:
  - ADR-0001
  - ADR-0002
  - ADR-0003
  - SPEC-0001
  - SPEC-0003
supersedes:
  - ADR-0001
superseded_by: null
---

# ADR-0006: Learner Surface Parity Uses A Source Access Port

## Context

The two browser modes are one learner product. A control that exists only in
the authoring mode makes every learner-facing change a two-screen review, and
removing a control also removes the place where a future desktop, web, or
mobile implementation could land.

The earlier shell boundary named two questions: where AI comes from and where
lesson material comes from. The first is `GradingPort`; the second is
`ContentPort` / `ReaderPort`. The learner-facing source checkout and UA map
were incorrectly treated as authoring-only infrastructure, so the shared
reader hid the checkout button when its callback was absent and the world map
button lived under `src/authoring/`.

## Decision

The permitted shell boundary now has three questions, not two:

1. Where does AI come from? `GradingPort`.
2. Where does lesson material come from? `ContentPort` / `ReaderPort`.
3. Can this side reach the repository behind the lesson? `SourceAccessPort`.

`SourceAccessPort` always returns a value. It returns either an executable
action or a structured explanation containing what the capability does, why
this side cannot do it now, and how future desktop, web/manual, and mobile
support will work. The shared learner UI renders the control in both modes and
does not decide availability with an `AUTHORING` branch.

The authoring implementation performs the checkout, starts the UA dashboard,
and reads the layer-coverage map through the local server adapter. The delivery
implementation returns explanations: a published course package does not carry
the private repository or a process host, while a later desktop host can offer
an authorised checkout and graph; browser and mobile surfaces can provide the
same safe manual instructions.

The port owns the local route knowledge. In particular, the shared UI does not
construct `/api/studies/.../checkout`; retaining that route-layering correction
from the old implementation is part of this decision.

The learner surface remains one component tree. `#/studio` and its authoring
workbench remain the explicit authoring exception; they are not learner
controls. `e2e/G.one-chrome.spec.ts` must compare the world and lesson learner
control inventories and must fail when a control is injected into only one
mode.

## Consequences

- Source access is now a third port boundary, while the visible learner
  surface stays shared and item-for-item comparable.
- Delivery can be honest about a missing private-repository capability without
  deleting its future landing place.
- A source checkout action is returned synchronously so a user gesture can open
  a popup before the first awaited request; slower map coverage may preflight
  its snapshot before returning an action or explanation.
- The authoring exclusion check continues to remove only the workbench from
  delivery. The learner UA button and layer-coverage component are shared.

## Rejected

- Hiding the control when a callback is absent. That turns a capability gap
  into a surface gap and prevents the two modes from being compared.
- Putting repository routes or filesystem decisions in `packages/ui`. That
  would make the shared reader own one shell's storage boundary and would
  recreate the layering error this port removes.
