---
id: SPEC-0002
title: VibeHub Absorption Ledger
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
  - exercises
  - coverage
pinned: false
related:
  - SPEC-0001
---

# SPEC-0002: VibeHub Absorption Ledger

## Problem

vibe-hub.org is a 281-term visual dictionary for people learning to build
software with AI. Its author has cleared us to take all of it. The instruction
is explicit and worth restating exactly, because it is the acceptance
criterion: **every module absorbed, every strength kept, and University must
end up with more modules than VibeHub, not fewer.**

"Absorb every module" is only checkable if the modules are enumerated. A
teardown exists at `.scratch/vibehub拆解.md` — 78 modules across seven groups,
observed by visiting the live site rather than reading its marketing. This
document is the ledger built on that teardown: one row per module, what
University has today, and what closing the gap costs.

It is a ledger and not a plan. Nothing here schedules work. Its job is to make
"nothing is missing" a claim someone can check rather than a claim someone can
make.

## What This Product Already Had

Worth stating before the gaps, because a surprising amount of VibeHub's
structure already exists here under different names, and absorbing a module we
already have would be the copy that the share-the-code rule forbids.

| VibeHub idea | What it is here |
| --- | --- |
| Term popover in prose | `[[term:sense.id]]`, one of three kinds handled by one parser in `packages/core/src/marks/` |
| Side panel for a term | `packages/ui/src/reference/ReferencePanel.tsx`, shared by all three kinds |
| A term dictionary | `apps/online/src/content/lexicon.json`, 267 senses, one meaning per entry |
| Chapter progress, local-only | FSRS-backed progress store, and now the shared contract in `packages/core/src/progress/` |
| Course as ordered chapters | Courses, units and lessons, with a 3D world instead of a list |
| Cross-references between terms | `[[lesson:]]` and backlinks, already bidirectional |

Two differences in kind, which the ledger below has to respect:

- **Their term entries carry live demos; ours carry glosses.** Their 281 terms
  each render a working miniature of the thing being named. Our 267 senses are
  English headwords with Chinese glosses, built for a reading layer, not a
  dictionary page. The scale matches; the axis does not. Absorbing their term
  page means building the demo half, not re-importing the words.
- **They have no account and no backend.** Everything personal is in
  `localStorage`. That is a legitimate choice for a free reference site and the
  wrong one for a product with a paywall, so their persistence modules absorb
  as *behaviour*, never as *architecture*.

## The Ledger

Status values: **have** — exists and needs nothing; **adapt** — exists but
needs work to cover their case; **build** — does not exist; **decline** — a
deliberate no, with the reason.

A `decline` is not a gap. It is the one thing a coverage list must be able to
express, or it degenerates into copying a competitor's mistakes for the sake of
a full checklist.

### A. Site frame (10)

| # | Module | Status | Note |
| --- | --- | --- | --- |
| A1 | Top navigation | adapt | The world map is our navigation. What is missing is that VibeHub's six items *teach* — they announce that look-up, drill, systematic study and pitfall-avoidance are all valid uses. Our map announces one. |
| A2 | Global search | have | `TermIndex` in `packages/ui` plus `searchLexiconIndex` in `packages/core`. The placeholder teaches from this lexicon: 「应用」「接口」「点开图标就能用」. Shells mount the surface; they do not reimplement it. |
| A3 | Language switch | decline | Their zh/en split is for SEO reach. This product's foreign-language layer is a *reading aid inside one lesson*, which is a different feature that already exists. |
| A4 | Theme accent colour | adapt | Ours is `packages/ui` tokens from SwimmerUIKit. Their trick worth stealing: switching it re-colours every live demo, which teaches "design token" by demonstration. |
| A5 | Cursor effects | decline | Taste signal, no learning value, and a cursor effect over a WebGL canvas fights the camera controls. |
| A6 | First-visit source survey | decline | Growth attribution, not teaching. |
| A7 | Community modal | build | Cheap, and this product has no community surface at all. |
| A8 | Footer author card | have | Ours exists via the brand kit. |
| A9 | Term submission link | build | Theirs is a Feishu form — zero backend UGC. We have a backend, so ours can be better, but theirs is the proof the cheap version works. |
| A10 | Mobile form | build | Web3D baseline rule 8 is still open here: there is no mobile shell. Their term page becoming a swipeable carousel on mobile is the pattern to copy. |

