---
id: ADR-0012
title: The Map Guide Comes From SwimmerNerveKit, Model-Free First
type: decision
status: accepted
canonical: true
owner: human
created: 2026-09-24
last_reviewed: 2026-09-27
domain: learning
tags:
  - assistant
  - map
  - architecture
pinned: false
related:
  - ADR-0009
  - SPEC-0001
supersedes: []
superseded_by: null
---

# The Map Guide Comes From SwimmerNerveKit, Model-Free First

## Context

On 2026-09-24 the Owner asked for SwimmerNerveKit's liquid assistant — 涟, the
droplet that flies to what it is talking about — to become University's entry
point: a learner talks to it and quickly understands how to learn here. It
should sit at the bottom centre of the map, where three hints were stacked:
the hovered island's name, 「先点选，再进入。快捷操作：空格或“更多”。」 and
「拖动平移 · 滚轮缩放」.

Two facts shape the answer.

- **Pointing must be true.** A guide that flies to the wrong stone is worse
  than a sentence. SwimmerNerveKit 0.2.0 already has the contract for this: the
  host registers targets by meaning (`createTargetRegistry`, each with a live
  `rect()`), and `nervePresenceTarget` turns one registered target into the
  gesture SwimmerUIKit 2.9.0's `LiquidPresence` draws. Nothing — not a model,
  not the guide — can point at a place the host did not register, and the
  gesture grants no action.
- **Talking needs a model, and a model costs money.** University's rule is
  deterministic first, a small structured model second, open conversation last
  and metered through SwimmerAIProviderKit. Production deploy is on hold
  (current work), and nobody has priced a free-text guide per learner.

## Decision

1. **Integrate, in two phases.** Phase one ships now and calls no model; phase
   two is conversation and waits for an Owner cost decision.
2. **Phase one is a fixed set of questions whose answers are read from the
   map** (`apps/university/src/guide/map-guide.ts`): where to start (the live
   stone or island), where the game challenge is (the first reachable ⚡),
   how review works (the Practice entry), and the shortcuts (the More entry).
   Each answer names at most one place; the droplet flies there. When the place
   is not on screen, the answer says so instead of flying somewhere else. The
   one action offered is the place's own — selecting the stone, opening the
   stop, opening quick actions — through the flow a click would use.
3. **Places are registered with the Nerve registry, by meaning, with their live
   rectangle.** Map labels are found by `data-map-marker`, navigation entries
   by `data-nav-id`; a label the layout did not place this frame is not
   visible. In phase two a model receives this registry's visible catalogue and
   can only answer with one of its ids; the host still admits every gesture.
4. **The bottom centre belongs to 涟.** The entry hint becomes its first
   sentence, directly above it, with the same retirement rule (until the first
   pick). The pan/zoom hint and the hover name move to the top of the map
   under the breadcrumb; they were already mutually exclusive there.
5. **Published versions only.** SwimmerNerveKit 0.2.0 and SwimmerUIKit 2.9.0
   are exact pins. Nerve's newer DOM adapter, guided walk and companion are
   committed upstream but unreleased; University adopts them only from a
   release, and the one local helper that stands in for the DOM adapter says
   so where it is written.

## Consequences

- The map's bottom centre has one thing on it. Scene labels treat the guide as
  an obstacle, so a stone's name is never hidden under the droplet; a short
  landscape puts the opening line beside the droplet rather than above it.
- The guide is the map's one resident control. Directory and overview stay
  on demand, as the map navigation evolution decided; a second resident
  button still fails the domain-release journey.
- Phase one answers are as accurate as the map: they read the same markers the
  learner sees, and a test fixes each question to its place.
- Phase two needs, in order: an Owner decision on cost and free-tier limits;
  metering through SwimmerAIProviderKit in the delivery mode and the machine's
  own AI host in the authoring mode (`GradingPort` is the precedent for that
  split); a Nerve release carrying the guided walk. None of that changes the
  registry or the dock.
