import { useCallback, useState } from "react";

export type SceneFailure = "context-lost" | "webgl-unavailable";

/** Keep Stage readiness and map interaction feedback together. */
export function useSceneInteraction() {
  const [mapInteracted, setMapInteracted] = useState(false);
  // Screen 09. False until the kit models inside Stage have committed. The
  // overlay is DOM, so this flag is the only thing Stage has to say.
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailure, setSceneFailure] = useState<SceneFailure | null>(null);
  /** Changing this key remounts the shared canvas after a retry or restore. */
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const onSceneReady = useCallback(() => {
    setSceneReady(true);
    setSceneFailure(null);
  }, []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);
  const onContextLost = useCallback(() => {
    setSceneReady(false);
    setSceneFailure("context-lost");
  }, []);
  const onContextRestored = useCallback(() => {
    setSceneReady(false);
    setSceneFailure(null);
    setSceneAttempt((current) => current + 1);
  }, []);
  const onRendererUnavailable = useCallback(() => {
    setSceneReady(false);
    setSceneFailure("webgl-unavailable");
  }, []);
  const retryScene = useCallback(() => {
    setSceneReady(false);
    setSceneFailure(null);
    setSceneAttempt((current) => current + 1);
  }, []);
  const onMapInteract = useCallback(() => setMapInteracted(true), []);

  return {
    mapInteracted,
    sceneReady,
    sceneFailure,
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