### B. Term index (7)

| # | Module | Status | Note |
| --- | --- | --- | --- |
| B1 | Category chips | have | Track chips on `TermIndex` (`技术用语` / `通用英语` / `全部`), each with a live count. |
| B2 | Sub-category sidebar | build | Their rule is worth taking exactly: the sidebar only appears when a category has more than one group. |
| B3 | Term card with live demo | build | The hard one, and the reason their site is convincing. A card shows a *miniature working UI*, not an illustration. |
| B4 | Favourites | build | Pure `localStorage` there; ours should be account-backed, so this is one of the modules where we are structurally better. |
| B5 | Search results | have | Hits group by `track` with a count per group. The index reads headword, gloss, usage, and optional `colloquial` — the field is on the schema, empty in the current 267 entries. |
| B6 | Search empty state | have | A miss is the syntax manual: search the English word, the Chinese gloss, or describe what you mean. |
| B7 | Per-category SEO titles | build | Ours has no public term pages to title yet. |

### C. Term detail page (24)

The spine of the site. Grouped rather than listed one-by-one where the work is
the same.

| # | Module | Status | Note |
| --- | --- | --- | --- |
| C1, C2 | Breadcrumb, favourite star | build | Follows from B4 and a term route existing. |
| C3 | **Copy as Markdown** | build | Serialise the whole entry — definition, aliases, anatomy, variants, sources — for pasting into an AI chat as context. Their version deliberately omits the quiz answer. High value, low cost. |
| C4 | English pronunciation | adapt | Our lexicon already carries `phonetic`. What is missing is the speaker button, and their reason for it is good: read the *English* aloud so a learner dares say it in a meeting. |
| C5 | "你可能会说" colloquial lead | build | The entry point for someone who has the experience but not the word. |
| C6 | One-line definition | adapt | Ours has `gloss`. Theirs almost always adds **what it is not**, which ours does not. |
| C7 | Prerequisite terms | build | We have `[[lesson:]]` links; a prerequisite is a typed edge we do not model. |
| C8 | Aliases | build | Our lexicon is one sense per entry with no alias list. |
| C9, C10, C11, C12 | Live demo, step-by-step diagram, state-switch demo, click-the-region quiz | build | The expensive block, and the one that makes them worth absorbing. C10 and C12 are called out in the teardown as their most distinctive work. |
| C13–C18 | Anatomy, variants, scenes, use/don't, distinctions, plain explanation | build | Structured entry sections. Cheap individually, and they are what turns a gloss into a page. |
| C19 | Embedded 3-choice question | build | In flight — see "Work already started". |
| C20 | "Tell your AI Agent this" | build | Their own gap is that it has no copy button. Ours should ship with one; that is a free win over the original. |
| C21 | "What to learn next" | adapt | Backlinks exist; an ordered next-step is a different edge. |
| C22 | Authoritative sources | have | This is our evidence rail, and ours is stronger: they link MDN, we link a commit and a line range in a shipping repository. |
| C23 | Prev/next floating navigation | build | Theirs reveals the next term's name on hover. |
| C24 | Design-style sections | build | Includes a **"when not to use it"** block, which is the half most references omit. |

### D. Practice (6)

| # | Module | Status | Note |
| --- | --- | --- | --- |
| D1 | Endless single-question stream | build | No total, no score, no progress bar — deliberately pressure-free. Directly opposed to our settlement screen, and both should exist for different moods. |
| D2 | Three-option question | **in flight** | See below. |
| D3 | Correct feedback | in flight | |
| D4 | **Per-option wrong feedback** | **in flight** | The pedagogically important half: the explanation is written for the option you actually picked. |
| D5 | Term card unlocked by answering | build | The right panel starts masked and the full term page is the reward. |
| D6 | Recent-question de-duplication | build | Their question ids prove the practice bank *is* the per-term quiz, not a second corpus. That is the architecture to copy. |

