import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import type { PerspectiveCamera } from "three";
import type { AvatarBounds } from "@pieai/swimmer-avatar-kit";
import { previewFrame } from "./preview-frame.js";

/** Refit only for a real recipe/viewport change. A material toggle must never
 * touch the learner's chosen viewing angle or rebuild the avatar. */
export function AvatarPreviewControls({ bounds }: { readonly bounds: AvatarBounds | null }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<Controls>(null);
  useLayoutEffect(() => {
    if (!bounds || !(camera as PerspectiveCamera).isPerspectiveCamera || !controls.current) return;
    const frame = previewFrame(
      bounds,
      (camera as PerspectiveCamera).fov,
      Math.max(1, size.width) / Math.max(1, size.height),
    );
    camera.position.set(0, frame.centreY, frame.distance);
    camera.lookAt(0, frame.centreY, 0);
    controls.current.target.set(0, frame.centreY, 0);
    controls.current.minDistance = frame.minDistance;
    controls.current.maxDistance = frame.distance * 2.5;
    controls.current.update();
    invalidate();
  }, [bounds, camera, size.width, size.height, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.35}
      maxPolarAngle={1.65}
    />
  );
}
