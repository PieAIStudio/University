---
id: ADR-0010
title: Difficulty Moves When the Learner Moves It, Not When the System Infers It
type: decision
status: accepted
canonical: true
owner: human
created: 2026-09-10
last_reviewed: 2026-09-10
domain: learning
tags:
  - difficulty
  - progress
  - learner-surface
pinned: false
related:
  - SPEC-0001
  - REF-CURRENT-WORK
supersedes: []
superseded_by: null
---

# Difficulty Moves When the Learner Moves It, Not When the System Infers It

## Context

V5 §12 settled how a learner tests out of a unit: self-report narrows the
candidates, answering the course's own exercises is what actually skips
anything, and skipped is recorded separately from learned. That is built.

What was never decided is whether difficulty should also move **on its own** —
whether the product should watch how someone is doing and quietly serve easier
or harder material. The question was asked directly: is the difficulty check a
one-off at the start, or summonable at any time, and should the level adapt by
itself as the learner improves?

Three of those are already answered by what exists. The fourth is a decision,
and it is the expensive one to get wrong, because an adaptive system that is
wrong is not visibly wrong — it just teaches less and looks attentive.

## Decision

**Difficulty changes only when the learner changes it. The system never infers
a level and never silently re-routes.**

Concretely:

1. **Entry check stays as it is.** Self-report proposes which units to test out
   of; it unlocks nothing on its own.
2. **The skip test stays permanently available** at every unit entry, not once
   at the start.
3. **No automatic difficulty adjustment.** Not down on struggle, not up on
   success.
4. **The learner-facing controls that do exist stay learner-operated**: the
   guidance toggle inside every activity, and the tier switch on the play page.

## Why

### Performance is not learning, and adapting to performance adapts to the wrong signal

This is the load-bearing reason. Bjork's *desirable difficulties* line of work
is built on a distinction this decision depends on: conditions that make
performance improve quickly during practice frequently produce **worse**
long-term retention and transfer than conditions that feel harder and slower.
Performance during learning is an unreliable index of learning.

An adaptive system that watches performance and eases off is therefore
optimising the one quantity that is known not to track the goal. The documented
failure shape is specific: a platform sees several wrong answers on a topic,
serves easier questions on that topic, and the learner stays confidently wrong —
difficulty reduction was the wrong branch, and nothing in the system can tell.

### The effect that adaptive systems do show is not clearly the adaptivity

Reviews of personalised adaptive learning report gains, but the evidence on
AI-driven personalised adaptation specifically is inconclusive, and the
large-scale results that do exist are hard to separate from simply doing more
practice. That is a poor basis for a mechanism whose failures are invisible.

### Our instrument is far too short to estimate ability, and is not trying to

Computerised adaptive testing gets a reliable ability estimate from tens of
items — a 27-item adaptive test reaching ~0.91 reliability is a representative
figure, and reliability is understated below about 40 items, which is why a small
fixed item count is not recommended as a stopping rule.

Our skip test is three questions. It would be indefensible as an ability
estimate, and it is not one: it is a criterion-referenced mastery check against
**one unit's own exercises**, in the mastery-learning tradition, and it says one
thing about one unit. Building system-wide adaptation on top of a three-item
signal would be reading it as something it is not.

### The product already has an instrument that measures retention

Review cards are scheduled over time, which is a measurement of what survived,
not of what the learner could do while the material was in front of them. If
anything should eventually inform pacing, that is the honest signal — and
V5 §12 决定 E already keeps proven-but-not-learned material out of that queue,
so the two are not confused.

## What this rules out, explicitly

- Inferring a learner level from answers and re-routing them.
- Serving an easier variant of a lesson or activity after wrong answers.
- Promoting somebody to `challenge` tiers because they have been doing well.
- Any level label attached to a person. V5 §12 决定 A already bans the labels;
  this extends the same reasoning to the hidden version of a label.

## What remains open, and is not blocked by this

**A lesson's embedded activity is fixed at the tier its author chose.** In the
play lab a reader can move between 入门 / 进阶 / 挑战 freely; inside a lesson
they cannot, because the manifest stores one payload rather than a family. The
guidance toggle is available in both places, so a reader can already ask for
more help — they just cannot ask for a harder or easier *task*.

Letting them is consistent with this ADR — it is the learner moving it — but it
is a content-schema change (`activities` would carry a family, not one payload)
and it should be designed in the journey before it is built.

## Consequences

- No learner model, no ability estimate, and no per-learner difficulty state to
  store, sync, or migrate. `ProgressDocument` keeps recording facts (what was
  answered, what was proven, what is scheduled) rather than judgements.
- A learner who is bored must act to skip; the product will not notice for them.
  This is accepted: the cost of missing a bored learner is a slow session, and
  the cost of misreading a struggling one is teaching them less while appearing
  to help.
- If this is revisited, the trigger should be evidence from real study sessions
  about retention, not completion or click-through — both of which improve when
  material gets easier.

## Sources

- [Making things hard on yourself, but in a good way: creating desirable difficulties to enhance learning](https://www.researchgate.net/publication/284097727_Making_things_hard_on_yourself_but_in_a_good_way_Creating_desirable_difficulties_to_enhance_learning) — Bjork & Bjork
- [Introducing Desirable Difficulties Into Practice and Instruction](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf)
- [Desirable difficulty (overview and primary literature)](https://en.wikipedia.org/wiki/Desirable_difficulty)
- [A Comparison of Three Empirical Reliability Estimates for Computerized Adaptive Testing](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6033061/)
- [Computerized adaptive testing: implementation issues](https://arxiv.org/pdf/1012.0042)
- [Exploring the impact of personalized and adaptive learning technologies: a global meta-analysis](https://www.sciencedirect.com/science/article/abs/pii/S1747938X23000805)
- [A Comprehensive Exploration of Personalized Learning in Smart Education](https://arxiv.org/pdf/2402.01666)