### E. Course track (14)

| # | Module | Status | Note |
| --- | --- | --- | --- |
| E1, E2 | Track list and home | have | Our world map and course map. |
| E3 | Narrative chapter summaries | adapt | Each summary anchors on the previous chapter. Authoring rule, not code. |
| E4 | Three-column chapter page | have | `LessonReader` plus the margin rail. |
| E5 | Chapter illustration | build | One hand-drawn line-art banner per chapter, with a recurring cat. Character continuity is doing real work for memory. |
| E6 | 12-chapter map with four phases | adapt | Our course map is 3D; the missing part is the *phase* grouping above the lesson. |
| E7 | Four-phase progress bar | adapt | |
| E8 | **"So far we have decided"** | build | A decision log that accumulates down the course, turning the track into a product document the learner ends up owning. Nothing here does this. |
| E9 | In-chapter term side panel | **have** | This is exactly our `[[term:]]` plus `ReferencePanel`, shipped 2026-08-21. Their version is a button, not a link, for the same reason ours is. |
| E10 | Illustrated argument blocks | build | Persona and user-story cards, each with a caption saying what to look at. |
| E11 | Simulated agent conversation | build | Three bubbles: ask, agent reports, human confirms. |
| E12 | Pasteable final deliverable | build | Chapter 12 folds eleven chapters of decisions into seven pasteable requirements. Follows from E8. |
| E13 | Chapter navigation | have | |
| E14 | Progress storage | have | Ours is stronger: FSRS-backed and account-bound rather than `localStorage`. |

### F. Anti-AI-flavour (12)

An entire section this product does not have, and the one the user singled out.

| # | Module | Status | Note |
| --- | --- | --- | --- |
| F1 | Three-way catalogue | build | 25 entries: Chinese verbal tics (11), template-looking pages (8), bad interactions (6). |
| F2 | **Epistemic honesty notice** | build | "A single word, visual element or interaction cannot prove authorship. Judge by whether it appears *together with* other default choices." Take this verbatim in spirit — without it the page becomes a lie detector. |
| F3 | Anti-pattern cards | build | Text entries show the bad sentence; visual entries render the bad UI. |
| F4–F7, F9, F10 | Detail page, before/after, cause, fix, examples, agent instruction | build | |
| F8 | **"When it does not count"** | build | The counterweight to F2. |
| F11 | Recommended Skill | adapt | They cross-sell their own Skill. Ours is `.agents/skills/write-lesson`, which already has a hedge-preservation linter — a stronger version of the same idea. |
| F12 | Related terms | adapt | Backlinks exist. |

### G. Skill (5)

| # | Module | Status | Note |
| --- | --- | --- | --- |
| G1 | Skill landing page | build | |
| G2 | **One-minute install** | build | No command line. A repository address plus the sentence "帮我安装这个仓库里的 skills/vibehub Skill." and a copy button — the agent installs itself. |
| G3 | Express-it-properly | build | Colloquial → terminology, with the self-restraint stated out loud: keep the user's meaning, add only genuinely useful terms, never invent frameworks or parameters. |
| G4 | Proactive hints | build | Three self-imposed limits, of which **at most three hints at a time** is the one that keeps it from becoming noise. |
| G5 | Simulated agent demo | build | |

## Tally

| Status | Count |
| --- | --- |
| have | 12 |
| adapt | 10 |
| build | 53 |
| decline | 3 |
| **Total** | **78** |

The twelve we already have: A2, A8, B1, B5, B6, C22, E1, E2, E4, E9, E13, E14.
The ten to adapt: A1, A4, C4, C6, C21, E3, E6, E7, F11, F12.
The three declined: A3 (language switch), A5 (cursor effects), A6 (source
survey). Every other id is a build.

Listing the small categories by id rather than only by count is deliberate:
a count can drift out of agreement with the table above it and nobody
notices, whereas a list of ids can be checked against the table in a minute.
That check has been run once, on 2026-08-21, and it found the first draft of
this tally wrong.

