---
id: REF-LIQUID-DIFFICULTY-HANDOFF
title: Liquid UI and difficulty levels — handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-09-11
last_reviewed: 2026-09-12
domain: execution
tags:
  - handoff
  - liquid
  - difficulty
---

# Liquid UI and difficulty levels — handoff

For the session that picks this up cold. Everything below was measured or run,
not assumed; where something is a judgement it says so.

The three tasks this page was written to hand over are done. What follows is
the state they left, and the work they uncovered and did not do.

## Integrated status (2026-09-12)

The course branch is now merged into main, alongside the product and visual
lanes (integration baseline `2316755f`). Continue from
[current work](current-work.md), not by repeating this handoff. The owner has
separately requested UIKit 2.6.1 adoption and CTA migration; its new validation
must not inherit the older successes below. Installed versions remain in the
package manifests and lockfile.

## Historical handoff state (2026-09-11)

- At this handoff, branch `work/course-interactive` in `University-courses`
  had intentionally not yet merged; that merge is now complete.
- `@pieai/swimmer-ui-kit` **2.4.0 is published** and all three consuming
  packages are on it. `pnpm verify` green in both repos.
- The brand kit lives at `/Users/yuanfei/PieAI/SwimmerUIKit` (sibling checkout).
  Brand-kit-first: a capability gap gets fixed there and released, never forked
  into the product. Release checklist:
  `SwimmerUIKit/docs/reference/usage-and-upgrade-playbook.md` §本仓发版清单.
  Publishing is `gh workflow run npm-publish.yml --ref main` — never local
  `npm publish` — and it is not published until
  `npm view @pieai/swimmer-ui-kit@<v> version --registry https://registry.npmjs.org/`
  returns.
- **The six other consuming repos are still on 2.3.0.** Anvil, Break, Collapse,
  OwnMySpace, Show, TuringPact, YaZu pin their own versions on purpose; the
  playbook's 全生态版本对齐清单 is the procedure. Nothing in 2.4.0 is
  breaking, so this is housekeeping rather than a blocker.

### What the liquid surface is now

- Shape comes from **path data**, not from a filter. `blobPath` in
  `SwimmerUIKit/src/liquidGooeyGeometry.ts` pours the outline outward along a
  closed Catmull-Rom spline. Outward-only by construction, so the silhouette
  always contains the control's box. The clamp is exported as
  `LIQUID_BLOB_MAX_FRACTION` (0.18 of the shorter side).
- Material is a single `feSpecularLighting` pass at 22° elevation, scaled by
  each form's `gloss`.
- Motion is `scaleY` (the two scale axes may disagree) plus the `wobbly` spring
  preset — squash and stretch, crossing rest three or four times.
- **The body casts a shadow.** Two layers on the forms that are bodies with
  weight: a tight, barely-offset *seat* that says it is touching, and a wide
  low *cast* that gives height. Both are outer and spreadless, so they compile
  to compositor `drop-shadow()` and hug the poured outline rather than a
  rounded rectangle. `shadowEngaged` tightens both when the body is pressed,
  and `settle` rests mid-air with no seat and gains one on landing. Colour is
  one token per theme, `--game-ui-shadow-liquid-ink`.
- **Twelve named forms**, split by `kind`. Bodies — `set`, `press`, `swell`,
  `settle`, `fill`, `reach`, `ripple`, `drain` — go straight into
  `LiquidSurface`. Relationships — `follow`, `merge`, `split`, `bead` — describe
  the space between siblings and need a `LiquidGroup` the caller arranges;
  handing one to `LiquidSurface` warns, in every build, instead of rendering a
  body that never moves.
- **The Liquid page is the canonical home**, at `/liquid.html` on the showcase
  site (`SwimmerUIKit/liquid.html` + `preview/liquid.tsx` +
  `src/LiquidPreview.tsx`). Every form live at two sizes, on any of the four
  tones, in both themes, with its knobs and its derived edge width beside it.
  `GameUiPreview` keeps the component — `surface` is a second axis on
  `GameButton` — and links out for the vocabulary. Run `pnpm --dir
  ../SwimmerUIKit dev` (port 5174) or `preview_start` the `swimmer-ui-showcase`
  config in `.claude/launch.json`.

### What the difficulty feature is now

- `LessonActivitySchema` has `family`. Same family + same kind + different
  `difficulty` is one activity at several levels.
- `groupActivityLevels` (core) keys the set by **every member id**, so the
  prose's single `::play{#id}` can point at any of them.
- `LearningActivity` renders the picker when a set has more than one level, and
  defaults to the easiest level authored (V5 「默认先提供入门」).
