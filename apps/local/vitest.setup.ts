/**
 * jsdom ships no `ResizeObserver`, and the app tests render the whole shell.
 *
 * The nav rail's foot now holds the learner's avatar, which is an R3F
 * `<Canvas>`, and R3F measures its host with `react-use-measure` — which throws
 * outright rather than degrading when the observer is missing. Before the
 * avatar reached this shell nothing in these tests reached a canvas, so the gap
 * had never been visible.
 *
 * A stub, not a polyfill: these tests assert what the shell renders, never how
 * big it is, so a zero-size observer that never fires is the whole truth they
 * need. A real polyfill would add a dependency to make a canvas measure itself
 * in a document that has no layout to measure.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    NoopResizeObserver;
}
