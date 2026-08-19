---
id: GOV-SSOT-V1-1
title: SSOT Documentation Governance Rules v1.1
type: policy
status: stable
canonical: true
owner: human
created: 2026-07-13
last_reviewed: 2026-07-13
domain: doc-governance
tags:
  - ssot
  - doc-gov
  - boundary
  - ai-hosts
pinned: true
related:
  - REF-DOC-GOVERNANCE-BOUNDARY
supersedes: []
superseded_by: null
---

# SSOT Documentation Governance Rules v1.1

This rule defines how projects using Project Governance System handle
**SSOT (Single Source of Truth)** for governed documentation and project-level
AI-host entry and skill discovery.

Use it whenever an AI agent creates, modifies, moves, deletes, archives, or
cross-references project documents, routers, or project skill roots.

Beginner version: every important fact should have one home. Other files and
host compatibility paths may point to that home, but they must not become
competing copies.

## Governance Scope

Project Governance System governs:

- `AGENTS.md` and compatible project AI entry paths.
- `.agents/skills/` as the canonical project skill root and compatible
  project skill discovery paths.
- Governed Markdown under `docs/**`.
- Documentation governance rules, agent routing rules, templates, manifests,
  plans, specs, references, canon, and archives that live under `docs/**`.

Project Governance System does **not** automatically govern every Markdown file,
host-native runtime setting, user-level skill installation, or project asset.

Markdown outside `docs/**` can be a product artifact, source asset, prompt,
project package file, runtime note, generated media description, or local
workbench record. Do not move those files into `docs/**` just because they are
Markdown.

Extra governed roots are allowed only when a project explicitly opts in.

External and optional-tool artifacts are explicitly outside the default Doc Gov
schema:

- `CONTEXT.md` and `CONTEXT-MAP.md`
- `docs/brainstorms/**`
- `docs/pulse-reports/**`

PGS plans remain under `docs/plans/active/**` and
`docs/plans/completed/**`.

## Project AI Host SSOT

Every governed project uses these project-level truth surfaces:

| Concern | Canonical path | Compatibility contract |
| --- | --- | --- |
| Project AI router | `AGENTS.md` | `CLAUDE.md` is the exact relative symlink `AGENTS.md` |
| Project skills | `.agents/skills/` | `.claude/skills` is the exact relative symlink `../.agents/skills` |

The compatibility paths are structural contracts, not alternate content
locations:

- `CLAUDE.md` must be a symbolic link whose raw link target is exactly
  `AGENTS.md`.
- `.claude/skills` must be a symbolic link whose raw link target is exactly
  `../.agents/skills`.
- `.agents/skills/` must still exist in a clean checkout. Track managed skill
  entries or a `.gitkeep`; if the directory is otherwise ignored, explicitly
  unignore that placeholder.
- A copied file, copied directory, absolute link, differently spelled relative
  link, wrong target, or dangling link is not compliant even when it currently
  resolves to similar content.
- Check the link object and raw target with `lstat` and `readlink`; resolving
  the final path alone is insufficient.
- Host-specific runtime settings may remain in native host configuration files,
  but they must not introduce a second project router or project skill tree.

This exact-relative rule applies only to the two compatibility links above.
Individual entries under `.agents/skills/<skill>` may be directories or valid
absolute or relative symlinks. Skill managers may choose absolute per-skill
links when that is the correct installation model.

User-level skill roots are a separate configuration scope. A user may maintain
one canonical `~/.agents/skills/` tree and link a compatible host root to it,
but project governance must not hard-code a user's home directory or inspect it
as part of a portable project router contract.

## Core Behavior

- **Discover before editing**: first identify the project's actual documentation
  system and current entrypoints.
- **One truth surface**: each durable fact should have one canonical source;
  other files should summarize and link.
- **One project router and skill tree**: host compatibility paths point to the
  canonical project surfaces instead of duplicating them.
- **Runtime beats Markdown**: when runtime code/config is the real product truth,
  docs must point to it instead of duplicating it.
- **Product artifacts stay in their product package**: prompts, generated media,
  asset manifests, project-package canon, and source materials should stay in
  the project's own production/workbench structure unless the project explicitly
  makes them governed docs.
- **No parallel systems**: do not keep old and new documentation, router, or
  skill structures alive unless the project explicitly says it is in a
  migration window.
- **No AI dump folders inside governed docs**: do not create ad-hoc `Temp/`,
  `Drafts/`, `Opus/`, `Codex/`, or AI-name folders under `docs/**`.

## Discovery Order

Before changing docs, look for project-local guidance in this order:

