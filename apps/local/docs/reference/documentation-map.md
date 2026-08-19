---
id: REF-DOCUMENTATION-MAP
title: Documentation Map
type: reference
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-08-08
domain: meta
tags:
  - navigation
pinned: false
related: []
---

# Documentation Map

This is a human and AI map of the governed document shelves. It is not the AI startup entrypoint; `AGENTS.md` is.

## AI Startup Source

Use `AGENTS.md` for startup reading. It should point agents to:

- `docs/policy/*.md`
- `docs/governance/boundary.md`
- `docs/governance/ssot-v1.1.md`
- `docs/governance/doc-agent-rules.md`
- `docs/governance/doc-types.md`
- `docs/governance/agents-routing/<selected-profile>-v1.1.md`
- `docs/reference/execution/current-work.md`

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

## Operational references (not shelves)

| Doc | When |
| --- | --- |
| `docs/reference/execution/current-work.md` | What is in flight / already shipped |
| `docs/reference/using-university-local-with-grok.md` | Daily host + campus use (外语模式, links, CLI) |
| `docs/reference/lesson-pedagogy.md` | Why lessons look like they do (skill is SSOT for shape) |
| `docs/reference/what-lives-where.md` | Airlock vs `studies/` vs live product |
| `docs/reference/module-map.md` | Which source module may depend on which, and why three big files stay whole |

Lesson **authoring** contract is the skill `.agents/skills/write-lesson/`, not a
second copy under `docs/**`. Research notes under `docs/reference/下一阶段/` are
historical strategy; check `current-work.md` before treating them as backlog.

UniversityLocal learning content and generated study artifacts under `studies/`
are product data, not governed project documents merely because some are
Markdown. Do not silently place them under `docs/**`.

Markdown outside `docs/**` is not governed by default. Product prompts, assets,
project-package canon, generated media notes, and source-package files stay in
their product/workbench structure unless this project explicitly opts them into
doc-gov.

Optional skills may create `docs/brainstorms/**` or `docs/pulse-reports/**` as
external artifacts. Capture Learning writes governed references under
`docs/reference/learnings/**`.
