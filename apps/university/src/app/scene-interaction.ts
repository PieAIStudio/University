import { useCallback, useState } from "react";

/** Keep Stage readiness and map interaction feedback together. */
export function useSceneInteraction() {
  const [mapInteracted, setMapInteracted] = useState(false);
  // Screen 09. False until the kit models inside Stage have committed. The
  // overlay is DOM, so this flag is the only thing Stage has to say.
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);
  const onMapInteract = useCallback(() => setMapInteracted(true), []);

  return { mapInteracted, sceneReady, onSceneReady, onSceneBusy, onMapInteract };
}