- The lesson reader, practice and other screens do not have 涟 yet. When they
  do, the dock moves to `packages/ui` and each screen registers its own places;
  it is not copied.

## Amendment 2026-09-27: SwimmerNerveKit 0.4 and SwimmerUIKit 2.10

Decisions 1, 2 and 4 stand. Decisions 3 and 5 are carried forward onto the
published releases they were waiting for; the reasons above still hold.

- **Versions.** `@pieai/swimmer-nerve-kit@0.4.0` and
  `@pieai/swimmer-ui-kit@2.10.0`, exact pins, the same UIKit in the app,
  `packages/ui` and `packages/world`. 0.4 is the kit's deliberate
  incompatible convergence; it is adopted as a migration, not a float.
- **The entry is the kit's.** `MapGuide` renders `NerveLiquidInteraction`
  with UIKit's `LiquidPresence`, `LiquidReveal` and `LiquidAnchor`. The kit
  owns the quick questions (three shown, the rest behind its disclosure),
  close, Escape, motion pause and the entrance; University no longer keeps its
  own panel, close button or key handler. University supplies the questions,
  the answers read from the map, and each place's own action (the host
  `activity` slot). No `onText`, no `voice`: phase one shows no text box, and
  the kit's speech control only says that voice is not connected. The entry
  mounts once the map has drawn a frame: the kit listens to every press on
  the page (its motion courtesy), and while a course was still loading after
  its lesson that update landed the overdue loading cover under a learner's
  breadcrumb click (e2e `experience` X2 phone).
- **Places by identity, through the kit's DOM adapter.** Each map label and
  navigation entry is registered once as `marker:<id>` / `nav:<rail|tabs>:<id>`
  with `registerElementTarget`, bound to the element the map or rail already
  renders (`apps/university/src/guide/map-targets.ts`). The adapter reads the
  rectangle only when asked and refuses a hidden, off-screen or covered one; a
  scene label is additionally unavailable until the engine's projector has
  placed it (`is-visible`). The local `visibleRect` stand-in named in decision
  5 is retired. An unchanged place keeps its registration across re-renders; a
  changed name or fact registers a new object, so nothing captured from the
  old one follows it. The guide points only after its panel has shrunk and the
  labels have re-laid out, so an answer does not call a stone "off screen"
  because the question list was covering it.
- **Label avoidance through `onBoundsChange`.** The kit's panel portals to the
  page, where the old class-selector obstacles could not see it. Its bounds
  now reach the label projector through a small reservation channel in
  `packages/world` (`labels/overlay-reservations.ts`); the droplet itself stays
  a selector obstacle (`.map-guide__seat`). UIKit stacks its anchored panel
  above the flying droplet; University lowers `--game-ui-assistance-z` so the
  landing label is not hidden under the answer it belongs to.
- **Two islands side by side (`createObjectSelection`).** On the
  archipelago, 「比一比两座岛」 lists the islands on screen; the learner
  chooses two, in order, and sees each island's own registered description —
  University's state label and 已学 n/m count, nothing inferred between them.
  The selection is scoped to account/study/view/course and expires when
  another question is asked, the scope changes, or either island is
  re-registered. It is read-only: no order, prerequisite, grade, completion or
  submission is decided or written by Nerve.
- **Settings.** `NerveDetailsPanel` sits in Settings (one section, both
  modes), with University's facts: map questions available; free
  conversation and voice unavailable; no model, no cost; nothing remembered.
  No Companion appearance or memory store is added — it would be a second copy
  of settings the account already syncs.
- **Not wired, on purpose.** `createNerveConversation` needs a real AG-UI host
  and University has none; phase two still waits on the Owner's cost
  decision. Voice needs a configured, authorised connection. IWER and spatial
  input are not installed. The kit's own strings are Chinese-only, and its
  speech notice and Settings "操作方式" mention text input and double-click
  voice that this host does not offer; those are reported upstream, not patched
  here.

