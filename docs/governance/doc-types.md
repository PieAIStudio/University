---
id: POLICY-DOC-TYPES
title: Document Types
type: policy
status: stable
canonical: true
owner: project
created: 2026-05-08
last_reviewed: 2026-05-08
domain: doc-governance
tags:
  - doc-gov
  - document-types
pinned: true
related:
  - POLICY-DOC-AGENT-RULES
supersedes: []
superseded_by: null
---

# Document Types

This file belongs in `docs/governance/` because it defines the document system's
own cabinets and lifecycle.

Allowed types:

| Type | Default path |
| --- | --- |
| `policy` | `docs/policy/` for project policy; `docs/governance/` for doc-system policy |
| `spec` | `docs/specs/active/` or `docs/specs/completed/` |
| `plan` | `docs/plans/active/` or `docs/plans/completed/` |
| `canon` | `docs/canon/` |
| `reference` | `docs/reference/` |
| `archive` | `docs/archive/` |

Markdown outside `docs/**` is not a governed doc by default.

Normal documents use:

```text
draft -> active -> completed -> stable -> superseded -> archived
```

Durable decisions use the governed `docs/adr/**` surface and the decision
lifecycle. Do not duplicate them in another decision folder.
