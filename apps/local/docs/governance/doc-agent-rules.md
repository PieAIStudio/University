---
id: POLICY-DOC-AGENT-RULES
title: Documentation Agent Rules
type: policy
status: stable
canonical: true
owner: project
created: 2026-05-08
last_reviewed: 2026-09-10
domain: doc-governance
tags:
  - doc-gov
  - agent-rules
pinned: true
related:
  - POLICY-DOC-TYPES
supersedes: []
superseded_by: null
---

# Documentation Agent Rules

For ordinary content edits, use this short guide and the applicable project
instructions; detailed governance is not universal startup reading.

Doc-gov governs `docs/**` by default. Do not move product prompts, generated
media notes, source assets, runtime docs, or project-package Markdown into
`docs/**` unless the project explicitly opts those files into governance.

## Edit Or Create

Update the existing canonical source and affected references. Preserve IDs,
ownership, lifecycle, decision rationale and original evidence. A normal content
edit does not require a new Spec, Plan, ADR or proof document; use those existing
roles when substantial work, cross-session handoff or a durable decision needs one.

Directory indexes such as README.md and tool-topic guides are allowed under the
normal document types and metadata. Do not collect unowned session drafts by AI
author name or use temp/latest/final-style document names.

Before creating a document, search:

```bash
pnpm doc-gov find <topic>
```

If a canonical document exists, update it instead of creating a parallel document.
`find` may return valid partial results with diagnostics and exit 1. Resolve
ambiguity before writing; discovery is not proof of repository health.

Read detailed rules only when changing their contract: `doc-types.md` for type,
metadata or lifecycle; `boundary.md` and relevant `ssot-v1.1.md` sections for
scope, ownership, directory contracts or host aliases; the selected routing file
for workflow changes. Verify affected facts and references with relevant project
checks, retaining required delivery gates.

## Status Meaning

Normal documents use `draft`, `active`, `completed`, `stable`,
`superseded`, or `archived`. These describe the document's current role;
they are not six mandatory steps or six documents to produce for every task.

`completed` is for finished execution records or specs that should no longer appear in active folders.

Durable decisions belong only in `docs/adr/**`. They use the governed decision
frontmatter and decision lifecycle; do not duplicate them elsewhere.

Keep current guidance short and authoritative. Retire replaced instructions
with a link to the successor; preserve useful decision rationale and original
evidence. Use the existing document-convergence rule, not a parallel AI summary
library or a whole-repository cleanup on every task.

## Upstream Rule

Do not locally invent doc-gov core changes. Propose core changes upstream in
the Project Governance System upstream repository.

## Frontmatter syntax

Use flat scalar fields and block string lists. Empty `[]` is supported; nonempty
inline arrays, nested maps, block scalars, anchors, and duplicate keys are rejected
with a syntax diagnostic. Quote scalar text that resembles YAML syntax. CRLF and
LF line endings are accepted. This intentionally small subset is not a general
YAML parser; schema fields still follow `doc-types.md`.
