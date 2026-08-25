---
id: SPEC-0004
title: Structured Entries
type: spec
status: active
canonical: true
owner: human
created: 2026-08-21
last_reviewed: 2026-08-21
domain: learning-surface
tags:
  - vibehub
  - term-dictionary
  - sections
  - registry
pinned: false
related:
  - SPEC-0002
---

# SPEC-0004: Structured Entries

## Problem

SPEC-0002 lists 53 VibeHub modules still to build. Building 53 components is
the outcome the owner explicitly asked to avoid: *「我不希望新加这个功能导致又是
打补丁的方式」*. The fear is correct, and the same fear was correct last time —
the `[[term:]]` work removed 217 lines while adding a feature, because it
replaced a second parser for one syntax instead of adding a third.

So before building anything, count what the 53 actually are.

## They Are Not 53 Things

Read the ledger's C and F groups next to each other and the same shapes appear
twice under different names.

**Sections of an entry** — C5 colloquial lead, C6 one-line definition, C7
prerequisites, C8 aliases, C13 anatomy, C14 variants, C15 scenes, C16 use/don't,
C17 distinctions, C18 plain explanation, C20 tell-your-agent, C21 what-next,
C24's five design-style blocks, and on the anti-pattern side F5 before/after,
F6 cause, F7 fix, F8 when-it-doesn't-count, F9 common forms, F10 tell-your-agent,
F11 recommended skill, F12 related terms.

That is roughly 24 modules, and **F10 is C20**. Literally the same section: a
paragraph you can paste to an agent. F12 and C21 are the same edge with
different labels. Built as separate components, this product would ship two
implementations of one thing on day one.

**Page chrome** — C1 breadcrumb, C2 favourite, C3 copy-as-Markdown, C4
pronunciation, C23 prev/next, and F4, which is the same detail page with a
different collection behind it. Six modules, one shell.

**Index surfaces** — B1 chips, B2 sidebar, B3 cards, and F1, which is the term
index pointed at anti-patterns. A2, B5 and B6 are already built and already
collection-generic in shape.

What is genuinely 53 separate builds is much smaller: the **interactive demos**
(C9 header demo, C10 step-by-step diagram, C11 state-switch demo, C12
click-the-region quiz, B3 card miniatures, F3 anti-pattern renders). Those are
real work each, and they are the reason VibeHub is convincing.

## The Design

**One collection system. An entry is a head plus an ordered list of typed
sections. A section type is a registered renderer.**

This is not a new pattern in this repository. It is the pattern already used
for evidence, recorded in the standing constraints: *evidence is read as an
opaque typed anchor rendered by a registered renderer, and adding a second kind
is a new renderer rather than a schema migration.* Sections are that, applied
to entry bodies.

```
Collection   terms | anti-patterns | (more later)
  Entry      head + Section[]
    Section  { type, payload }  ->  registry[type] = { schema, render, toMarkdown }
```

### The head is the lexicon entry we already have

A term's head is **not a new record**. It is the existing
`apps/university/src/content/lexicon.json` entry — 267 of them, already carrying
`senseId`, `headword`, `phonetic`, `partOfSpeech`, `gloss`, `usage`. Sections
are optional and additive.

This is the load-bearing decision. It means:

- `[[term:senseId]]` in prose, the `ReferencePanel` preview, the term index,
  the search, and the full entry page are **one data source**. The panel shows
  the head; the page shows head plus sections. There is no second store, no
  second parser, and no sync problem, which is exactly the patchwork the owner
  was worried about.
- An entry with zero sections is valid and renders as what we have today. All
  267 keep working on the day the registry lands.

### Why `toMarkdown` lives on the renderer

C3, copy-as-Markdown, is the module that decides whether this design is right.
Written as a standalone feature it is one function that must know about every
section type, and it breaks silently every time someone adds one — the page
grows a block, the clipboard quietly does not.

Given the registry it is a fold over sections asking each renderer for its own
text. A section type that cannot serialise itself fails to register, so the
failure is at build time instead of in a learner's clipboard.

The same argument covers search: the index folds over sections rather than
special-casing them.

## What This Does Not Solve

**Content is not architecture.** This lands the shape of 281 entries; it does
not write them. The owner has already said the prose must be ours and grounded
in real projects rather than VibeHub's invented examples, and has noted their
copy is partly AI-written and hard for a beginner. Absorbing the *modules* and
authoring the *entries* are separate efforts, and finishing this spec finishes
neither the second one nor the interactive demos.

Stated plainly so the ledger is not misread: closing every section and chrome
row still leaves the six demo modules and 281 entries of writing.

## Non-Negotiables

- One collection system. A second detail page for anti-patterns is this
  document failing.
- The head of a term entry is the lexicon record. Not a copy of it, not a
  superset stored elsewhere.
- Every section renderer ships `toMarkdown`, or it does not register.
- Readable text is DOM. Sections are 2D DOM through SwimmerUIKit, including
  the interactive demos.
- Section payloads are validated. An entry that fails validation degrades to
  its head rather than throwing, the way a broken `[[term:]]` already degrades
  to plain text.
