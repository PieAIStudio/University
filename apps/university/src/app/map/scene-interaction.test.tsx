// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { View } from "@pieai/university-core";
import { useMapCoverState } from "@pieai/university-ui/loading/LoadingTrivia.js";
import { sceneKeyForView, useSceneInteraction } from "./scene-interaction";

const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" };
let view: View;
let state: ReturnType<typeof useSceneInteraction>;
let cover: ReturnType<typeof useMapCoverState>;
let host: HTMLDivElement, root: Root;
function Probe() {
  state = useSceneInteraction(sceneKeyForView(view));
  cover = useMapCoverState(!state.sceneReady, state.sceneAttempt);
  return null;
}
async function render(next: View) {
  view = next;
  await act(async () => root.render(<Probe />));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

describe("readiness belongs to the retained island, not its lesson URL", () => {
  it("does not cover an already drawn chest's island while Continue returns to its map", async () => {
    await render({ kind: "settled", ...locator });
    await act(async () => state.onSceneReady());
    expect(cover.cover).toBe(false);
    const ready = state.onSceneReady;
    await render({ kind: "course", studyId: "s", courseId: "c" });
    // No new model or terrain was requested. Withhold another frame beyond
    // the EXISTING two-second cover threshold to expose route-only resets.
    await act(async () => vi.advanceTimersByTimeAsync(2100));
    expect(cover.cover, "the same drawn island must not reload for wrap-up").toBe(false);
    expect(state.sceneReady).toBe(true);
    expect(state.onSceneReady).toBe(ready);
  });
  it("names a course consistently through reading and opening, including a one-lesson course", () => {
    const key = sceneKeyForView({ kind: "course", studyId: "s", courseId: "c" });
    expect(sceneKeyForView({ kind: "lesson", ...locator })).toBe(key);
    expect(sceneKeyForView({ kind: "settled", ...locator })).toBe(key);
    expect(sceneKeyForView({ kind: "settled", ...locator, courseId: "other" })).not.toBe(key);
    expect(sceneKeyForView({ kind: "world" })).not.toBe(key);
  });
  it("still waits for a different island and rejects the old island's late readiness callback", async () => {
    await render({ kind: "course", studyId: "s", courseId: "c" });
    await act(async () => state.onSceneReady());
    const oldReady = state.onSceneReady;
    await render({ kind: "course", studyId: "s", courseId: "other" });
    await act(async () => oldReady());
    expect(state.sceneReady).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(2100));
    expect(cover.cover).toBe(true);
    await act(async () => state.onSceneReady());
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(cover.cover).toBe(false);
  });
  it("still invalidates a retained island for real loading, context loss and retry", async () => {
    await render({ kind: "course", studyId: "s", courseId: "c" });
    await act(async () => state.onSceneReady());
    await act(async () => state.onSceneBusy());
    expect(state.sceneReady).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(2100));
    expect(cover.cover).toBe(true);
    await act(async () => state.onContextLost());
    expect(state.sceneFailure).toBe("context-lost");
    await act(async () => state.onContextRestored());
    expect(state.sceneAttempt).toBe(1);
    expect(state.sceneReady).toBe(false);
    await act(async () => state.retryScene());
    expect(state.sceneAttempt).toBe(2);
    expect(state.sceneReady).toBe(false);
  });
});
