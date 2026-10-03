import { useCallback, useState } from "react";
import type { View } from "@pieai/university-core";
import type { SceneLoadProgress } from "@pieai/university-world/WorldMapCanvas.js";

export type SceneFailure = "context-lost" | "webgl-unavailable";

/** Reading, opening a chest and returning all retain the same course scene.
 * Real asset loading and context loss still invalidate its readiness normally. */
export function sceneKeyForView(view: View): string {
  return view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
    ? `course:${view.studyId}/${view.courseId}`
    : view.kind;
}

/** Keep Stage readiness and map interaction feedback together. */
export function useSceneInteraction(sceneKey = "scene") {
  const [mapInteracted, setMapInteracted] = useState(false);
  // Screen 09. False until the kit models inside Stage have committed. The
  // overlay is DOM, so this flag is the only thing Stage has to say.
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const sceneReady = readyKey === sceneKey;
  const setSceneReady = useCallback(
    (ready: boolean) => {
      setReadyKey((current) => (ready ? sceneKey : current === sceneKey ? null : current));
    },
    [sceneKey],
  );
  const [load, setLoad] = useState<SceneLoadProgress & { key: string }>({
    key: sceneKey,
    loaded: 0,
    total: 0,
  });
  const onSceneProgress = useCallback(
    (next: SceneLoadProgress) => {
      setLoad((current) =>
        current.key === sceneKey && current.loaded === next.loaded && current.total === next.total
          ? current
          : { ...next, key: sceneKey },
      );
    },
    [sceneKey],
  );
  const [sceneFailure, setSceneFailure] = useState<SceneFailure | null>(null);
  /** Changing this key remounts the shared canvas after a retry or restore. */
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const onSceneReady = useCallback(() => {
    setSceneReady(true);
    setSceneFailure(null);
  }, [setSceneReady]);
  const onSceneBusy = useCallback(() => setSceneReady(false), [setSceneReady]);
  const onContextLost = useCallback(() => {
    setSceneReady(false);
    setSceneFailure("context-lost");
  }, [setSceneReady]);
  const onContextRestored = useCallback(() => {
    setSceneReady(false);
    setSceneFailure(null);
    setSceneAttempt((current) => current + 1);
  }, [setSceneReady]);
  const onRendererUnavailable = useCallback(() => {
    setSceneReady(false);
    setSceneFailure("webgl-unavailable");
  }, [setSceneReady]);
  const retryScene = useCallback(() => {
    setSceneReady(false);
    setSceneFailure(null);
    setSceneAttempt((current) => current + 1);
  }, [setSceneReady]);
  const onMapInteract = useCallback(() => setMapInteracted(true), []);

  return {
    mapInteracted,
    sceneReady,
    sceneFailure,
    sceneProgress: load.key === sceneKey ? load : { loaded: 0, total: 0 },
    onSceneProgress,
    sceneAttempt,
    onSceneReady,
    onSceneBusy,
    onContextLost,
    onContextRestored,
    onRendererUnavailable,
    retryScene,
    onMapInteract,
  };
}
