---
id: REF-UNIVERSITY-LOCAL-ARCHITECTURE-REFLECTION-2026-07-20
title: UniversityLocal Architecture Reflection 2026-07-20
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - architecture
  - goalcascade
  - learning-loop
  - simplification
pinned: false
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0001
  - ADR-0002
  - SPEC-0001
  - PLAN-0001
---

# UniversityLocal Architecture Reflection 2026-07-20

> Boundary update: ADR-0003 supersedes this first-proof reference wherever it
> described cloud sync as a possible UniversityLocal future. UniversityLocal is
> permanently local-only; a commercial `University` is a separate repository.

## 0. Frame

- Product: UniversityLocal, the owner's personal AI-host-driven learning system.
- Time window: the next 30 days and the first SupaLuv proof.
- Mission source: `CANON-UNIVERSITY-LOCAL-MISSION`.
- Evidence: current runtime, 725 MB SupaLuv study container, PBMLS/PBMLS-old,
  installed Understand Anything 2.9.4, and three independent architecture audits.
- Assumption: this phase serves one owner on one local machine. It does not prepare
  a consumer University product in the same repository.

## 1. GoalCascade

### Layer 1 · Mission

UniversityLocal exists to help the owner understand and remember real projects
without writing study artifacts back into those projects.

Constraint: reject any design that weakens source isolation, evidence identity,
or learner-data durability merely to make a demo look complete.

### Layer 2 · Product Role

Its current role is personal learning infrastructure, not a SaaS product,
showcase, content marketplace, or autonomous AI application.

Constraint: reject accounts, billing, multi-tenancy, hosted agents, and production
cloud dependencies in the first proof.

### Layer 3 · Phase Goal

The phase proves one real path:

```text
SupaLuv course
→ one evidence-backed lesson
→ answer before reveal
→ one exercise attempt
→ three to five cards
→ FSRS schedules the next review
→ restart preserves the result
```

Constraint: no new page family or infrastructure lane may precede this path.

### Layer 4 · Target And Non-target

- Target: the owner, learning as a beginner with Grok Build, Codex, or Claude Code as teacher.
- Non-target: ordinary consumers, teachers managing classes, teams, mobile-only
  learners, and course publishers.

Constraint: optimize for a direct personal session, not general administration.

### Layer 5 · Win Logic

UniversityLocal wins against ordinary AI chat by combining commit-bound evidence,
a deliberate course, forced retrieval, and durable spaced repetition. Understand
Anything supplies a map; it does not replace the course.

Constraint: do not compete on graph spectacle, number of question types, social
features, or dashboards before the learning loop works.

### Layer 6 · Economy And Transparency

There is no commercial charging boundary in this phase. The relevant variable
cost is owner time, AI-host context, and local storage.

Constraint: prefer compact, inspectable data and one useful learning action over
background AI calls or duplicated source checkouts.

### Layer 7 · Principles And No-go Zones

Principles:

1. Durable truth is small; reproducible workspaces are temporary.
2. One course is physically readable in one course folder.
3. Source evidence is read from immutable Git objects, never a writable checkout.
4. External linked repositories are explicit study subjects, not silently followed
   dependencies.
5. The UI starts with today's real learning action.

No-go zones:

- permanent snapshot or analysis worktrees;
- full-ref Git mirrors that capture unrelated Codex checkpoint refs;
- following external symlinks as if their content were pinned by the source commit;
- an unimplemented dirty-snapshot or cloud-sync contract;
- architecture explanation screens presented as completed learning features.

### Layer 8 · Success And Stop Conditions

Success requires one browser-completed SupaLuv lesson, exercise, and FSRS review;
state must survive restart, evidence must remain traceable, and SupaLuv Git status
must remain unchanged.

Stop adding features if a learning session still requires manual JSON/SQLite edits,
if a static architecture page blocks the next learning action, or if three real
sessions do not produce repeat use. More architecture cannot substitute for those
three sessions.

## 2. Audit Findings

- The study container used about 725 MB before producing its first lesson.
- About 463 MB came from two permanent snapshot checkouts and one UA workspace.
- The 257 MB `git clone --mirror` copied nine `refs/codex/turn-diffs/**` refs that
  were not part of the requested clean snapshot boundary.
- Eleven tracked relative links became broken in the deep worktree. Other tracked
  links could lead evidence reads into PGS, HQ, or OneDrive content that was not
  fixed by the SupaLuv commit.
- Evidence validation read ordinary writable files instead of Git objects.
- The pre-simplification UI explained the architecture but could not complete a
  learning action. The resolved vertical slice now starts from Today and connects
  lesson, exercise, card reveal, FSRS rating, and restart persistence.
- PBMLS-old recorded the same failure mode: components existed, but the review
  path was not connected; it explicitly deprioritized knowledge-graph visuals.

## 3. Keep, Merge, Defer, Remove

| Decision | Scope |
| --- | --- |
| Keep | study containers, clean commits, UA raw data, evidence, stable content IDs, SQLite, ts-fsrs, SwimmerUIKit |
| Merge | `track` into `course`; curriculum/material/practice folders into each course; five top-level UI regions into Today and Studies |
| Defer | graph visualization, extra question types, Web study registration, exports, weak-point analytics |
| Remove from v1 | dirty snapshots, permanent checkouts, uncontracted sync outbox, multiplayer/game-server assumptions |

## 4. Allowed Fix Scope

- Safe now: storage/evidence hardening, course colocation, FSRS idempotency and
  version gates, real local API/UI learning flow, documentation truth repair.
- Needs later owner/product evidence: reminders, analytics, and additional
  question types. Consumer `University`, cloud access, and sync belong to a
  separate repository and product decision.
- Forbidden: connecting or preparing SwimmerBackend for UniversityLocal.

There are no unresolved owner-taste decisions blocking the first proof.
