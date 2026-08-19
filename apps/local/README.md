# UniversityLocal

UniversityLocal is Pie's personal AI-host-driven research and teaching system.

Open this repository with Grok Build, Codex, Claude Code, or another compatible coding host,
choose an external project to study, and learn through evidence from the real
codebase. UniversityLocal keeps the curriculum, explanations, exercises, review
history, and visual learning experience on the "campus" rather than leaving
study debris inside the "factory" being studied.

The intended system combines:

- AI-host research and teaching, similar in operating spirit to AnvilLocal;
- configurable read-only study roots for external repositories;
- UniversityLocal-owned learning skills and durable learning data under the
  root-level `studies/` shelf by default;
- Understand Anything as the project-map engine, adapted so its output
  is stored outside the inspected repository;
- a first-party Web review and exercise UI using Pie's shared technology and
  brand system;
- evidence-based retrieval practice and spaced repetition.

UniversityLocal is personal teaching infrastructure with portfolio importance
alongside HQ and Project Governance System. In PGS it is correctly registered as a
governed target: that describes the governance relationship, not its strategic
importance. It is not a consumer AI product line and is not a reason to modify the
projects it studies.

The future consumer product, if built, will live in a separate `University`
repository. UniversityLocal permanently remains local-only: it does not connect
to SwimmerBackend or another application backend. It is the personal AI-host
edition and the proving ground for reusable learning contracts.

## Current Status

The repository now contains the PGS governance foundation, a commit-bound study
store, full Understand Anything isolation, versioned courses and conversation
notes, immutable evidence, SQLite + FSRS learner state, Grok-compatible local
skills, and the Today / Studies Web learning loop. SupaLuv is the first registered
study and proof source. Personal progress is local data, not a repository status
claim.

## Learning Data

The default private shelf is visible at `studies/`, following AnvilLocal's
root-level private book-shelf model. Each subject has one container:

```text
studies/<study-id>/
  source/    # registered source and commit-bound Git objects
  ua/        # UA maps and native tours
  courses/   # UniversityLocal lessons, exercises, and cards
  notes/     # atomic knowledge captured from owner/AI discussion
  learner/   # SQLite progress, review history, and local backups
```

Set `studiesRoot` in `university-local.config.local.json` when the shelf should
live elsewhere. Start from `university-local.config.local.example.json`; the
configured root keeps the same `<study-id>/...` structure. Personal study data
is ignored by this repository, uses explicit local backups, and is never uploaded
by UniversityLocal.

## Commands

```bash
pnpm install
pnpm university -- status --study supaluv
pnpm dev
```

For the simplest AI-host workflow, open this directory with Grok Build and ask
`teach-from-study` to continue SupaLuv. Ask `knowledge-node` to preserve one useful
conversation insight, or `refresh-study` after the studied project has a new local
commit. A GitHub push is never required.

The lower-level bootstrap commands remain available for diagnosis and first-time
study setup:

```bash
pnpm bootstrap:supaluv
pnpm prepare:supaluv:ua
pnpm finalize:supaluv:ua [analysis-id]
pnpm create:supaluv:course
pnpm verify
```

`prepare:supaluv:ua` prints an isolated workspace and analysis ID. The finalizer
refuses incomplete, mismatched, or non-full UA output. Neither the analysis nor
the generated course writes learning files into SupaLuv.

AI startup guidance lives in `AGENTS.md`. The beginner workflow, privacy model,
commit-versus-push explanation, and common mistakes are documented in
`docs/reference/using-university-local-with-grok.md`.
