---
id: REF-LIQUID-DIFFICULTY-HANDOFF
title: Liquid UI and difficulty levels — handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-09-11
last_reviewed: 2026-09-11
domain: execution
tags:
  - handoff
  - liquid
  - difficulty
---

# Liquid UI and difficulty levels — handoff

For the session that picks this up cold. Everything below was measured or run,
not assumed; where something is a judgement it says so.

## Where things stand

- Branch `work/course-interactive` in `University-courses`. **Not merged to
  main** on purpose — other worktrees merge together later.
- `@pieai/swimmer-ui-kit` **2.3.0 is published** and all three consuming
  packages are on it. `pnpm verify` green in both repos.
- The brand kit lives at `/Users/yuanfei/PieAI/SwimmerUIKit` (sibling checkout).
  Brand-kit-first: a capability gap gets fixed there and released, never forked
  into the product. Release checklist:
  `SwimmerUIKit/docs/reference/usage-and-upgrade-playbook.md` §本仓发版清单.
  Publishing is `gh workflow run npm-publish.yml --ref main` — never local
  `npm publish` — and it is not published until
  `npm view @pieai/swimmer-ui-kit@<v> version --registry https://registry.npmjs.org/`
  returns.

### What the liquid surface is now

- Shape comes from **path data**, not from a filter. `blobPath` in
  `SwimmerUIKit/src/liquidGooeyGeometry.ts` pours the outline outward along a
  closed Catmull-Rom spline. Outward-only by construction, so the silhouette
  always contains the control's box.
- Material is a single `feSpecularLighting` pass at 22° elevation, scaled by
  each form's `gloss`.
- Motion is `scaleY` (the two scale axes may disagree) plus the `wobbly` spring
  preset — squash and stretch, crossing rest three or four times.
- Six named forms in `liquidGooeyForms.ts`: `press`, `settle`, `merge`,
  `follow`, `fill`, `drain`.
- `GameUiPreview` has a 「Liquid surface」 section. Run `pnpm --dir
  ../SwimmerUIKit dev` (port 5174) or `preview_start` the
  `swimmer-ui-showcase` config in `.claude/launch.json`.

### What the difficulty feature is now

- `LessonActivitySchema` has `family`. Same family + same kind + different
  `difficulty` is one activity at several levels.
- `groupActivityLevels` (core) keys the set by **every member id**, so the
  prose's single `::play{#id}` can point at any of them.
- `LearningActivity` renders the picker when a set has more than one level, and
  defaults to the easiest level authored (V5 「默认先提供入门」).
- Enforced twice — `LessonManifestSchema.superRefine` and
  `apps/local/scripts/check-lesson-activities.mjs`: one engine carries all
  levels, each level appears once, the family is referenced at least once.
- **Nothing authors a family yet.** All 27 written lessons store one level.

---

## Task A — author one lesson's three levels, end to end

The pipe is open and no content has gone through it. Until one lesson does,
nobody knows whether the authoring shape is workable.

1. Pick one browser-ai lesson whose activity has an adjustable difficulty — a
   `connect` or `sort` board is the easiest honest case. Studies live under
   `apps/local/studies/browser-ai/courses/*/units/*/lessons/*/revisions/<n>/`.
2. Write the other two levels as **real payloads**, not scaled numbers. The
   engines deliberately do not multiply anything by difficulty; see
   `packages/core/src/learning-play/difficulty.ts`. What changes is how many
   conditions the learner holds at once — see
   `apps/local/.agents/skills/write-lesson/references/activities.md`
   §三档难度.
3. Give all three the same `family` and the same `kind`, distinct
   `difficulty`. Leave the prose's single `::play{#id}` alone.
4. Land it as a **new revision** — never rewrite revision bytes.
5. Gates: `node apps/local/scripts/check-lesson-activities.mjs` **from the
   repository root**, and `pnpm --filter @pieai/university-local lint:lessons`
   (that one resolves `studies/` relative to cwd and now fails loudly if it
   scanned nothing).
6. Verify in a real browser: open the lesson, confirm the picker defaults to
   入门, switching swaps the board, and the completion record carries the level
   actually played (`ActivityResult.difficulty`).

Acceptance: one lesson where a learner can move between levels, both gates
green, screenshot evidence at device ratio 1.

---

