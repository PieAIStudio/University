# AK1 · Evaluate @pieai/swimmer-avatar-kit against packages/avatar. Compare, do not replace.

## What this is, and what it is NOT

`@pieai/swimmer-avatar-kit@0.1.0` was published today. It is the brand-level
extraction of what this repository vendored into `packages/avatar`.

**This task produces a decision, not a migration.** You install the package
alongside the existing code and measure the two against each other. You do not
delete `packages/avatar`, you do not remove any of its files, and you do not
switch the app over to the kit wholesale.

You are on branch `migrate/swimmer-avatar-kit` in a git worktree. `main` is
being edited by another task right now — **stay inside this worktree**. Never
`git checkout`, never touch `/Users/yuanfei/PieAI/University` directly.

Run `pnpm install` first; a fresh worktree has no `node_modules`.

## Background you need

`packages/avatar` is 35 files vendored from `github.com/albertobeiz/kindergrimm`
(Unlicense, public domain). Only the GLOSS line was taken — `src/gloss/**` plus
`src/rng.js` — and a React Three Fiber wrapper `Avatar.tsx` was written on top.
The `.js` files were deliberately **not** rewritten into TypeScript; `.d.ts`
declarations sit beside them. Rewriting 4,000 lines of working art code is the
fastest way to introduce bugs, and that decision stands.

Public API today (`packages/avatar/src/index.ts`):
`Avatar`, `fillRecipe`, `PALETTES`, `PARTS`, `randomRecipe`, `rerollPart`,
`SPECIES`, `type AvatarRecipe`, `dressScene`, `PALETTE_SWATCHES`.

Its only consumer is `apps/online/src/avatar-lab/AvatarLab.tsx`, route
`#/avatar-lab`.

A local checkout of the kit is at `/Users/yuanfei/PieAI/SwimmerAvatarKit`
(read it, do not edit it in this task). Read its `README.md`, `UPSTREAM.md`
and `AGENTS.md` before you compare anything.

## What to do

### 1. Install and stand the two side by side

Add `@pieai/swimmer-avatar-kit@0.1.0` to `apps/online`. Build a comparison
route — `#/avatar-compare` — that renders the **same recipe seed** through both
implementations at once, ours on the left, the kit's on the right. Same camera,
same lighting, same canvas size. A visual claim that is not two pictures of the
same seed side by side is not evidence.

### 2. Produce the four comparisons the instruction asked for

**Functional.** Symbol by symbol: for each of the ten exports above, does the
kit have an equivalent? Name it. Three outcomes only — *same*, *different name
or shape* (give both signatures), *absent*. Do the same in reverse: what does
the kit export that we have no use for yet?

**Visual.** Screenshots of the same seed through both, at minimum 6 seeds
covering different species. Say plainly whether they are identical, or where
they differ. Do not average the answer — "mostly the same" is not a finding;
"the ears differ on the fox species, screenshot attached" is.

**Performance.** Vertex count, first-build time in ms, and steady-state frame
cost, measured the same way for both. The vendored one measured 113,335
vertices and 41ms for a single frame; reproduce that measurement on both.

**Build.** Does `apps/online` typecheck, lint, test and build with the kit
installed? Does `apps/local`? Report bundle size delta.

### 3. Classify every gap into exactly one of three buckets

- **Kit already covers it** — we should use the kit's version.
- **University-specific** — stays here, permanently. Say why it is not
  general.
- **Generic gap** — the kit should grow this. **Do not add it here.** Write
  the proposal into your report: what the API should be, and which of our
  files is the reference implementation. A PR to SwimmerAvatarKit, its tests
  and a new version come first; University upgrades afterwards.

**Known, stated up front: 0.1.0 has no walk/run.** That code stays exactly
where it is. Do not delete it, do not port it, do not flag it as dead.

### 4. What you may change

- `apps/online/package.json` — add the dependency
- a new comparison route and its files
- `pnpm-lock.yaml`

That is the whole list. **Do not delete or edit any file under
`packages/avatar/src/`.** Do not change `AvatarLab.tsx`'s existing behaviour;
add the compare route beside it.

## Hard boundaries

- Nothing under `packages/ui`, `packages/core`, `apps/local/src` except what a
  build check requires you to read.
- Do not edit `/Users/yuanfei/PieAI/SwimmerAvatarKit`. Proposals go in the
  report.
- Do not commit. Leave the worktree dirty; the reviewer will read the diff.
- Do not add any dependency other than the avatar kit.

## Report

`BRIEF-RESULT.md` in this worktree root. Structure it exactly as the four
comparisons above, then the three-bucket classification, then a single
recommendation paragraph: migrate now / migrate after N kit changes / do not
migrate — and the one measurement that decides it.

Every screenshot path listed. Every number reproducible from a command you
name.
