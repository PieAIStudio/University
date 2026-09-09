---
id: REF-DOCUMENTATION-MAP
title: Documentation Map
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-08
domain: meta
tags:
  - navigation
pinned: false
related: []
---

# Documentation Map

This is a human and AI map of the governed document shelves. It is not the AI startup entrypoint; `AGENTS.md` is.

## AI Startup Source

Use root `AGENTS.md` and the project baseline first, then only the matching lane.
The policy tree is an index, not a startup glob; governance rules are loaded for
documentation work, not for every renderer edit.

| Question | Read |
| --- | --- |
| What is active? | [Current work](execution/current-work.md), a short navigation index |
| Which 3D tasks remain? | [Delivery plan](../plans/active/continuous-world-delivery.md), the sole task-state list |
| Why these techniques? | [ADR-0008](../adr/ADR-0008-one-locked-technique-per-island-element.md), concise choices/rejections with historical evidence links |
| Where does scene data come from? | [ADR-0009](../adr/ADR-0009-the-procedural-map-is-one-pipeline.md), shared pipeline and source map |
| How does this Mac/phone preview restart? | [Local device testing](execution/local-device-testing.md), dated machine facts and recovery |
| What happened in older trials? | Follow the particular archive link from the decision or R receipt; do not load all of `docs/archive/` |

The 2026-09-08 cleanup keeps all 128 task entries and their states. One local
`SCRATCH/HANDOFF.md` points to the current plan; it is not another task list.
Current decisions stay in the ADRs, device recovery in the device reference,
and dated outcomes in the plan-linked archive. Old agent prose is not a new
worker assignment or product acceptance. Raw failure/measurement evidence is
retained separately and read only for the result being investigated.

## Areas

| Area | Purpose |
| --- | --- |
| `docs/policy/` | Project policy and AI development rules |
| `docs/adr/` | Governed durable decision records |
| `docs/specs/active/` | Active requirements |
| `docs/specs/completed/` | Completed specs |
| `docs/plans/active/` | Active implementation plans |
| `docs/plans/completed/` | Completed execution records |
| `docs/reference/learnings/` | Governed reusable learning references, recalled only when relevant |
| `docs/canon/` | Durable project truth |
| `docs/reference/` | Guides and references |
| `docs/archive/` | Retired history |
| `docs/governance/` | Governance core rules, SSOT, agents routing, doc types, templates, and manifest |

Markdown outside `docs/**` is not governed by default. Product prompts, assets,
project-package canon, generated media notes, and source-package files stay in
their product/workbench structure unless this project explicitly opts them into
doc-gov.

Optional skills may create `docs/brainstorms/**` or `docs/pulse-reports/**` as
external artifacts. Capture Learning writes governed references under
`docs/reference/learnings/**`.
