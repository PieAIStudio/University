# University AI Router

## PGS Router Block

<!-- PGS-ROUTER:BEGIN v1.1 -->

## Boundary

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

## Policy Discovery

All Markdown under `docs/policy/**/*.md`, including subdirectories and any
symlinked shared-rule files, belongs to the discoverable policy index. This is
not a command to load every policy at startup. Read the project-local baseline
and only the shared rules whose task surface actually matches.

## Skill Availability

An asset manifest or lock records desired state; it does not prove that an
optional skill is installed, host-discoverable, loaded, or invoked. Use a skill
only when its SKILL.md actually exists and can be read. Centrally managed
project links may need the portfolio control plane to materialize them after a
fresh clone; their absence must not hide or replace the portable policy rules.

## Documentation Tasks

When the task creates, edits, moves, deletes, or governs documentation, read
`docs/governance/boundary.md`, `docs/governance/ssot-v1.1.md`,
`docs/governance/doc-agent-rules.md`, `docs/governance/doc-types.md`, the
selected agents routing file, and the policy files that govern the changed
surface. Keep project AI development policy in `docs/policy/`.

<!-- PGS-ROUTER:END -->

## Startup Reading

Every task starts with this router and
`docs/policy/best-practice-for-this-project.md`. The policy tree is an index,
not a startup glob; load only the lane the task actually touches.

| Task surface | Read additionally |
| --- | --- |
| Anything that changes what the learner sees or feels | `docs/reference/player-journey/` (current version) |
| Course content, lesson shape, cards, exercises, or importing from UniversityLocal | `docs/specs/active/SPEC-0001-universitylocal-parity-contract.md` |
| 3D scene, renderer, colour, performance, or shells | `docs/policy/shared-rules/web3d-capability-alignment.md` and `docs/policy/shared-rules/donors.md` |
| UI, shared components, tokens, brand behaviour, account, payment | `docs/policy/shared-rules/brand-kit-first.md` |
| Model calls, grading, tutoring, cost | `docs/policy/shared-rules/ai-in-the-loop.md` and SPEC-0001 §Cost |
| Current priorities or in-flight work | `docs/reference/execution/current-work.md` |

Before non-trivial implementation, debugging, architecture, or integration
work, run `pnpm pro-gov learn recall --query "<task summary>"` and read
relevant hits.

## Portfolio Laws

- Brand kits first: `docs/policy/shared-rules/brand-kit-first.md`. 2D UI,
  account, wallet and payment come from SwimmerUIKit and SwimmerBackend. All
  model calls go through SwimmerAIKit. Colour pipeline comes from
  SwimmerRenderKit. If a kit cannot do the job, change the kit and release a
  version; do not fork it here.
- Donors: `docs/policy/shared-rules/donors.md`. Read this project's row before
  any 3D, audio, or asset-pipeline work. A donor published on npm is a
  dependency, not a transplant.
- Web3D capability baseline: this project is registered `web3d-default`. The
  eight outcome rules apply from the first `<Canvas>`, not later.

## University Rules

- **University does not author courses. UniversityLocal does.** This repository
  consumes `university-local-course-recovery` packages. It never generates
  lesson prose, cards, or exercises from a source repository, and it never
  edits an imported package in place.
- **The pull direction is one-way and this side owns it.** University reads
  UniversityLocal's exports. UniversityLocal must never gain an upload lane, a
  sync client, or any awareness that this product exists — that is a standing
  constraint on that repository, and breaking it is not a University decision
  to make.
- **Do not copy code out of UniversityLocal.** Shared learning logic belongs in
  a shared package under the parity contract. A copy-paste that "works for now"
  is exactly the drift SPEC-0001 exists to prevent.
- **2D is where learning happens; 3D is where motivation happens.** Lesson
  prose, code blocks, answer input, review cards, settings, account and payment
  are React DOM. The canvas owns the world map, level entry, and feedback.
  Never rebuild readable text or text input as objects inside WebGL.
- **Grading is tiered by cost.** Deterministic checks first, structured small-
  model checks second, open-ended tutoring last and metered. A free tier must
  not expose an unmetered large-model conversation.
- **Design before build.** A user-facing behaviour gets designed in
  `docs/reference/player-journey/` before it gets implemented.

## Verification

Run the smallest relevant checks, then `pnpm verify` before claiming a complete
implementation. Browser-visible UI changes also require a real browser pass and
screenshot evidence.

## Upstream Rule

Do not locally invent doc-gov core changes such as new document statuses,
frontmatter schema, lifecycle rules, shared agents-routing rules, or external
shared-rule placement contracts. Propose them in the Project Governance System
upstream repository first.