- Enforced in three places now — `LessonManifestSchema.superRefine`, the walk
  over `studies/` in `apps/local/scripts/check-lesson-activities.mjs`, and the
  walk over the **delivery package** in the same script. The third one was
  missing and is why the first levelled lesson passed on disk and failed on
  delivery; both walks call one function, and
  `apps/local/scripts/check-lesson-activities.test.ts` holds that.
- **One lesson has three levels**: `browser-ai` →
  `when-a-project-is-too-big-to-read` → `ask-where-not-what`, revision 5, family
  `screen-to-file`, a `connect` board at 3 / 6 / 9 nodes. The other 26 written
  lessons still store one level each, which is legal — `family` absent is one
  level.

---

## What the three tasks found

### Task A — one lesson's three levels, end to end · done

Revision 5 of `ask-where-not-what`. The prose is untouched and still carries a
single `::play`; the picker is on the component and defaults to 入门. Verified
in a real browser at device ratio 1: the picker swaps 3 → 6 → 9 nodes, both
harder boards solve in one attempt with every probe tracing, and the nine-node
board lays out without overlap.

The levels are real payloads. What changes is how many conditions the learner
holds at once, and every node is something that exists at the pinned commit:
入门 collapses the two halves of the method into one hop; 进阶 pulls them apart
(the arrangement gives a *name*; only the import lines turn a name into a file)
and runs two screen targets through both hubs; 挑战 adds two decoys that must be
left unconnected — `Image.jsx`, whose name is the most guessable on the board
and which the arrangement never mentions, and `worker.js`, which the same file
does mention and which draws nothing.

**Two defects only real content could find**, both fixed:

- The delivery walk of `check:activities` had no family awareness, so the
  feature could not ship the first time it was used.
- `play.connect.win` said 「两条测试路径」 with a hardcoded two. The challenge
  board has three, so the pass message told the learner something false at the
  moment it congratulated them. It states the property now.

**One gap left open, deliberately.** The acceptance criterion 「完成记录里存
的是学习者真正做的那一档」 could not be verified, because there is no
completion record: `LessonReader` never passes `onActivityResult`, and the only
consumer of `ActivityResult` in the repository is the play lab's in-memory
state. The value is correct at the moment it is built (`activity.difficulty ??
"practice"`, which the host also renders as `data-difficulty`); there is simply
no sink. Wiring one is a product decision — what an activity completion means
for lesson progress, and whether it touches `CourseProgress.proven` — not a
verification fix, so it was not invented here.

### Task B — a dedicated Liquid page · done

`liquid.html` is a second real HTML entry rather than a route: the nav already
links out to a separate Storybook origin, and the components page's bundle
should not grow for a page it does not render. The nav and theme toggle moved
into `preview/ShowcaseNav.tsx`; there is one of each.

**Tone is a control, not a section.** The brief asked for every form on every
tone, which is forty-eight tiles — forty-eight near-identical pictures of the
thing that does not vary, against an animation budget that degrades the surplus
to static. One picker recolours all twelve at once, so every form really is
available on every tone, live, and the page stays a page.

**The six new forms have no landing site, and that is the point.** Each earns
its place in the vocabulary by saying something none of the others could; none
is wired into a product. `merge` and `split` are the signature moves, and the
rest earn a screen one real moment at a time. The recorded finding stands:
gooey on a static solid block reads as damage, and one screen wants one liquid
element with one layer of intent.

A naming note for whoever extends this: `set` and `settle` sit next to each
other in the same picker. `set` is the correct material verb and the summary
always shows beside the name, so it shipped — but a thirteenth form should not
add a third word in that neighbourhood.

### Task C — the liquid body has no shadow under it · done

Verified at device ratio 1 against the flat control, which is the only
comparison that answers 「does it look grounded」. A seat alone glues the body
to the page; a cast alone leaves it hovering; the flat button carries both as a
solid lip plus `--game-ui-shadow-button`, so the liquid one needs both too.

`fill`, `merge`, `follow`, `split` and `bead` stay ungrounded on purpose, and a
test says so in case a later reader reads the gap as an oversight: a level that
shadows the groove it is filling has stopped being a level, and a group form's
caller arranges the items and therefore owns the ground they sit on.

---

## What is next, in my judgement

- **The completion record.** See Task A above. Until a lesson activity's result
  goes somewhere, the difficulty a learner chose is invisible to everything
  downstream — progress, review scheduling, and any future 「this was too easy」
  signal. ADR-0010 is the constraint: the learner moves difficulty, the system
  never infers it. Recording what they chose is not inferring.
- **`LiquidMetalButton` / `liquidMetalWebGL.ts` are still unused.** Confirmed
  zero call sites in University, and the showcase gives them a whole section
  while the surface that actually ships now has its own page. Either find them
  a home or propose removing them in a major.
