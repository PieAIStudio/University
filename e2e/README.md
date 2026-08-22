# End-to-end harness

The unit suite is jsdom. The bugs that actually hurt a learner in this round
were all things jsdom cannot see: a HUD that sampled a live WebGL canvas into
a grey brick, an evidence image that overflowed its column because a shared
stylesheet was never imported, a choice that looked like a naked `<button>`,
and tofu glyphs.

This directory is the one implementation of "open a real Chrome and walk the
product". Agents must not write a second CDP screenshot script.

## Run

```bash
pnpm e2e
```

It starts both shells itself (online 18093, local 18094, local API 18095),
uses the system Chrome (`channel: "chrome"`), and is **not** part of
`pnpm verify`. A slow gate people skip is worse than no gate.

## What it refuses to do

- `element.click()`. The overlay has already lied to that twice.
- `data-testid` hooks in the product. Assertions are innerText, hit-testing,
  painted pixels, and image overflow.
- Playwright's bundled browser download.
