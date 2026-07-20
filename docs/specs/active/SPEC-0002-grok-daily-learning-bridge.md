---
id: SPEC-0002
title: Grok Daily Learning And Knowledge Bridge
type: spec
status: active
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: product
tags:
  - grok
  - knowledge-capture
  - refresh
  - local-only
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0003
  - ADR-0004
  - SPEC-0001
  - PLAN-0002
  - REF-UNIVERSITY-LOCAL-LEARNING-DONOR-MAP-2026-07-20
---

# SPEC-0002: Grok Daily Learning And Knowledge Bridge

## Problem

The foundation can display one formal course and schedule its cards, but daily
use still has two broken bridges:

1. a Grok conversation cannot reliably save a useful follow-up as reviewable
   UniversityLocal knowledge; and
2. a new local source commit can produce another snapshot and UA map, but there
   is no complete refresh audit that identifies and gates stale teaching content.

The Web UI also discards the learner's pre-reveal card answer, real learning
events are not grouped into sessions, source evidence is only a path label, and
the existing project `knowledge-node` link routes generic “save this” requests to
an Obsidian vault outside UniversityLocal.

## Product Boundary

- Grok Build is the preferred coding host. Codex and Claude Code use the same
  project skills and CLI; UniversityLocal adds no host-specific model API.
- UniversityLocal remains permanently local-only under ADR-0003. No runtime or
  speculative SwimmerBackend work is allowed.
- A local commit is sufficient source identity. A GitHub push is never required.
- Dirty working-tree changes are not evidence. Refresh stops by default instead
  of silently making the user believe they were included. After showing the exact
  dirty entries, it may continue only when the owner explicitly acknowledges that
  those changes are excluded and selects the immutable commit to study.
- External source repositories remain read-only; every write stays under the
  configured UniversityLocal study shelf.

## Information Model

The four durable responsibilities remain distinct:

```text
source/     immutable project samples
ua/         machine-generated project maps
courses/    reviewed, deliberately structured teaching routes
notes/      atomic knowledge captured from owner/AI discussion
learner/    private attempts, sessions, progress, and FSRS state
```

A course is a published textbook. A note is a page in the owner's class notebook.
Forcing each follow-up question into a course would stale and republish the
textbook on every conversation; a separate atomic note avoids that churn. Notes
and course cards still share one evidence validator, one card identity layer, one
LearningStore, and one ts-fsrs scheduler, so this is not a second review system.

## Atomic Knowledge Capture Contract

- One capture expresses one central knowledge point and writes one versioned
  Markdown note plus JSON metadata under `notes/<note-id>/`.
- Metadata includes stable ID, revision/hash, title, original question, concise
  conclusion, tags, claim type, state, host/session provenance, evidence, and
  zero to three derived basic cards.
- The default does not retain the full raw conversation. It stores the curated
  question, explanation, conclusion, and necessary provenance.
- `source-fact` and `inference` notes require valid commit-bound evidence before
  becoming active. Missing evidence produces a visible draft, never a silently
  trusted memory.
- `personal-understanding` may be active without source evidence but must remain
  visibly labelled as the owner's interpretation.
- Capture is idempotent. Retrying the same capture cannot duplicate a note, card,
  or FSRS enrollment.
- Active derived cards enter the existing LearningStore without resetting an
  existing stable card. Draft notes never enter review.
- The supported host phrase is ordinary language such as “把刚才这个知识点记下来并
  加入复习”. A project-local skill prepares a proposal and invokes the governed
  CLI; the host must not hand-edit Markdown, JSON, or SQLite truth.

## Learning Event Contract

- Card reveal appends a `retrieval_attempt` before returning the answer. It stores
  the real answer, content key/revision, start/reveal time, duration, hint use,
  optional confidence, and optional session ID.
- Retrieval attempts and FSRS review ratings are separate facts. The system does
  not infer `Hard`, `Good`, or `Easy` from speed or keywords.
- A study has at most one open learning session. Grok can start, inspect, and end
  it through the local CLI; Web actions join the open session when present.
- Card relearning uses ts-fsrs learning/relearning steps and the original card ID.
  No second queue or `-relearn` pseudo content is allowed.