A `decline` is not a gap. If one is ever overturned, overturn it here rather
than in a commit message.

## Audited, 2026-08-21, By Two Models Independently

The tally below this line counts rows. It does not count whether a learner can
read anything, and a ledger that cannot tell those apart will flatter itself
until someone opens the product. So the same adversarial brief went to two
models with no contact between them.

| | Grok | Gemini |
| --- | --- | --- |
| Mechanism built | 41 / 78 (53%) | 39 / 78 (50%) |
| Content authored | 26 / 78 (33%) | 21 / 78 (27%) |
| Reachable in a running app | 26 / 78 (33%) | 35 / 78 (45%) |

They converge on mechanism and content and diverge on *reachable*, for a stated
reason: Grok required a row to be both mounted and populated, Gemini required
only mounting. Both readings are defensible and the gap between them is exactly
the mechanism-versus-content distinction this section exists to protect.

**Both independently found the same overstatements**, which is the part worth
acting on:

- **A2 was not a global search.** It is a button to a separate page, and it
  indexes 267 English senses rather than a visual-term corpus.
- **A8 `have` was false.** There is no author card.
- **C22 `have` was a category error.** Our evidence rail cites a commit and a
  line range in prose; their C22 is a "further reading" block on a term page.
  Ours is stronger and it is not the same module.
- **E9 was named but empty.** The mechanism shipped and the delivered courses
  contain **560 lessons and zero `[[term:]]` tokens**, so for a learner it did
  not exist.
- **C19 / D2–D4 were "in flight" and not in the product.** `ChoiceBlock`
  existed; `ExerciseSchema` still had only `short-answer | explain`, and the
  course packages held **0** choice exercises against 673 short-answer and 32
  explain.
- **The F group was marked `build` and was already done** — understated, which
  is the rarer error and still an error.

Measured against the delivered content at audit time: 52 courses, 560 lessons,
1,597 evidence anchors, 420 `[[lesson:]]`, **0** `[[term:]]`, **0** choice
exercises; lexicon 267 entries with **0** `colloquial`.

### What changed immediately after the audit

- `colloquial` went from 0 to 267 entries carrying 532 phrasings, which opens
  the search path the field was built for. Verified with queries containing no
  part of the term.
- The F group is mounted at `#/flavour` with 25 entries.
- Favourites and the term entry page are mounted rather than merely built.

### One number in this document was wrong

The line above read **1,815** evidence anchors until 2026-08-21, and a product
audit disputed it. Counting the delivered course packages directly —
`apps/online/content/**/*.json`, `course.units[].lessons[].evidence` — gives
**1,597** across 560 lessons, alongside 1,236 cards, 673 short-answer exercises
and 32 explain exercises.

The number is recorded here rather than quietly corrected because it had been
repeated in reports as evidence of scale. A count nobody re-derives is a claim,
not a measurement, and this one was off by 218.

### What the audit says is still worth knowing

The half of VibeHub that makes it persuasive — the live miniature demos on
every term card and term page (C9–C12, B3) — is at **zero**, and no amount of
section plumbing changes that. A term page here is still an English headword
with a Chinese gloss; theirs is a working miniature of the thing being named.

## The Catalogue Landed, 2026-08-21

The audit above said the persuasive half was at zero and that a term page here
was an English headword with a Chinese gloss. Both were true. What changed is
that the 281 entries now exist as a third collection, `concepts`, at
`#/concepts`, with the seven categories and forty-two sub-categories intact.

### What was taken, and what was not

Their names and their organisation. Not one sentence of their prose. Their
examples are invented; this product has a real repository, real courses and
real evidence anchors, and the authoring brief carried a list of facts about
this codebase that an entry was allowed to cite, with inventing anything else
forbidden outright.

That instruction is visible in the shipped text. The 「回滚」 entry says, of
this product's own deployment: 「产品对外那包怎么退，公开事实没写，这里不编。」
An entry declining to invent a fact about us is worth more than the fact would
have been.