## Task B — a dedicated Liquid page, with the full vocabulary

Liquid is becoming the brand's signature and will keep being upgraded, so it
needs somewhere of its own rather than one section inside the component dump.

**Where:** `SwimmerUIKit`. The showcase site is `index.html` +
`preview/main.tsx` (Vite, port 5174, deploys to swimmer-ui.pieaistudio.com) and
its nav bar already has the shape for a second destination — it links 组件总览
and Storybook today. Add a Liquid page beside them. Keep the section that is
already in `GameUiPreview` or move it; the page is the canonical home either
way.

**What the page has to show,** because these are the questions someone
choosing a form actually asks:

- Every form, live and triggerable, at more than one size — a 44px control and
  a 14px meter behave differently and the clamp is why.
- Each form on every tone (primary / secondary / success / danger) and in both
  themes, because the material adapts to the fill.
- Rest, engaged and disabled side by side with the flat equivalent.
- The knobs written out next to each: blur, contrast, blob amplitude, gloss.

**Forms that do not exist yet.** Six is not the vocabulary, it is where it got
to. Candidates, each with what it would *say*:

| Name | Says | Likely home |
| --- | --- | --- |
| `split` | one body separating into two | undo, branching, "keep both" |
| `swell` | attention without a press | a hint arriving, a new item |
| `reach` | a body stretching toward a target | dragging, making a connection |
| `bead` | many small droplets | counters, tokens, collected items |
| `ripple` | a disturbance crossing a surface | a wrong answer, a rejection |
| `set` | liquid becoming solid | locked, confirmed, submitted |

Build them so they can be **seen and chosen** — that is the point of the page.
But a judgement worth carrying: do not wire a form into the product until it
has a real moment to mark. The recorded finding is that gooey on a static solid
block reads as damage, and that one screen wants one liquid element with one
layer of intent. `merge` and `split` are the signature moves; the rest earn
their place one landing site at a time.

---

## Task C — the liquid body has no shadow under it

**Verified, not a guess.** `LiquidSurface` accepts a `shadow` prop and passes
it through, and **no form sets one**, so every liquid button floats: the flat
button has a lip *and* `--game-ui-shadow-button`, and the liquid one has
neither. That is most of why it reads flatter than it should.

The pattern already exists in the product:
`University-courses/packages/ui/src/cta/LiquidCtaButton.tsx` passes
`shadow="var(--liquid-cta-shadow)"`, defined in `liquid-cta.css` as
`0 5px 10px color-mix(in srgb, var(--game-ui-accent-contrast) 32%, transparent)`
and set to `none` when disabled.

What to do:

1. Give the single-body forms a shadow in `liquidGooeyForms.ts` — `press`,
   `settle` and `drain` at minimum. It belongs in the form bundle, not at every
   call site; that is the whole reason forms exist.
2. Read `SwimmerUIKit/src/liquidGooeyShadow.ts` first. Blurred offset shadows
   **without spread** are compiled to a CSS `drop-shadow()` on the silhouette
   SVG and cost nothing extra; inset and spread stay inside the SVG filter and
   are charged against the filter-area budget. Prefer the compositor form.
3. The shadow must hug the poured outline, not a rectangle — it will, because
   it is applied to the silhouette, but **verify it at device ratio 1**, since
   the shape is irregular and a shadow that follows a rounded rect would be
   obvious and wrong.
4. Check the shadow does not get clipped: the silhouette already paints outside
   the control's box, and a drop-shadow paints outside the filter region on
   purpose.

---

## Also worth doing, in my judgement

- **Liquid is on two surfaces in University.** The activity host's 「下一个」
  and connect's run button, plus `settle` on a sorted chip. The rule that keeps
  it from becoming noise is one liquid control per screen; more boards have a
  completing action that could carry it.
- **`LiquidMetalButton` / `liquidMetalWebGL.ts` are unused.** Confirmed zero
  call sites in University, and the showcase gives them a whole section. They
  require WebGL2 and carry their own budget module. Either find them a home or
  propose removing them in a major.
- **442 lessons still have no activity** (turing-pact 362, ai-foundations 61,
  general 19). They are grandfathered by a date cutoff in
  `lint-lessons.mjs`, and **a rewrite expires that** — so the linter will
  demand one the moment those courses are rewritten. That is intended.
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
