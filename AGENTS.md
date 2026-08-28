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
| 3D scene, renderer, colour, performance, or shells | `docs/adr/ADR-0009-the-procedural-map-is-one-pipeline.md` (where data comes from, what it may cost), `docs/adr/ADR-0008-one-locked-technique-per-island-element.md` (what technique draws it), `docs/policy/shared-rules/web3d-capability-alignment.md` and `docs/policy/shared-rules/donors.md` |
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

1. **Share the code.** One implementation of anything, ever. If one mode needs
   a behaviour the other already has, it imports it — it does not write a
   second one, and it does not copy the first.
2. **Keep the architecture efficient, clear, modular, robust, and legible to
   both a person and an AI.** When those pull against each other, legibility
   wins, because the thing nobody can read is the thing nobody can fix.

What follows from them:

- **One browser app, two modes.** `apps/university` is the whole product;
  `vite --mode authoring` writes courses on a machine and `vite --mode
  delivery` sells them. There were two apps until 2026-08-25, and the reason
  they were merged is written down: the difference set had shrunk to three
  port boundaries while the drift rate had not moved, because two files meant
  two places one decision could be made. `packages/*` is still everything
  neither mode may own twice. The delivery mode is not forbidden from authoring
  courses; when it authors, it runs the same workflows.
- **The app and the authoring server never import each other.**
  `apps/local` is the Node server that reads the disk on 4317, and nothing
  else; `apps/university/src` is bundled for a browser. Either import
  type-checks and fails at runtime, so `check-module-boundaries.mjs` is where
  that gets caught rather than remembered. They share
  `@pieai/university-core`.
- **One producer of course content, always.** Lessons are authored by the
  `apps/local` CLI and nowhere else; publishing them is a separate, gated act,
  and a customer sees a package only once it is published (ADR-0002). A second
  thing that can emit a lesson dissolves SPEC-0001.
- **Both modes hold one cloud account.** They sign in to SwimmerBackend and
  share account data, progress, review schedule, answers, reader marks,
  vocabulary, favourites, practice history and settings — one implementation
  each. The cloud document is canonical; the browser document is only an
  offline cache/outbox. The disk stays the source of truth only for what exists
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
- **Three boundary questions may be answered differently, and they all live in
  `apps/university/src/ports/`.** *Where the AI comes from*: `GradingPort` —
  the authoring mode grades through the clipboard and the machine's own AI
  host, without an API key in the product; the delivery mode grades through
  SwimmerAIKit, metered. *Where the material comes from*: `ContentPort` and
  `ReaderPort` — a loopback server reading the disk on one side, a published
  package on the other. *Whether this side can reach the repository behind a
  lesson*: `SourceAccessPort` — real checkout, project map and coverage actions
  in authoring; an explanation of the boundary and the future desktop/manual/
  mobile path in delivery. The second question was answered twice by copy
  before the 2026-08-25 merge; naming it is what let the delivery build's
  duplicate reader be deleted. Everything above these ports is one
  implementation, and a fourth question means changing this rule first — the
  directory is the complete list, so a new answer that is not a file in it is a
  defect.
- **Design before build.** A user-facing behaviour gets designed in
  `docs/reference/player-journey/` before it gets implemented. The current
  journey is `docs/reference/player-journey/v5/`; it replaces v1, v2, v3 and
  v4. V5 is an amendment: what v4 says and v5 does not contradict still
  stands.
- **The learner surface is the same in both modes.** V5 permits only the three
  port-boundary answers above: AI source, lesson material source and access to
  the repository behind a lesson. A missing learner capability still renders
  its control and opens an explanation; it is never hidden with an
  `AUTHORING ? … : null` branch. The author workbench at `#/studio` is the
  separate, explicit authoring exception. Any other divergence is a defect —
  fix it, do not debate it. Adding another boundary means changing v5 first.
- **“Local” does not mean permanently offline.** The authoring mode may keep
  authoring sources and an offline cache on disk, but every learner/account
  datum must bind to the same cloud row when an account is available and queue
  safely while disconnected. Windows, macOS and browser sessions are peers.
- **One codebase, three shells.** Browser, desktop and phone run the same
  build. The browser needs no wrapper; Electron and Capacitor are wrappers
  around that same output, not separate products. Layout differs by CSS
  breakpoint inside one component tree — never by a second component. Device
  capability goes behind a port: storage, payment, notification, grading,
  content and source access. Everything above a port is identical on all three.
  A responsive layout is not two implementations; a second implementation is.
- **The renderer lives in `packages/world`, never in `packages/ui`.** Both
  modes share one scene, and `packages/ui` stays at zero `three` so that a
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
