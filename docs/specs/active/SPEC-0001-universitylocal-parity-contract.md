---
id: SPEC-0001
title: UniversityLocal Parity Contract
type: spec
status: active
canonical: true
owner: human
created: 2026-08-18
last_reviewed: 2026-09-15
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

UniversityLocal below names the `apps/local` authoring module in this repository,
not a second checkout. `apps/university` is one browser app in authoring and
delivery modes. The current public-source extension and delegated publication
review are described below; old repository lessons retain their exact snapshot
and source-evidence requirements.

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
| Where teaching intelligence comes from | The AI host examining validated repository snapshots or real public materials | Published course packages plus metered online models |
| What it produces | Course content | Learner outcomes and revenue |
| Content storage | Local files and the registered clones | Imported packages |
| Repository access from a lesson | Checkout and UA analysis are reachable locally | The same learner controls explain the published package boundary |
| Identity and learner state | Same SwimmerBackend account/document; local cache/outbox when disconnected | Same SwimmerBackend account/document; local cache/outbox when disconnected |

Once that is fixed, "the courses must be identical" stops being a synchronisation
problem and becomes a supply problem: there is exactly one producer.

Course storage is split and has to be: `apps/local` reads the thing being
written — prose, registered repositories, snapshots and public-source materials — and
the delivery build reads what was published. That asymmetry **is** the
single-producer pipeline. Identity and learner state are not split: one
account, one cloud learner document, one review schedule (ADR-0001). A local
  SQLite/browser copy may accelerate or queue learner work, but it is never a second
cross-device source of truth.

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
   import date in a tracked manifest. Approved recovery packages are tracked in
   `apps/local/course-proposals/recovery/`; generated delivery JSON is not. The
   import is reproducible from these packages, with pinned source inputs when
   repository snippets must be baked.
4. Import validates against the schema before anything is written. A package
   that fails validation is rejected loudly, not partially imported.

### Direction is one-way, and this repository owns it

University reads. UniversityLocal is never modified to push **content**.

Read the noun. This clause is about course prose, cards, exercises and
evidence, and it is absolute: the day a second thing can produce a lesson,
"the courses are identical" goes back to being a synchronisation problem and
this document stops working.

It is not a statement about the network. Content reaches customers by being
**published**, which is a gated act (ADR-0007); learner identity and progress
travel freely in both directions (ADR-0001). A new outbound call belongs on
the second lane only if it carries no lesson content.

### Publishing is a separate, deliberate gate

Imported is not published.

The original product-repository route remains supported: a package can carry
source paths, exact commits, line ranges and verbatim excerpts from a private
repository, so publication still needs an explicit intellectual-property review.

Owner expanded the teaching scope on 2026-09-14: real public records, original
reporting, research, official material, documented cases, data, images and videos
may ground a beginner lesson. They use the existing URL evidence branch with
`provenance`, not a second source database. Each citation records its publisher,
date when known, inspection date, supported claim and limitation. Repository
citations still require their real snapshot; a public-source study has no fake
repository, commit or UA analysis. Original teaching transformations are marked
as such and never described as recorded events or actual model runs. Media still
needs validated bytes, accessible descriptions and appropriate usage rights.

So the pipeline has three states, not two:

```text
imported  ->  reviewed  ->  published
```

Publication scope is an Owner decision recorded per course version. For the two
public-source AI-literacy series in this release, Owner explicitly delegated
iterative writing, independent model review, revision and publication without
intermediate approval. Keep the exact package hashes and review receipts; this
delegation does not approve unrelated private content or unlock old locked
courses. Automated validation and model review do not prove that real students
learned. The snapshot gate rejects secret-like tracked paths before analysis;
it does not decide what is commercially safe to show a stranger.

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

- content storage (the registered clones and prose on one side, imported
  packages on the other);
- model access — the coding host and the clipboard on one side, metered online
  APIs through SwimmerAIKit on the other;
- repository access — `SourceAccessPort` returns local checkout, UA and
  coverage actions on one side, and a structured explanation on the other.
  Everything above `GradingPort`, `ContentPort` / `ReaderPort`, and
  `SourceAccessPort` is shared;
- any 3D, world map, level, or motivation system.

Those differ by design, and forcing them into the kit would make the kit a
second product.

Accounts and learner state **are** the kit's: one `ProgressPort`, one
implementation over SwimmerBackend, and one cache/outbox per shell (ADR-0001).
Entitlement resolution is shared pure core configuration (ADR-0007); it does
not turn `ProgressPort` into a wallet or a course-content gate. A thing both
shells do identically is the definition of what this kit is for.

"The shared package" here means this parity kit — `packages/core` and
`packages/ui`. It does not mean "any package both shells import". The world map
is shared by both shells and lives in **`packages/world`**, a different package
with a different dependency set (ADR-0004).

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
| Host-driven research and lesson authoring | Level framing and feedback rituals |
| Study/source registration, airlock, snapshots | Online model calls, metered tutoring |
| Clipboard grading through the AI coding host | Payment, entitlement, published state |
| Recovery export | Import, review gate, delivery |

Neither side reaches into the other's column, and no item in these columns
belongs in the kit.

Learner state and the review store are not in this table: they are one shared
implementation (ADR-0001). Neither is the 3D world (ADR-0004). What remains on
the right is what the paying side genuinely owns alone — the money, and what
has been published.

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
4. Lesson prose, cards, exercises and evidence leave the authoring shell only
   as a recovery package — to disk, or to the publish lane, which is gated
   (ADR-0007). No other path exists. Its backend client's request surface is
   account, progress, review, favourites, settings and publish: a list short
   enough to read, which is why it is written out.
5. The parity check reports the upstream commit it compared against, and fails
   when the vendored schema differs from that commit.
6. Every published course has a recorded review of the exact package hash being
   served.
7. A learner completing a full lesson — read, answer, review — triggers zero
   large-model calls when every exercise in it is deterministically checkable.

## Open

These are recorded as open rather than decided, because deciding them now would
be guessing:

- The learner-facing "course catalogue" is shared by both shells through
  `packages/ui/src/catalog/CatalogSurface.tsx`; the remaining question is only
  how much authoring-source detail the local landing shelf should expose beside
  that route.
- Whether course freshness (`currency: follow-ref`, and UniversityLocal's
  freshness records against source commits) is surfaced to learners at all, or
  is purely an authoring signal.
- What happens to a learner's progress when a course is re-exported with a new
  content revision. UniversityLocal's rule — a new revision returns a lesson to
  unfinished — is correct for one self-teaching owner and probably hostile to a
  paying learner.
