import { defineConfig } from "vitest/config";

/**
 * The only thing this file sets, and the reason it exists at all.
 *
 * `MarkdownContent.test.tsx` fetches, parses and renders a syntax-highlighted
 * code block, and its helper already waits up to 5s for that — raised once
 * before, when the suite went red on a laptop that was compiling four other
 * packages at the same time.
 *
 * That fix was half of one. Vitest's own default `testTimeout` is also 5s, so
 * the inner budget equalled the outer budget and the wait could never actually
 * spend it: the test was killed at the same instant the assertion would have
 * been allowed to fail. What you got was "Test timed out in 5000ms", which
 * names the clock instead of the assertion, followed by seven cascading
 * failures reporting empty arrays.
 *
 * An inner wait has to be strictly shorter than the outer deadline or it can
 * only ever produce the less useful of the two messages. 20s of headroom with
 * a 5s wait restores that ordering: a genuinely wrong assertion still fails in
 * five seconds and says what it expected, and a busy machine stops turning
 * that into a red build.
 *
 * Reproduce the failure this fixes with `pnpm -r test`, which runs all four
 * packages at once; `pnpm --filter @pieai/university-ui test` on its own always
 * passed, which is exactly what made it confusing.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
  },
});
