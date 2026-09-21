# University Course-Authoring Module

This directory is the course-authoring module inside the University repository,
not a second product or checkout. Resolve the repository root with Git; read
that root's AGENTS.md and docs/policy/best-practice-for-this-project.md first.
Paths below are relative to this module unless explicitly linked to the root.
The local documentation/skill entry preserves course-authoring knowledge; it
does not override the root's product, shared-code, cloud-data or mode boundaries.

## PGS Router Block

<!-- PGS-ROUTER:BEGIN v1.1 -->

## Boundary

- This is University's Node course-authoring server and CLI. AI hosts study
  external projects with the user; learning material belongs to University's
  authoring storage, never to the inspected project by default. The historical
  UniversityLocal name still identifies retained CLI and teaching contracts.
- PGS governs this `AGENTS.md` entry and governed Markdown under `docs/**`.
- `AGENTS.md` is the canonical project router; `CLAUDE.md` must be the exact
  relative symlink `AGENTS.md`.
- `.agents/skills/` is the canonical project skill root; `.claude/skills`
  must be the exact relative symlink `../.agents/skills`.
- Product artifacts outside `docs/**` are not governed docs unless this project explicitly opts them in.
- `README.md` is the human-facing introduction; read it only for positioning,
  public explanation, or README work.
- The active-work index is the **repository-root** file
  `docs/reference/execution/current-work.md` (that path is repository-relative,
  not module-relative — it is the exception to the rule above). Read it when the
  task depends on current priorities or in-flight work. This module's own
  `docs/reference/execution/current-work.md` is a pointer to that root file and
  keeps the historical bounded-focus record; it is not a second live index.
- This project's adopted profile is `engineering-runtime`.
- Its selected agents routing file is `docs/governance/agents-routing/engineering-runtime-v1.1.md` under
  `docs/governance/agents-routing/`.

## Startup Reading

Every task starts with this router and
`docs/policy/best-practice-for-this-project.md`. The policy tree is an index,
not a startup glob; load only the lane that the task actually touches.
The discovery surface is `docs/policy/**/*.md`, including subdirectories and
any symlinked shared-rule files; this module now links the current shared PGS
rules rather than retaining independent old snapshots. This describes what can be discovered, not a requirement
to read the whole tree.

| Task surface                                            | Read additionally                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current priorities or in-flight work                    | **repository-root** `docs/reference/execution/current-work.md` (`id: REF-CURRENT-WORK`); this module's own copy is a pointer, not a second index                                                        |
| Documentation, governance, router, or governed Markdown | `docs/governance/boundary.md`, `docs/governance/ssot-v1.1.md`, `docs/governance/doc-agent-rules.md`, `docs/governance/doc-types.md`, and `docs/governance/agents-routing/engineering-runtime-v1.1.md` |
| UI, shared components, tokens, or brand behavior        | `docs/policy/shared-rules/brand-kit-first.md`                                                                                                                                                         |

Before non-trivial implementation, debugging, architecture, or integration
work, run `pnpm pro-gov learn recall --query "<task summary>"` and read relevant
hits. Do not load unrelated policy or historical work by default.

## Skill Availability

This module's `.pro-gov/assets.json` and `.pro-gov/assets.lock.json` record its
shared-rule adoption. Generic skills are selected at the University repository
root, not reinstalled here; user tools remain user-owned. These records
do not prove that an optional skill is installed, host-discoverable,
loaded, or invoked. Use a skill only when its SKILL.md actually exists and
can be read. Project-owned teaching skills are portable files; centrally
managed generic skill links may need the PGS control plane to materialize them
after a fresh clone.

## Documentation Tasks

When the task creates, edits, moves, deletes, or governs documentation, read
the documentation lane above before changing files. Keep project AI
development policy in `docs/policy/`; a documentation task does not make every
unrelated policy lane mandatory.

<!-- PGS-ROUTER:END -->

## Portfolio Laws

- Brand kits first: follow the root shared rules. Browser UI belongs to the
  repository-root apps/university and shared learner DOM to packages/ui, not
  this Node server. Use the existing backend/AI ports; do not fork shared kits.

## Upstream Rule

Do not locally invent doc-gov core changes such as new document statuses,
frontmatter schema, lifecycle rules, shared agents-routing rules, or external
shared-rule placement contracts. Propose them in the Project Governance System
upstream repository first.

## Course-Authoring Rules

- Treat external repositories as study subjects. Read-only inspection is the
  default; never write learning artifacts into them unless the user explicitly
  authorizes that target-repository change.
- Keep UniversityLocal-owned learning skills under `.agents/skills/`. Generic
  centrally managed governance or frontend skills may remain PGS-managed
  links, but project-specific teaching behavior must not be scattered across
  source projects or user-global folders.
- Keep generated lessons, exercises, and imported project maps in
  UniversityLocal-owned storage under root-level `studies/` by default. Storage
  and source roots must be configurable; do not hard-code this checkout path
  into portable data. Learner/account data is different: the shared cloud
  document is canonical, while SQLite/browser storage is only an offline cache,
  migration source, or outbox.
- The AI host performs research and teaching. The authoring mode's AI comes
  from that host/clipboard path; it must not require a product API key. Do not
  add direct model-provider calls merely to imitate the host. Online model calls
  go through SwimmerAIKit and the shared grading boundary.
- The authoring mode is not permanently offline. Both modes use the same
  SwimmerBackend account and learner-data sync lane. The root router defines
  the permitted AI-source, content-source and source-access port boundaries;
  this module does not define a different set. Never import browser app code
  into the server or server code into the app; share domain code through core.
- Canonical recovery packages under `course-proposals/recovery/` are read by
  University's existing content-import pipeline. Preserve that pull boundary:
  this module creates lesson revisions but does not independently upload or
  publish them. Publication remains a separate gated act in the root product
  contract; do not add a second content producer or duplicate sync client.
- Before implementing or replacing a non-trivial capability, inspect mature
  open-source and portfolio donors first. Record license, maintenance, security,
  accessibility, data-boundary, and stack fit; directly reuse a maintained dependency
  when it fits, adapt a proven pattern when it does not, and document evidence when
  no suitable donor exists. Never transplant a donor wholesale.
- Reuse SwimmerUIKit for shared components, APIs, and design tokens. Keep
  UniversityLocal-specific page composition and local theme decisions here.
- SwimmerGameServerKit is not a default dependency. Add it only if UniversityLocal
  gains a real authoritative multiplayer requirement; quizzes and local review
  do not justify a game server.

## Verification

Run the smallest relevant checks, then `pnpm verify` before claiming a complete
implementation. Browser-visible UI changes also require a real browser pass and
screenshot evidence.
