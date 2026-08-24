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

## Startup Reading

Every task starts with this router and
`docs/policy/best-practice-for-this-project.md`. The policy tree is an index,
not a startup glob; load only the lane that the task actually touches.
The discovery surface is `docs/policy/**/*.md`, including subdirectories and
any symlinked shared-rule files; current PGS-managed shared rules are portable
snapshots. This sentence describes what can be discovered, not a requirement
to read the whole tree.

| Task surface                                            | Read additionally                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current priorities or in-flight work                    | `docs/reference/execution/current-work.md`                                                                                                                                                            |
| Documentation, governance, router, or governed Markdown | `docs/governance/boundary.md`, `docs/governance/ssot-v1.1.md`, `docs/governance/doc-agent-rules.md`, `docs/governance/doc-types.md`, and `docs/governance/agents-routing/engineering-runtime-v1.1.md` |
| UI, shared components, tokens, or brand behavior        | `docs/policy/shared-rules/brand-kit-first.md`                                                                                                                                                         |

Before non-trivial implementation, debugging, architecture, or integration
work, run `pnpm pro-gov learn recall --query "<task summary>"` and read relevant
hits. Do not load unrelated policy or historical work by default.

## Skill Availability

`.pro-gov/assets.json` and `.pro-gov/assets.lock.json` record desired assets;
they do not prove that an optional skill is installed, host-discoverable,
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

- Brand kits first: `docs/policy/shared-rules/brand-kit-first.md`. Prefer
  SwimmerUIKit when this teaching UI actually needs brand components. Skip
  game-server and backend kits unless a real product surface appears. If a
  needed kit cannot do the job, change the kit rather than forking it here.

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
- Keep generated lessons, exercises, and imported project maps in
  UniversityLocal-owned storage under root-level `studies/` by default. Storage
  and source roots must be configurable; do not hard-code this checkout path
  into portable data. Learner/account data is different: the shared cloud
  document is canonical, while SQLite/browser storage is only an offline cache,
  migration source, or outbox.
- The AI host performs research and teaching. The local shell's AI always comes
  from that host/clipboard path; it must not require a product API key. Do not
  add direct model-provider calls merely to imitate the host. Online model calls
  go through SwimmerAIKit and the shared grading boundary.
- UniversityLocal is not a permanently-offline product. It uses the same
  SwimmerBackend account and learner-data sync lane as the online shell. Its
  only permitted runtime difference is the source of AI grading; course source
  and authoring work remain local by design.
- Canonical course recovery packages under `course-proposals/recovery/` are this
  project's only outward content surface, and they are a **pull** surface. The
  consuming product reads them; UniversityLocal never gains an uploader, a sync
  client, a publish command, or any awareness that a consumer exists. A request
  to "just push the courses over" is a request to break the rule above, and the
  correct answer is to change the consumer instead. `University` registered
  that direction as its own constraint on 2026-08-18.
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
