# UniversityLocal AI Router

## PGS Router Block

<!-- PGS-ROUTER:BEGIN v1.1 -->

## Boundary

- UniversityLocal is a personal AI-host-driven research and teaching system. Grok
  Build, Codex, Claude Code, and compatible coding hosts study external projects with the user; the
  resulting learning material belongs to UniversityLocal by default, not to the
  inspected project.
- PGS governs this `AGENTS.md` entry and governed Markdown under `docs/**`.
- `AGENTS.md` is the canonical project router; `CLAUDE.md` must be the exact
  relative symlink `AGENTS.md`.
- `.agents/skills/` is the canonical project skill root; `.claude/skills`
  must be the exact relative symlink `../.agents/skills`.
- Product artifacts outside `docs/**` are not governed docs unless this project explicitly opts them in.
- `README.md` is the human-facing introduction; read it only for positioning,
  public explanation, or README work.
- `docs/reference/execution/current-work.md` is the active-work index; read it
  when the task depends on current priorities or in-flight work.
- This project's adopted profile is `engineering-runtime`.
- Its selected agents routing file is `docs/governance/agents-routing/engineering-runtime-v1.1.md` under
  `docs/governance/agents-routing/`.

## Read First

1. All Markdown under `docs/policy/**/*.md`.
2. `docs/governance/boundary.md`.
3. `docs/reference/execution/current-work.md` when priorities or in-flight work
   matter.
4. `docs/governance/agents-routing/engineering-runtime-v1.1.md` for workflow
   depth.
5. Before non-trivial implementation, debugging, architecture, or integration
   work, run `pro-gov learn recall --query "<task summary>"` and read relevant
   hits.

## Documentation Tasks

When the task creates, edits, moves, deletes, or governs documentation, read
`docs/governance/boundary.md`, `docs/governance/ssot-v1.1.md`,
`docs/governance/doc-agent-rules.md`, `docs/governance/doc-types.md`, the
selected agents routing file, and all Markdown under `docs/policy/**/*.md`.
That policy set includes subdirectories and symlinked shared-rule files; keep
project AI development policy in `docs/policy/`.

<!-- PGS-ROUTER:END -->

## Upstream Rule

Do not locally invent doc-gov core changes such as new document statuses,
frontmatter schema, lifecycle rules, shared agents-routing rules, or external
shared-rule placement contracts. Propose them in the Project Governance System
upstream repository first.

## UniversityLocal Rules

- Treat external repositories as study subjects. Read-only inspection is the
  default; never write learning artifacts into them unless the user explicitly
  authorizes that target-repository change.
- Keep UniversityLocal-owned learning skills under `.agents/skills/`. Generic
  centrally managed governance or frontend skills may remain PGS-managed
  links, but project-specific teaching behavior must not be scattered across
  source projects or user-global folders.
- Keep generated lessons, exercises, review state, and imported project maps in
  UniversityLocal-owned storage under root-level `studies/` by default. Storage
  and source roots must be
  configurable; do not hard-code this checkout path into portable data.
- The AI host performs research and teaching. Do not add direct model-provider
  calls merely to imitate the host; any product runtime AI call must go through
  SwimmerAIKit and requires a concrete need.
- UniversityLocal is permanently local-only and must not depend on, integrate with,
  upload to, or prepare a sync lane for SwimmerBackend or any other application
  backend. A future commercial `University` is a separate repository and product;
  it may adopt SwimmerBackend under its own approved contract.
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