- **A second levelled lesson.** One is enough to prove the pipe; it is not
  enough to know whether the authoring shape survives a `sort` board, where
  difficulty is bucket count and decoys rather than node count.
- **442 lessons still have no activity** (turing-pact 362, ai-foundations 61,
  general 19). They are grandfathered by a date cutoff in `lint-lessons.mjs`,
  and **a rewrite expires that** — so the linter will demand one the moment
  those courses are rewritten. That is intended. Separately,
  `pnpm --filter @pieai/university-local lint:lessons` is red on 69 lessons
  (ai-foundations 61, turing-pact 8), all pre-existing prose debt and none of it
  in `browser-ai`.
- **`revise-course` caps a lesson at three activities.** Three levels use the
  whole allowance, so a lesson that wants a levelled activity *and* a second
  one cannot be proposed. Nothing needs it yet; it will bite the first time
  something does.
- **The `write-lesson` skill was corrected**, not shortened. Fourteen of its
  sixteen invariants are machine-checked and each now names the rule number
  that catches it. If it still feels long, the lever is moving more rules into
  gates, not deleting prose.

---

## Things not to rediscover

These cost real time this round.

1. **Screenshot at device ratio 1.** A capture at `deviceScaleFactor: 3`
   cannot show aliasing or sub-pixel defects — supersampling averages them
   away. Shoot at 1 and magnify the PNG with `image-rendering: pixelated`. Two
   rounds of "looks clean" were taken at 3x and were both wrong.
2. **To measure an edge, recover alpha from two backgrounds** — shoot the same
   element on white and on black, `alpha = 1 - (white - black)/255` — and
   sample along a **straight** edge. A pill's left edge is a curve and its own
   curvature swamps the signal.
3. **`feDisplacementMap` cannot draw a smooth organic outline in Chrome.** It
   resamples nearest-neighbour, so the contour lands only on whole pixels: high
   frequency is per-pixel jitter, low frequency is a single one-pixel step
   across a whole side. Measured, the shipped `waviness` settings moved the
   outline a constant 1.5px and varied it by 0.01px. That is why shape is path
   data now.
4. **`contrast` is not a look.** The goo threshold's alpha crossing is pinned
   at 5/12 of the ramp, so contrast sets edge *width* in px and nothing else:
   `2.5628 * blur / contrast`. Below ~1.3px the edge is thinner than the pixel
   drawing it. `liquidGooeyEdgeContrast` enforces the floor.
5. **A gate that scanned nothing has not passed.** Two scripts in this repo
   resolved `studies/` relative to cwd and exited 0 having found no lessons.
   Both now fail loudly. Check the count in the output, not the exit code.
6. **A rejected jelly material is at `ab3d706` in SwimmerUIKit.** Four lighting
   terms, hue-preserving sheen, luminance-scaled headroom. It was reviewed
   against the existing look and rejected as too abrupt on a coloured body —
   the *motion* from that work is what shipped. Two dead ends inside it are
   worth not repeating: multiplying a fill by a diffuse term darkens a brand
   colour to glazed ceramic, and adding white light at the strength a gel needs
   desaturates it to cream. If Task B revisits material, start there.
7. **Scale constants by the value they were measured at.** A port of that
   material multiplied three terms by `gloss` directly, and forms pass gloss
   3–6 where the constants were tuned at 1 — five times the intended strength,
   which put a hard gold ring around every body. It was caught by looking at a
   real screenshot, not by a test.

8. **Publishing a revision is a separate act, and three commands long.**
   `course revise` refuses an active course, so the sequence is
   `course open-for-edit` → `course revise` → `course reactivate --snapshot
   <id>`. In between, the course is `stale`, and `studies/` is symlinked into
   every worktree — so every sibling branch's `pnpm verify` is blocked for as
   long as the window is open. Chain the three in one command. Then
   `course recovery export` and `pnpm content`, or `check:export-freshness`
   fails and names the exact command.

9. **A gate with two passes can have the rule on only one of them.** The
   difficulty-family rules were on the walk over `studies/` and not on the walk
   over the delivery package, in the same file, forty lines apart. The first
   lesson to use the feature passed on disk and failed on delivery. Both walks
   call one function now; when a rule is added to one walk, add it to the
   function, not to the walk.

10. **Copy that counts something is copy that will be wrong.** 「两条测试路径」
    was a hardcoded two in `play.connect.win`, correct for every board that
    existed when it was written. State the property, not the number.

11. **A disabled `GameButton surface="liquid"` is not a liquid button.** It
    drops the liquid entirely by design, so `.game-ui-liquid-surface` is absent
    from the DOM — which looks exactly like the surface not being applied.
    On the connect board the run button is disabled until one line is drawn.
