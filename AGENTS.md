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

Two rules, and everything below them is a consequence rather than a separate
restriction. The earlier list of prohibitions was retired when this became one
repository; what survived, survived because it follows from these.

1. **Share the code.** One implementation of anything, ever. If a shell needs a
   behaviour the other shell already has, it imports it — it does not write a
   second one, and it does not copy the first.
2. **Keep the architecture efficient, clear, modular, robust, and legible to
   both a person and an AI.** When those pull against each other, legibility
   wins, because the thing nobody can read is the thing nobody can fix.

What follows from them:

- **`apps/local` authors, `apps/online` sells, `packages/*` is everything
  both of them do.** Neither app may own something the other also needs. The
  online shell is not forbidden from authoring courses; when it authors, it
  runs the same workflows the local shell runs.
- **The shells never import each other.** `apps/local` importing `apps/online`
  is the modularity rule broken, and `check-module-boundaries.mjs` is where
  that gets enforced rather than remembered.
- **One producer of course content, always.** Lessons are authored in
  `apps/local` and nowhere else; publishing them is a separate, gated act, and
  a customer sees a package only once it is published (ADR-0002). A second
  thing that can emit a lesson dissolves SPEC-0001.
- **Both shells hold an account.** They sign in to SwimmerBackend and share
  account, progress, review schedule, favourites and settings — one
  implementation each. The disk stays the source of truth for what only exists
  on disk: `apps/local/studies/` and the prose being written (ADR-0001).
- **Readable text is DOM, never geometry.** A Chinese IME, a screen reader,
  text selection and a phone keyboard all die inside a canvas, so text in
  WebGL is the legibility rule broken for a human. The canvas owns the world
  map, level entry and feedback. This is also Web3D baseline rule 7, which is
  a portfolio-wide shared rule: changing it means proposing it in PGS, not
  deciding it here.
- **Grading stays tiered by cost.** Deterministic first, structured small-model
  second, open tutoring last and metered. An unmetered large model behind a
  free tier is the robustness rule broken, in the direction of the bank.
- **`GradingPort` is the only permitted difference between the shells.**
  `apps/local` grades through the clipboard and the AI coding host it runs
  inside; `apps/online` grades through SwimmerAIKit, metered. Everything above
  the port is one implementation. Adding a second divergence means changing
  this rule first.
- **Design before build.** A user-facing behaviour gets designed in
  `docs/reference/player-journey/` before it gets implemented. The current
  journey is `docs/reference/player-journey/v4/`; it replaces v1, v2 and v3.
  V4 is an amendment: what v3 says and v4 does not contradict still stands.
- **One permitted difference between the shells: where the AI comes from.**
  V4 states this as law. Any other divergence is a defect — fix it, do not
  debate it. Adding a second difference means changing v4 first.
- **One codebase, three shells.** Browser, desktop and phone run the same
  build. The browser needs no wrapper; Electron and Capacitor are wrappers
  around that same output, not separate products. Layout differs by CSS
  breakpoint inside one component tree — never by a second component. The only
  permitted divergence is device capability, and it goes behind a port:
  storage, payment, notification, grading. Everything above a port is identical
  on all three. A responsive layout is not two implementations; a second
  implementation is.
- **The renderer lives in `packages/world`, never in `packages/ui`.** Both
  shells share one scene, and `packages/ui` stays at zero `three` so that a
  test of the lesson reader never has to stand up a WebGL mock. SPEC-0001 and
  SPEC-0003 both say this; if a reading of either suggests otherwise, that
  contradiction was settled on 2026-08-22 and the specs carry the note.

## Verification

Run the smallest relevant checks, then `pnpm verify` before claiming a complete
implementation. Browser-visible UI changes also require a real browser pass and
screenshot evidence.

## Upstream Rule

Do not locally invent doc-gov core changes such as new document statuses,
frontmatter schema, lifecycle rules, shared agents-routing rules, or external
shared-rule placement contracts. Propose them in the Project Governance System
upstream repository first.