1. `AGENTS.md`, reached directly or through a compliant compatibility link.
2. `docs/governance/boundary.md`.
3. `docs/governance/ssot-v1.1.md`.
4. `docs/governance/agents-routing/` and the project's selected agents-routing file.
5. `docs/reference/documentation-map.md`, root `README.md` for human-facing
   orientation, or another project-defined documentation index.
6. `docs/policy/`, `docs/governance/`, or equivalent project rules.
7. Any project-specific doc tooling such as `doc-gov`, `mintlify`,
   `docusaurus`, `vitepress`, or custom scripts.
8. Runtime truth locations named by the project, such as config files, schemas,
   manifests, source packages, product packages, or asset manifests.

If the project uses `doc-gov`, follow it:

```bash
pnpm doc-gov find <topic>
pnpm doc-gov check
pnpm doc-gov scan --check
```

Do not invent a second structure when doc-gov already defines one.

## Choosing The Truth Layer

Use the project's own vocabulary when available. If none exists, this fallback
works for governed docs:

| Need | Usually belongs in |
| --- | --- |
| AI entry and startup routing | `AGENTS.md`, reached through exact host compatibility links when required |
| Project skill discovery | `.agents/skills/`, reached through exact host compatibility links when required |
| Agents-routing rules | `docs/governance/agents-routing/` |
| Doc-system rules, templates, and manifest | `docs/governance/` |
| Project AI/development policy | `docs/policy/` |
| Durable decisions | `docs/adr/`, governed decision records |
| Product or feature requirement | `docs/specs/` |
| Step-by-step implementation work | `docs/plans/` |
| Reusable learning records | `docs/reference/learnings/**`, governed as `reference` documents and recalled on demand |
| Durable workspace/system truth | `docs/canon/` |
| How-to guides, architecture maps, tool notes | `docs/reference/` |
| Retired governed history | `docs/archive/` |
| Runtime ids, values, generated asset paths | code/config/manifests, not Markdown body |
| Product prompts, project-package canon, generated media notes | project package or workbench, not `docs/**` by default |

If the project has different layers, use the project layers instead of this
table.

## Editing Rules

When modifying documentation or project AI-host compatibility:

1. Find the canonical source first.
2. Decide whether the file is a governed doc, compatibility link, or product
   artifact.
3. Edit only the canonical source for the durable fact.
4. Preserve exact compatibility link targets instead of editing through a
   duplicate host-specific body.
5. Update navigation links if names or paths change.
6. Replace duplicated content with a one-line summary plus link.
7. If code/runtime behavior changed, update the runtime truth first, then align
   docs.
8. Run the project's checks before claiming completion.

## Moving Or Deleting Docs

- If the content is still useful governed history, archive it under the
  project-approved `docs/archive/**` path.
- If the content is stale, misleading, and already superseded, deletion can be
  better than hoarding.
- Do not preserve obsolete drafts just to feel safe; excessive history increases
  AI cognitive load.
- If a file is moved, update indexes, manifests, and symlinks.
- Do not move product artifacts into `docs/**` as a cleanup shortcut.
- Before replacing an incompatible skill directory, preserve any unique skills
  by moving them into the canonical `.agents/skills/` tree.

## Completion Checklist

Before reporting doc or host-compatibility work complete:

- [ ] I found the project documentation system.
- [ ] I identified whether the changed path is canonical, compatible, governed
      documentation, or a product artifact.
- [ ] I updated the canonical source, not a duplicate.
- [ ] `CLAUDE.md` and `.claude/skills` use their exact relative link targets.
- [ ] I did not rewrite valid per-skill links merely because they are absolute.
- [ ] I did not create ungoverned temp/draft/AI-name folders under `docs/**`.
- [ ] I updated links/navigation after moves or renames.
- [ ] I kept runtime data in runtime/config files, not Markdown copies.
- [ ] I kept product prompts/assets in the product package unless explicitly
      governed.
- [ ] I ran the project's validation commands when available.

## Common Mistakes

| Mistake | Better move |
| --- | --- |
| Copying the same design rule into five docs | Keep one canonical doc, link from the others. |
| Keeping a separate `CLAUDE.md` body | Link `CLAUDE.md` exactly to `AGENTS.md`. |
| Copying skills into `.claude/skills/` | Keep skills in `.agents/skills/` and link the compatible root. |
| Rewriting every absolute per-skill link | Leave valid per-skill installation links alone; the exact-relative rule is for compatibility roots. |
| Treating old migration sources as current truth | Archive or delete them after migration. |
| Letting Markdown override runtime config | Runtime/config wins; docs explain intent. |
| Moving every `.md` file into `docs/**` | Govern discussion records; keep product artifacts in their product package. |
| Creating a new folder because the current structure feels inconvenient | Use the governed structure or update governance first. |
| Keeping outdated drafts forever | Archive only useful history; delete misleading noise. |
