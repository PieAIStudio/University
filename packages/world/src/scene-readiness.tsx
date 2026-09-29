import { useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useLayoutEffect, useRef } from "react";
import type { Object3D } from "three";
import { AVATAR_OCCLUSION_TARGET } from "./avatar/avatar-occlusion.js";

export interface SceneLoadProgress {
  readonly loaded: number;
  readonly total: number;
}

/** One Stage's unfinished React branches, including nested Suspense boundaries. */
export const SceneReadinessContext = createContext<Set<symbol> | null>(null);

/** A loading fallback with no pixels. Readable loading information stays in DOM. */
export function ScenePending() {
  const pending = useContext(SceneReadinessContext);
  useLayoutEffect(() => {
    const token = Symbol("scene-pending");
    pending?.add(token);
    return () => {
      pending?.delete(token);
    };
  }, [pending]);
  return null;
}

/** The kit builds an avatar after commit; its empty placement group is not a drawn avatar. */
export function sceneAvatarsBuilt(scene: Object3D): boolean {
  let ready = true;
  scene.traverse((object) => {
    if (object.name !== AVATAR_OCCLUSION_TARGET) return;
    let hasMesh = false;
    object.traverse((child) => {
      if ((child as Object3D & { isMesh?: boolean }).isMesh) hasMesh = true;
    });
    if (!hasMesh) ready = false;
  });
  return ready;
}

/** Report only after the existing output pass has drawn every required branch. */
export function ScenePresence({
  sceneKey,
  dataReady,
  onReady,
  onBusy,
  onProgress,
}: {
  readonly sceneKey: string;
  readonly dataReady: boolean;
  readonly onReady?: () => void;
  readonly onBusy?: () => void;
  readonly onProgress?: (progress: SceneLoadProgress) => void;
}) {
  const pending = useContext(SceneReadinessContext);
  const reported = useRef(false);
  const lastProgress = useRef<SceneLoadProgress | null>(null);
  useLayoutEffect(() => {
    reported.current = false;
    onBusy?.();
    lastProgress.current = null;
    return () => onBusy?.();
  }, [sceneKey, onReady, onBusy]);
  // Pipeline owns priority 1. Never add a renderer or guess readiness from a timer.
  useFrame(({ scene }) => {
    // useGLTF starts requests while its component renders. Subscribing React
    // to that loading store can update this component inside the other render.
    // Read the SAME real store in the existing frame callback instead; no
    // extra subscription, timer, loader, or renderer is introduced.
    const { active, loaded, total } = useProgress.getState();
    if (lastProgress.current?.loaded !== loaded || lastProgress.current?.total !== total) {
      lastProgress.current = { loaded, total };
      onProgress?.(lastProgress.current);
    }
    if (!dataReady || active || (pending?.size ?? 0) > 0) {
      if (reported.current) {
        reported.current = false;
        onBusy?.();
      }
      return;
    }
    if (reported.current || !sceneAvatarsBuilt(scene)) return;
    reported.current = true;
    onReady?.();
  }, 2);
  return null;
}