### How the inventory was checked

Three independent reads: a browser pass over the seven category pages here, and
Grok and Gemini scraping from the same brief with no contact. All three agree on
281 slugs, with no disagreement on any category or sub-category placement. A
first pass here found 280 — `/env-var` sits in a card whose link the first
extractor missed — and the disagreement is what surfaced it.

The counts are pinned in `packages/core/src/concepts/catalogue.test.ts`, so a
future batch that quietly drops four entries fails in CI rather than appearing
as a chip that says 133.

### What the ledger can now claim, and what it still cannot

Genuinely closed, with content rather than mechanism:

| Module | Now |
| --- | --- |
| B1, B5, B6 | Seven category chips plus 「全部」, counts live against the query |
| C1, C3 | Breadcrumb and copy-as-Markdown on all 281 |
| C5 | 281 colloquial leads — the field the audit found empty on the lexicon |
| C6 | 281 definitions, **every one carrying 「它不是」**, enforced by test |
| C7, C8, C21 | Prerequisites, aliases and related on the entries that have them |
| C13, C14, C16, C17, C18 | Anatomy, variants, use/don't, distinctions, plain |
| C19, D2, D3, D4 | 281 three-option questions with per-option wrong feedback |
| C20 | Agent prompt with the copy button theirs does not have |
| C23 | Prev/next, mounted for the first time — it shipped unmounted, and an unmounted component is one nobody has checked |

Mechanism built, coverage partial and unevenly so:

- **C9, C11 (`demo`)** — **64 of 281**. Every leaf renders through SwimmerUIKit,
  so the demo of 「按钮」 is the button this product ships, and a theme change
  repaints all of them.
- **C12 (`regions`)** — **13 of the 19 page-layout and 官网区块 entries**, the
  group the exercise was designed for.
- **C10** — the readable chain shipped earlier. Its animated half is not a
  missing type: a `demo` with one state per step *is* the stepper, so what is
  missing is authored steps, not a schema.

The shape of the 64 is more useful than the number. 17 of 21 form controls, 20
of 21 in 弹窗与提示/导航, 21 of 25 in 内容展示 — and **6 of 23 in 外观/动画/鼠标**,
which is the group most obviously about *looking* at something.

That gap is the vocabulary's, not the writer's. The ten leaves can say "a
disabled button" and cannot say "rounder", "a softer shadow", "half opacity",
"blurred behind", or "this is what hover looks like". The writer skipped rather
than faked, which was the instruction. Closing it means a bounded enum of visual
treatments drawn from brand-kit tokens — not free-form styling, which is the
door the node vocabulary exists to keep shut.

Two smaller honest notes:

- **`divider` became a primitive because content faked it.** The first demo for
  「分割线」 drew its rule out of box-drawing characters, which renders as literal
  dashes and reads aloud as a row of hyphens. An author reaching for a
  workaround is how a missing primitive announces itself.
- **The form demos approximate.** 「单选框」 is highlighted buttons, not a real
  radio, because the radio was never exposed as a leaf. It teaches the behaviour
  correctly — pick one and the other goes out — and the `alt` text describes
  what is on screen rather than claiming to be a radio. Recognition is weaker
  than behaviour here, and that is a real cost.

Still open, and not to be counted:

- **B2** sub-category sidebar. The grouping exists; the sticky rail does not.
- **B3** live demo on the *index card*. Cards carry a tagline.
- **C2** favourite star on a concept page. Term pages have it. The favourites
  store is keyed by one id across collections, and concept ids and lexicon sense
  ids do not collide *today* only because one set is dotted and the other is
  kebab — so this wants a namespace before it wants a button.
- **C4** pronunciation on concept pages. Concepts carry `en`; the button is
  wired for terms only.
- **C15** 典型使用场景 has no section type of its own; `variants` covers part of it.
- **C22** stays a category error, as the audit said. Ours is stronger and it is
  not the same module.
- **A10** mobile form. Web3D baseline rule 8 is still open.
- **G1–G5**, the Skill group, entirely.
- **0 of 560 delivered lessons contain a `[[term:]]`.** The catalogue does not
  change this. It is still the gap between a mechanism and a learner.
