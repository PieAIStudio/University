---
id: SPEC-0001
title: UniversityLocal Parity Contract
type: spec
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-08-18
domain: content-pipeline
tags:
  - parity
  - university-local
  - course-content
  - shared-package
pinned: true
related: []
---

# SPEC-0001: UniversityLocal Parity Contract

## Problem

University must ship the same courses and the same learning features as
UniversityLocal, and must keep shipping them after UniversityLocal changes.

The obvious way to do that is to copy. It does not work. Two repositories that
each implement "the same" reader drift within weeks, and nobody notices until a
learner reports that a feature exists on one side only. The drift is silent
because nothing in either repository is responsible for noticing.

Beginner version: two branches of a restaurant that promise the same dish, each
with its own chef cooking from memory. They will not stay the same. The fix is
not a better memo to the chefs. It is one central kitchen that sends both
branches the same prepared components.

This spec names the central kitchen, and names precisely what each branch is
still allowed to cook alone.

## The relationship

UniversityLocal and University are not two versions of one app. They are two
halves of one pipeline.

| | UniversityLocal | University |
| --- | --- | --- |
| Role | Authoring studio | Delivery product |
| Who uses it | One person, locally | Paying learners, on the web |
| Where teaching intelligence comes from | The AI coding host reading a real repository | Published course packages plus metered online models |
| What it produces | Course content | Learner outcomes and revenue |
| Storage | Local files and SQLite | SwimmerBackend |

Once that is fixed, "the courses must be identical" stops being a synchronisation
problem and becomes a supply problem: there is exactly one producer.

## Layer 1 — Course content

**Contract: `university-local-course-recovery`.**

UniversityLocal already emits this format. It is a single self-contained JSON
document per course, content-addressed by hash, holding the full tree —
`course → units → lessons → { content, sections, variant, evidence, cards,
exercises }` — and deliberately excluding learner state, review history, and
snapshot/UA runtime data. Current exports live under UniversityLocal's
`course-proposals/recovery/<study>/`, with an `index.json` per study.

This is the content contract. University does not invent a second course
format, and does not define its own lesson schema.

Requirements:

1. University imports recovery packages. It never generates lesson prose,
   cards, exercises, or evidence from a source repository.
2. An imported package is immutable in this repository. Fixes to content are
   made in UniversityLocal and re-exported. A correction applied only on the
   delivery side is the drift this spec exists to prevent.
3. Every import records the package hash, the study id, the course id, and the
   import date in a tracked manifest. The package bytes themselves are not
   tracked; the import is reproducible from the manifest.
4. Import validates against the schema before anything is written. A package
   that fails validation is rejected loudly, not partially imported.

### Direction is one-way, and this repository owns it

University reads. UniversityLocal is never modified to push.

That is not a preference. UniversityLocal's own router states that it is
permanently local-only and must not depend on, integrate with, upload to, or
prepare a sync lane for any application backend. Adding an uploader there to
serve University would break that constraint, and it is not University's
constraint to break.

Concretely: the pull is a University command that reads a configured local path
to a UniversityLocal checkout. If that path is absent — a fresh clone, or CI —
the command reports "no upstream configured" and exits cleanly. It never fails
the build for being unable to see a sibling checkout.

### Publishing is a separate, deliberate gate

Imported is not published.

The portfolio's current decision is that University sells courses built from
real PieAI product repositories, and treats "you are reading the source of a
shipping commercial product" as the differentiator. That decision makes every
imported package IP-bearing: it carries source paths, exact commits, line
ranges, and verbatim code excerpts from private repositories.

So the pipeline has three states, not two:

```text
imported  ->  reviewed  ->  published
```

`reviewed` is a human decision recorded per course. UniversityLocal's snapshot
gate already rejects secret-like tracked paths before analysis, which stops
credentials; it does not decide what is commercially safe to show a stranger.
That judgement belongs here, and it is made once per course version, not once
per product.

No course reaches a learner without a recorded review of the exact package hash
being served.

## Layer 2 — Learning engine

**Contract: a shared package, `@pieai/university-kit`.**

Content parity alone does not deliver feature parity. "Select a paragraph and
have it read aloud" is not content; it is reader behaviour. Implemented twice,
it will behave differently twice.

The shared package owns what is genuinely the same on both sides:

- the course/unit/lesson/card/exercise schema and its validators;
- pure scheduling logic — spaced repetition intervals, due selection, lesson
  progress, completion rules keyed to content revision;
