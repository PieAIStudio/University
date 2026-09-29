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


## Amendment 2026-09-28: SwimmerNerveKit 0.7, UIKit 2.11, I18nKit 0.2

Decisions 1 to 5 and the 2026-09-27 amendment stand; this moves them onto the
releases the kit now requires (Nerve 0.7.0 needs UIKit ≥ 2.11) and retires the
two local workarounds those releases replace.

- **Versions.** `@pieai/swimmer-nerve-kit@0.7.0`, `@pieai/swimmer-ui-kit@2.11.0`
  and `@pieai/swimmer-i18n-kit@0.2.0`, exact pins; UIKit the same in the app,
  `packages/ui` and `packages/world`, I18nKit the same in the app, `packages/ui`,
  `packages/core` and `apps/university-ai`. The app came from Nerve 0.5.0.
- **University supplies the language; Nerve keeps its words.** 0.7 ships its
  catalogs and no engine. `apps/university/src/nerve-language.ts` builds the
  three readers from `nerveCatalogs` with the I18nKit engine the product already
  runs, once, at module load; `main.tsx` passes `NerveI18nProvider value=` one
  memoised expression per locale. No translation is copied and no second
  language preference exists: the locale is `useI18n()`'s. University changes
  language by reloading onto the same route, so no `key={locale}` is added to the
  map, the scene or 涟. No headless controller that takes a `language` getter is
  used here (no conversation, companion storage, voice or guidance walk). The
  kit's strings are now English as well as Chinese, which closes the
  Chinese-only note above.
- **The answer reads first, by the kit's own contract.** `activityPlacement=
  "after-status"` replaces the CSS `order` rules that moved the place's action
  and the two-island comparison below the answer.
- **The landing label steps around the panel.** UIKit 2.11 avoids the anchored
  panel itself, so the `--game-ui-assistance-z: 94` override is removed.
- **I18nKit 0.2's stricter contracts.** A message whose English plural uses a
  number now declares that number in the Chinese source too (`{n, plural, other
  {…#…}}`); the language list offers what `catalogStatus().selectable` says, not
  key coverage alone.
- **Not adopted at that release-adoption step.** `createNerveOpening` (the
  welcome, return and wrap-up cards of V7 tasks 03 and 04), conversation and
  voice. The first-meeting follow-up below adopts the welcome and guided walk;
  the other boundaries remain.

## V7 first-meeting follow-up (2026-09-28)

The approved V7 stations 1–2 replace the white welcome modal with the same 涟
already living on the map. `OpeningSplash` uses the published UIKit `GameSplash`;
University owns only truthful selling lines, launch admission and measured work.
A browser map launch or reload requires the real enter button, while a same-origin
navigation is a scene transition. Lesson/auth deep links retain their explicit
destination. `autoStart` is an explicit native-host input to the shared wrapper,
not a guessed user-agent exemption; no native wrapper or physical device was
validated by this browser implementation.

`ScenePresence` reads the existing loader store in Stage's existing post-output
frame callback, not through a React subscription that a sibling's `useGLTF`
could update during rendering. Nested required loading boundaries register
`ScenePending`; actual content, geometry, dressing, monsters, the built avatar
and a completed output frame must be present before admission reaches 100%.
Planet worker preparation participates in the same boundary. No new renderer,
height field, model loader or animation loop is introduced. Later pending scenes
wait two seconds before showing the shared transition screen; a shown transition
stays at least 800ms. The existing 20-second recovery and context-loss paths stay.

`use-first-meeting` owns one effect-created opening controller per account/page
scope, safe under React's setup/cleanup rehearsal. Product `WelcomeCards` supplies
two real shelf paths, optional fixed-question help and the existing assessment,
login and browsing exits. Page changes use `opening.update` on the same key;
closing acknowledges the existing welcome record, not course progress. Only an
eligible invitation binds the optional opening surface: binding an idle controller
would reserve an empty status outlet and suppress the map's normal hint.

After the welcome is removed and the new map has committed, the first meeting
uses the existing obstacle-aware `CloseUpCamera` to frame the avatar on the
chosen first stone with its still-closed chest. The pair fits the actual camera
FOV/aspect; portrait framing leaves room below it for the short guide card. Only
this one-step introduction suppresses other map labels, restoring them unchanged
on dismissal. The first stone retains its real label registration, with the
short 第 1 关 / Level 1 landing label rather than a duplicate question.

The camera's actual `onSettled` signal, followed by the existing post-layout
rendezvous, admits the one-step `createGuidanceWalk` with
`language: () => nerveLanguage(currentLocale)`. Three early layout frames alone
could measure the stone while the camera was still travelling and wrongly
announce it unavailable; no guessed extra timeout replaces that signal. The full
lesson description remains on the registered object. Scene geometry, chest state,
lesson completion and the ordinary chest/boss camera behavior do not change.
Missing/covered destinations remain unavailable rather than being guessed. Scope
and captured-object checks reject late callbacks and previous-account actions.
No model, voice, authentication submission, grade or learning write is performed.

The framing receipt belongs to the current canvas attempt, not just its lesson.
A context restore invalidates it even when the learner and destination have not
changed. Cancelling a post-layout callback also invalidates that callback itself:
the same destination becoming ready again cannot revive an earlier measurement.
The lifecycle unit test and browser restore case both retain the corresponding
regressions; neither recovery path writes learning progress.

The English welcome never invents an English lesson preview when the real shelf
still supplies a Chinese title; it names that limitation in English and preserves
the course entry. Translation of the course itself remains the authoring lane.
The full acceptance evidence and remaining product boundaries belong to task 03,
not a second verification checklist in this ADR.

## V7-04: return and wrap-up are openings, not another results page

The existing chest ceremony hands its completed lesson to `useJourney` only
after leaving its close-up. The host rechecks the current lesson revision,
reading confirmation, exercises, account owner and route before offering a
wrap-up on the same island. Late buttons and late ceremony callbacks cannot
write consent or navigate another learner. Scheduled card counts and local/cloud
save claims come from the current progress port, not the reward animation.

The same `createNerveOpening` owns return and wrap-up presentation. Its real
bounded topic policy, visibility, courtesy pauses and four-second member timeout
are retained. A changed save receipt updates the current page without replacing
an unfinished recap. Only a shown invitation records its product frequency cap;
the first email-save invitation and the day-three follow-up, plus the weekly
member line, merge within the existing account preferences and offline outbox.

K1 is an explicit reminder/save-only choice followed by the existing account
flow. University does not create an email-only authentication protocol: that flow
still needs a password and email verification. Reminder intent stores the IANA
timezone and `cards-due` schedule, not an email address or a sending receipt.
Tied preference updates prefer opt-out. Settings can revoke that intent. Actual
email delivery and live purchases remain unavailable and are described as such.

A returning root visit offers the real next lesson once, after account/data/scene
readiness, and frames it using the existing map command. Dismissal leaves the
ordinary ready-chest glow and the map's selection/navigation intact. The static
shortcut sentence and its obsolete picked-once state are removed; on-demand
questions, comparison and keyboard commands remain. On phones the same avatar
panel opens in UIKit's modal and shows the core rest-ticket balance; its account
action still opens the shared account page. No renderer or cosmetic store is added.

Removing the static sentence also removes its accidental sideways displacement
of the droplet in short landscapes. Keep 涟's normal touch-sized body centred;
the ordinary island-name component uses its existing compact-caption treatment
below 400px height. Full text remains in DOM/selection, and the same bounded
label slots and leader retain island identity. No scenery or camera is moved
to make room, and no collision or accessibility threshold is relaxed.
