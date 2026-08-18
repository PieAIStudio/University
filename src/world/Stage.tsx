/**
 * The one place this product owns a WebGL renderer.
 *
 * This file is the reason the portfolio manifest can drop its
 * `scheduled-migration` exceptions for Web3D baseline rules 1 to 5. Each is
 * answered here or in a file this one imports, and the answers are in one place
 * on purpose: a colour pipeline spread across four components is a pipeline
 * nobody can count the tone maps in.
 *
 *   1. One renderer owner, one loop. There is a single `<Canvas>` in the app,
 *      and `useFrame` at priority 1 takes rendering away from R3F's automatic
 *      pass, so the draw happens exactly once per frame, here.
 *   2. One tone map, one sRGB encode. The scene renders linear into a target;
 *      `grade.ts` does ACES and gamma once, in a shader, and forces the
 *      renderer to leave the result alone. See that file's header.
 *   3. A grade exists and its donor is recorded — again, `grade.ts`.
 *   4. DPR is clamped, with a lower ceiling and no multisampling on small
 *      screens. Below.
 *   5. Audio is latched behind a gesture — `audio.ts`, armed on mount.
 *
 * Rule 8 (mobile and desktop shells) stays an open exception: there is no
 * Capacitor or Electron wrapper yet, so input-intent abstraction and lifecycle
 * pause/resume have nothing to attach to.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

import { armAudioUnlock } from "./audio";
import { createGradePass } from "./grade";

/**
 * A phone is not a small desktop.
 *
 * The clamp is the cheap half of the rule; the tier is the half that matters.
 * A retina phone at DPR 3 renders nine times the pixels of DPR 1 for a map made
 * of flat discs, which buys nothing and costs the frame budget the rest of the
 * lesson needs.
 */
export function renderTier() {
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const small =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 720;
  return coarse || small ? ("mobile" as const) : ("desktop" as const);
}

function Pipeline() {
  const { gl, scene, camera, size, viewport } = useThree();
  const pass = useMemo(() => createGradePass(), []);

  useEffect(() => () => pass.dispose(), [pass]);

  useEffect(() => {
    pass.resize(size.width * viewport.dpr, size.height * viewport.dpr);
  }, [pass, size.width, size.height, viewport.dpr]);

  // Priority above zero: R3F stops rendering for us, and this is the loop.
  useFrame(() => {
    gl.setRenderTarget(pass.target);
    gl.clear();
    gl.render(scene, camera);
    pass.render(gl);
  }, 1);

  return null;
}

export interface StageProps {
  readonly children: ReactNode;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt?: readonly [number, number, number];
}

export function Stage({ children, cameraFrom, lookAt = [0, 0, 0] }: StageProps) {
  const tier = renderTier();

  useEffect(() => armAudioUnlock(), []);

  return (
    <Canvas
      // Rule 4. Two is already generous for flat geometry; a phone gets less.
      dpr={tier === "mobile" ? [1, 1.5] : [1, 2]}
      // Antialiasing on the default framebuffer would be a second, redundant
      // resolve: the scene lands in a multisampled target instead.
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [...cameraFrom], fov: 45, near: 0.5, far: 1200 }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(new THREE.Color(0x0d1019), 1);
        camera.lookAt(new THREE.Vector3(...lookAt));
      }}
      // Nothing animates on its own once the camera settles, so frames are
      // requested rather than burned continuously. A learner reading a lesson
      // beside the map should not hear the fan.
      frameloop="always"
    >
      <Pipeline />
      <fog attach="fog" args={[0x0d1019, 120, 520]} />
      <hemisphereLight args={[0x9fb4d6, 0x1a1f2b, 1.5]} />
      <directionalLight position={[18, 30, 14]} intensity={1.35} color={0xfff2dd} />
      <directionalLight position={[-16, 12, -18]} intensity={0.45} color={0x8fb6ff} />
      {children}
    </Canvas>
  );
}