- reader primitives — the Markdown pipeline, selection and quote anchoring,
  lesson marks, and the deterministic parts of exercise checking.

The shared package must **not** own:

- storage (local files and SQLite on one side, SwimmerBackend on the other);
- model access (the coding host on one side, metered online APIs on the other);
- any 3D, world map, level, or motivation system;
- accounts, payment, or entitlement.

Those differ by design, and forcing them into the kit would make the kit a
second product.

"The shared package" here means this parity kit — `packages/core` and
`packages/ui`. It does not mean "any package both shells import". The world
map is shared by both shells and lives in **`packages/world`**, which is a
different package with a different dependency set; SPEC-0003 names it and
explains why. A reader who takes the line above to forbid sharing a scene at
all will rediscover a contradiction that was settled on 2026-08-22: the rule
is that the kit which carries lessons must not also carry a renderer, not that
two shells may never look at the same world.

Beginner version: the kit is the recipe and the prepared sauce. Where you store
the ingredients, who cooks, and what the dining room looks like stay local.

### Extraction is scheduled, not immediate

The kit is extracted from UniversityLocal, not written fresh, and it is
extracted at the first moment a real feature has to cross — not before. Guessing
an interface for a consumer that does not exist yet produces a kit that fits
neither side.

Until extraction, University vendors the shared schema with a recorded upstream
commit and file hashes in a tracked parity lock, and a local command compares
the lock against the configured UniversityLocal checkout. CI validates only that
the lock is internally consistent, because CI has no sibling checkout. The point
is not to prevent divergence during this window; it is to make divergence
visible the day it happens instead of the quarter it is discovered.

## Layer 3 — What each side owns alone

| Owned by UniversityLocal | Owned by University |
| --- | --- |
| Host-driven research and lesson authoring | 3D world map, level framing, feedback rituals |
| Study/source registration, airlock, snapshots | Online model calls, metered tutoring |
| Local learner state and local review store | Accounts, entitlement, payment, published state |
| Recovery export | Import, review gate, delivery |

Neither side reaches into the other's column, and no item in these columns
belongs in the kit.

## Cost

University's grading runs in three tiers, cheapest first. This is a hard
requirement, not an optimisation: an AI learning product whose free tier exposes
an unmetered large-model conversation has variable cost that scales with
engagement and no ceiling.

1. **Deterministic.** Recovery packages carry `expectedAnswer` on short-answer
   exercises and structured card fronts/backs. These are checked in code, at
   zero marginal cost, and they are the majority of learner interactions.
2. **Structured small model.** Free-form answers that need semantic tolerance go
   to a small model with a constrained output schema, through SwimmerAIKit.
3. **Open tutoring.** Conversational explanation is the paid surface and is
   metered per account.

All model access goes through `@pieai/swimmer-ai-kit`. Provider SDKs and
gateway calls must not appear in product code — this repeats Web3D capability
baseline rule 6, and it is repeated here because the cost tiers are the reason
it matters commercially, not only architecturally.

## Acceptance

This contract is satisfied when all of the following are true and demonstrated
by a command, not by reading code:

1. A course visible to a learner in University can be traced to one recovery
   package hash, and that hash exists in UniversityLocal's export directory.
2. Deleting University's imported content and re-running the import from the
   same manifest reproduces byte-identical content.
3. No file in University generates lesson prose, cards, exercises, or evidence.
4. UniversityLocal contains no code that references University, no uploader,
   and no backend client.
5. The parity check reports the upstream commit it compared against, and fails
   when the vendored schema differs from that commit.
6. Every published course has a recorded review of the exact package hash being
   served.
7. A learner completing a full lesson — read, answer, review — triggers zero
   large-model calls when every exercise in it is deterministically checkable.

## Open

These are recorded as open rather than decided, because deciding them now would
be guessing:

- Which side owns the "course catalogue" concept — the shelf a learner browses —
  given that UniversityLocal's studies are organised around source repositories
  and a storefront is not.
- Whether course freshness (`currency: follow-ref`, and UniversityLocal's
  freshness records against source commits) is surfaced to learners at all, or
  is purely an authoring signal.
- What happens to a learner's progress when a course is re-exported with a new
  content revision. UniversityLocal's rule — a new revision returns a lesson to
  unfinished — is correct for one self-teaching owner and probably hostile to a
  paying learner.
