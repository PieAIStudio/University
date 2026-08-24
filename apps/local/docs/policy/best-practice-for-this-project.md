---
id: POLICY-PROJECT-BEST-PRACTICE
title: Best Practice for This Project
type: policy
status: stable
canonical: true
owner: project
created: 2026-07-20
last_reviewed: 2026-08-17
domain: project-policy
tags:
  - project-policy
  - ai-development
pinned: true
related:
  - POLICY-DOC-AGENT-RULES
  - POLICY-DOC-TYPES
supersedes: []
superseded_by: null
---

# Best Practice for This Project

UniversityLocal is personal learning infrastructure. It lets an AI host study
external repositories with the user, teach from real evidence, and keep the
learning system independent from the repositories being studied.

## Truth Hierarchy

1. Current user instruction.
2. UniversityLocal Canon and active governed requirements, once approved.
3. UniversityLocal runtime code, configuration, schemas, and lockfile for installed
   reality.
4. The inspected source repository for facts about that source project.
5. Research references and historical records for evidence, not authority.

Never let a generated lesson override current source code. A lesson may describe
an older commit, but it must say so.

## Ownership And Storage

- UniversityLocal owns curricula, lessons, exercises, review history, learner
  settings, and project-study indexes.
- A studied repository owns its code, configuration, product truth, and Git
  history. UniversityLocal reads it by path; it does not place `.learning`, `.ua`,
  cards, or study notes there by default.
- The default UniversityLocal data root is the root-level `studies/` directory,
  while both data roots and study-source roots remain configurable. Portable configuration uses
  relative paths where possible and explicit absolute paths only for local
  machine source registrations.
- Project-specific learning skills live physically under `.agents/skills/`.
  Host compatibility uses the PGS canonical links instead of copied skill trees.

## Runtime Boundaries

- TypeScript is the common language. The browser UI uses Vite, React, and React
  DOM.
- The AI host is the teacher and researcher. UniversityLocal should prepare context,
  evidence, durable state, exercises, and verification rather than hiding a
  second autonomous agent inside the app without a proven need.
- The local shell is not permanently offline. It uses the same SwimmerBackend
  account and cloud learner document as the online shell. Browser/SQLite data is
  only a cache, migration source, or offline outbox; course sources, snapshots,
  UA artifacts, and authoring notes remain local. The only runtime difference is
  the grading source: local AI host/clipboard versus the metered online adapter.
- SwimmerUIKit owns reusable Pie components and tokens; UniversityLocal owns learning
  workflows, pages, information architecture, and local visual composition.
- SwimmerAIKit is used only for real runtime model calls. SwimmerGameServerKit is
  out of scope unless authoritative multiplayer becomes a requirement.

## Local Lanes

| Lane                      | Typical work                                                      | Required evidence                                                  |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Research / curriculum     | source study, concept extraction, teaching design                 | cited source paths, commit identity, explicit fact/inference split |
| Learning data             | scheduling, review state, storage, migration                      | deterministic tests, fixtures, backward-compatibility check        |
| UI / learning experience  | review screens, questions, visual explanations                    | typecheck, component tests, real browser and screenshots           |
| Host / source integration | Grok Build/Codex/Claude routing, source registration, UA adapters | clean external-repo proof, path/config tests, host smoke test      |
| Documentation             | policy, Canon, Spec, Plan, Reference                              | `pnpm docs:check` and `git diff --check`                           |

## Verification Ladder

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm docs:check
pnpm verify
```

Do not claim browser behavior from a build alone. Do not claim memory quality
from scheduler unit tests alone; review outcomes need measured learner evidence.

## Donor-First Engineering

Reusing prior success is a required engineering gate, not an optional research
exercise.

Before a non-trivial new feature or replacement:

1. Search at least the relevant official ecosystem, mature open-source projects,
   and Pie portfolio implementations.
2. Compare license and provenance, recent maintenance, security posture,
   accessibility, data ownership, stack fit, bundle/runtime cost, and migration
   risk.
3. Prefer a maintained direct dependency when its contract fits. Otherwise adapt
   the smallest proven pattern and keep UniversityLocal's domain model as the
   source of truth.
4. Record adopted, deferred, and rejected candidates in the relevant governed
   plan, reference, or ADR. Do not invent a second portfolio donor catalog or a
   project-local donor-map format. If no donor is suitable, record the negative
   evidence before implementing local logic.
5. Re-evaluate an existing feature when evidence shows a donor is materially
   safer or better, but do not churn working code for novelty alone.

Never copy an application wholesale, import hand-written scheduling or grading
claims without validation, or treat a popular repository as proof of product fit.