- **The practice stream (D1–D6) is built, tested, and mounted by nobody.**
  `PracticeStream` is exported from `packages/ui` and imported by neither shell,
  and until now it had nothing to draw on: there were 0 choice exercises in
  delivered content. There are now 281. Wiring it is the single highest-value
  thing left, and it is a refactor rather than a mount — the question model is
  typed to `TermEntry` and would have to become collection-generic first. Doing
  that badly would be worse than the current honest zero.

### Two defects only a browser found

Both had every test passing.

- Concept pointers were resolved against the lexicon, so 「相关」 and 「先知道」
  rendered as bare ids on all 281 pages. The ids were valid concept ids, which
  is exactly what the test checked.
- `main.terms` has never had a rule behind it in either shell, so every entry
  page in all three collections ran edge to edge. That one shipped with the
  term and anti-pattern pages and was missed in their browser pass.

The reading measure now lives on `.entry-page`, where a shell cannot forget it.

### Search stopped requiring the exact words

Not on this ledger, and the reason it belongs here anyway: a catalogue whose
entry point is 「描述你看见的现象」 is only as good as the search behind it.

Matching used to ask whether the whole query appeared verbatim in some field.
Measured against real phrasings, 「怎么退回上一版」 returned 「搜索」 and
「第一次打开特别慢」 returned nothing. `Intl.Segmenter` — ICU, already in every
engine, no dependency — segments the query, and an entry scores by which tokens
landed and in which field. Field weights are the load-bearing part: unweighted,
an entry's body is thousands of characters and one sentence matched 248 of 281.

The lexicon and the anti-pattern catalogue moved onto the same module. Three
collections with three search implementations would have been the share-the-code
rule broken three ways.

## What "Better Than Theirs" Has To Mean

The instruction is that University ends up with more modules, not fewer. That
is satisfied by the ledger only if the additions are real, so they are named:

- **Evidence.** C22 is their weakest strong module — links to MDN. Ours links
  to a commit and a line range in a shipping private repository. This is the
  product's actual advantage and it has no counterpart on their site.
- **Spaced repetition.** They have no review at all. Every term page here can
  drop a card.
- **Accounts.** Their favourites, progress and practice history die with the
  browser profile. Ours do not have to.
- **Tiered grading.** Their only question type is machine-checkable by
  construction. Ours can accept a sentence and grade it honestly, including
  saying it cannot.
- **The foreign-language layer.** 267 senses with FSRS staging, which has no
  equivalent there.

## Work Already Started

- **C19 / D2 / D3 / D4** — the three-option exercise with per-option wrong
  feedback, in `packages/core` (schema and validator) and `packages/ui`
  (component). Dispatched 2026-08-21.
- **E9** — shipped 2026-08-21 as `[[term:]]` plus `ReferencePanel`, and it
  removed 217 lines while adding the feature, because it replaced a second
  parser for the same syntax rather than adding a third.
- **A2 / B1 / B5 / B6** — term index and search, in `packages/core`
  (`searchLexiconIndex`) and `packages/ui` (`TermIndex`). Closed 2026-08-21 and
  mounted in the delivery shell at `#/terms`, reachable from the top bar on
  every screen. Clicking a hit opens the existing `ReferencePanel` rather than
  a second drawer.

  Verified in a browser against the real 267 entries: searching 「点开图标」 —
  a description, not a name — returns `app`, which is the entire point of
  indexing the gloss and not only the headword. A miss renders the syntax
  manual. The authoring shell has the CSS but does not yet mount the surface.

## Non-Negotiables Carried From The Portfolio

- Readable text is DOM, never geometry. Term pages, search and every block in
  section C are 2D DOM through SwimmerUIKit, never WebGL text.
- Live demos in section C run inside the shared component package. Two demo
  runtimes, one per shell, is the share-the-code rule broken.
- Their persistence patterns absorb as behaviour, never as architecture. No
  module in this ledger justifies a second progress store.
