# End-to-end harness

The unit suite is jsdom. The bugs that actually hurt a learner in this round
were all things jsdom cannot see: a HUD that sampled a live WebGL canvas into
a grey brick, an evidence image that overflowed its column because a shared
stylesheet was never imported, a choice that looked like a naked `<button>`,
and tofu glyphs.

This directory is the one implementation of "open a real Chrome and walk the
product". Agents must not write a second CDP screenshot script.

## Run

Specs use descriptive `<feature>.spec.ts` names, not ordering letters. Playwright
discovers them by glob; files must not depend on execution order. Historical
case IDs inside titles stay unchanged so old receipts remain searchable.
`harness/catalogue.ts` is the only E2E published-catalogue reader; select roles
there rather than pinning a course identity in a spec. Root `pnpm lint` and
`pnpm format:check` cover this directory with oxlint and oxfmt.

```bash
pnpm e2e
```

It starts both shells and grading itself (main defaults: online 18093, local
18094, local API 18095, grading 18096),
uses the system Chrome (`channel: "chrome"`), and is **not** part of
`pnpm verify`. A slow gate people skip is worse than no gate.

For a fresh worktree, run `pnpm worktree:prepare .` first. This installs and
prepares the actual inputs, including public account configuration. Its ignored
`.scratch/worktree.json` records the source root and all four E2E ports. Explicit
`E2E_ONLINE_PORT`, `E2E_LOCAL_WEB_PORT`, `E2E_LOCAL_API_PORT` and
`E2E_GRADING_PORT` override those defaults. The pre-push gate sets all four.
Startup refuses busy ports; it never connects silently to another run.

Before baking, the disposable E2E manifest is rebased on this checkout's tracked
manifest. The importer still checks shrinkage against that current baseline;
old evidence receipts beside the cache are not removed. `harness/catalogue.ts`
remains the only E2E role selector for published courses.

## Island look judge

The fixed-pressure visual ruler runs separately from the default e2e project:

```bash
pnpm e2e:island-look
```

It opens the fixed DEV shots at desktop and 390×844, using a 41-lesson pressure
course with `post=off` and `freeze=1`. It writes the canvas-only PNGs and the
per-metric report to `SHOTS/island-look/metrics.json`; `SHOTS/` is ignored, so
no image is committed. The existing contract still labels each metric
`PASS`/`RED`, and a red metric captured on 2026-08-29 remains red-today rather
than being silently blessed. The test fails only when a thresholded metric is
worse than its per-shot/per-viewport captured value. This ratchet is not part
of `pnpm verify` because it needs a browser.

## What it refuses to do

- `element.click()`. The overlay has already lied to that twice.
- `data-testid` hooks in the product. Assertions are innerText, hit-testing,
  painted pixels, and image overflow.
- Playwright's bundled browser download.
