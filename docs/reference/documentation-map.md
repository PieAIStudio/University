---
id: REF-DOCUMENTATION-MAP
title: Documentation Map
type: reference
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-10-02
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
| What is active, and what comes next? | [Current work](execution/current-work.md): a short navigation index; its "Next mainline work" row is the order of work |
| How is work run on the mainline? | [Work queue](execution/work-queue.md): one task, one commit, one push |
| What does the learner see? | [Player journey V7](player-journey/v7/index.html) and its [amendment one](player-journey/v7/lesson-steps-amendment.html); earlier versions only where V7 is silent |
| How is a lesson written? | [SPEC-0001](../specs/active/SPEC-0001-universitylocal-parity-contract.md), then the write-lesson skill in `apps/local/.agents/skills/write-lesson/` |
| Why these 3D techniques, and where does scene data come from? | [ADR-0008](../adr/ADR-0008-one-locked-technique-per-island-element.md), [ADR-0009](../adr/ADR-0009-the-procedural-map-is-one-pipeline.md), [ADR-0011](../adr/ADR-0011-3d-learning-games-are-assembled-from-one-kit.md) |
| How does this Mac/phone preview restart? | [Local device testing](execution/local-device-testing.md), dated machine facts and recovery |
| What happened in older rounds? | The completed plan or archive link named by the decision or row you are reading; do not load all of `docs/plans/completed/` or `docs/archive/` |

Finished plans keep their reasons and evidence in `docs/plans/completed/`; each
opens with a note on what finished and where any remaining item went. They are
history, not assignments. Current decisions stay in the ADRs and the journey;
raw failure and measurement evidence is read only for the result being
investigated.

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