- Backup, reset, and restore are explicit local CLI operations. Reset must make a
  verified backup first and require the exact study ID as confirmation.

## Source Refresh Contract

The supported sequence is:

```text
local commit
→ clean snapshot
→ isolated UA full analysis
→ deterministic freshness report
→ stale course/unit gate
→ AI-reviewed content revision
→ revalidation and activation
```

- `status` reports source root, branch, local HEAD, dirty state, latest snapshots,
  ready analyses, courses, notes, open session, and backup status.
- `refresh prepare` refuses dirty input by default. An explicit
  `--acknowledge-dirty-excluded` may proceed from the selected immutable commit,
  but the receipt must retain the dirty list and state that none of it was
  included. Prepare then creates/reuses the clean snapshot, binds the exact UA
  engine source/revision/hash, and returns the one required UA host invocation.
- Grok runs Understand Anything only against the prepared workspace with auto
  update disabled and worktree redirect disabled. Running bare `/understand` in
  the UniversityLocal root is forbidden.
- `refresh finalize` validates the full graph and records exact engine provenance.
- `refresh audit` canonicalizes UA node JSON, checks every course and note evidence
  against the target snapshot/analysis, persists a hash-bound report, and marks
  only affected active course/unit containers stale.
- Refresh never silently rewrites approved course or note content. AI and owner
  review stale reasons before a new revision becomes active.
- Re-running any stage is safe and does not modify the source repository.

## Evidence Preview Contract

- A read-only endpoint returns a bounded text snippet from the regular Git blob at
  the evidence's fixed commit, never from the live source checkout.
- It rejects binary blobs, symlinks, trees, gitlinks, paths outside the repository,
  oversized files, and excessive line ranges.
- The UI shows context and highlights the cited range. Syntax presentation should
  use maintained Shiki bundles rather than a custom highlighter.

## Host Discovery And Privacy

- `.agents/skills` remains the only project skill source. `CLAUDE.md` and
  `.claude/skills` remain compatibility links; no `.grok/` copy is created.
- A conditional Grok smoke check verifies that `AGENTS.md`, teaching/capture/
  refresh skills, and Understand Anything are discoverable.
- Documentation must distinguish Grok Build CLI from the Grok web/PWA product.
- Before sending private source context, the owner should inspect Grok Build's
  `/privacy` state. Local UniversityLocal storage does not by itself control a
  hosted model provider's retention path.

## Donor Promotion And Deferred Features

Current implementation promotes only the P0 mechanisms in the donor map: atomic
notes, durable retrieval attempts, ts-fsrs short-term scheduling, and immutable
evidence preview. Predict Output, Micro-Parsons, and Explain with Rubric are
accepted P1 designs but require three real owner sessions after this bridge works.
This prevents another disconnected PBMLS-style component collection.

Analytics, weak-point prediction, streaks, heatmaps, implicit AI memory, code
execution, cloud sync, accounts, and native shells are not part of this spec.

## Acceptance

- A Grok Build session can start, teach from SupaLuv, capture one evidence-backed
  active note plus card, record a pre-reveal answer and FSRS rating, end, restart,
  and preserve all state.
- A capture without required evidence is a draft and is absent from the due queue.
- Exact capture retries do not duplicate data; changed content requires a new
  revision.
- An unpushed local SupaLuv commit can refresh; dirty changes stop prepare with a
  beginner-readable explanation unless the owner explicitly acknowledges that
  the selected commit excludes them.
- Source/UA changes create a deterministic freshness report. Unchanged blobs and
  semantically identical UA nodes remain fresh; changed/deleted evidence becomes
  stale and gates its course/unit.
- Evidence preview returns only bounded immutable blobs and highlights the cited
  lines in the browser.
- Backup/reset/restore tests prove learner-only scope and verified recovery.
- Automated browser tests use a temporary study shelf; owner data is first backed
  up and removed from QA state.
- `grok inspect` sees the project router, UniversityLocal skills, and UA; no
  duplicate `.grok` configuration is introduced.
- Full `pnpm verify`, a real Grok smoke, browser QA, and before/after SupaLuv Git
  status all pass.
