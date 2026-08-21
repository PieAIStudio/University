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
 *      `grade.ts` runs the kit's standalone blit (ACES, then grade, then one
 *      sRGB encode) and forces `toneMapping` to `NoToneMapping` while that
 *      blit runs, so the renderer does not add a second pair. The kit guard
 *      asserts the count in development, below.
 *   3. A grade exists — `grade.ts` starts from the kit's `diorama` preset and
 *      records the scene-specific overrides.
 *   4. DPR is clamped, with a lower ceiling and no multisampling on small
 *      screens. Below.
 *   5. Audio is latched behind a gesture — `audio.ts`, armed on mount.
 *
 * Rule 8 (mobile and desktop shells) stays an open exception: there is no
 * Capacitor or Electron wrapper yet, so input-intent abstraction and lifecycle
 * pause/resume have nothing to attach to.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { armSoundUnlock } from "@pieai/university-ui/sound/index.js";
import { assertWorldGradePipeline, createGradePass } from "./grade";

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

  // The kit guard is the reason the package exists: double tone-map / double
  // sRGB encode fails silently. Gate on DEV because the kit does not sniff
  // NODE_ENV; a shipped build must not throw. The renderer is the live R3F
  // canvas, which is the configuration a wrong `outputOwner` would mis-count.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    assertWorldGradePipeline(gl);
  }, [gl]);

  // Priority above zero: R3F stops rendering for us, and this is the loop.
  const measuring = useRef<((report: unknown) => void) | null>(null);

  useFrame(() => {
    gl.setRenderTarget(pass.target);
    gl.clear();
    gl.render(scene, camera);
    // Read while the target is still bound and freshly written. Sampling it
    // from outside the loop reads a multisample buffer nobody has resolved yet,
    // which returns plausible-looking numbers that are not the picture.
    if (measuring.current) {
      measuring.current(sample(gl, pass.target));
      measuring.current = null;
    }
    pass.render(gl);
  }, 1);

  // Baseline rule 3 says a grade must have recorded provenance, and the shared
  // rule adds that a donor's constants have to be re-measured rather than
  // inherited. This is what makes that a measurement instead of a claim.
  // Development only, and called by hand: `await measureScene()`.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (globalThis as unknown as { measureScene?: () => Promise<unknown> }).measureScene = () =>
      new Promise((resolve) => {
        measuring.current = resolve;
      });
  }, []);

  return null;
}

/** Luminance percentiles of the linear scene, before the grade sees it. */
function sample(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
  const { width, height } = target;
  // Half-float, because an 8-bit read would clip exactly the highlights the
  // pivot is being chosen against.
  const pixels = new Uint16Array(width * height * 4);
  gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  const half = THREE.DataUtils.fromHalfFloat;
  const luma: number[] = [];
  // A prime stride, so a regular scene is not sampled down one repeating column.
  for (let index = 0; index < pixels.length; index += 4 * 41) {
    luma.push(
      0.299 * half(pixels[index]!) +
        0.587 * half(pixels[index + 1]!) +
        0.114 * half(pixels[index + 2]!),
    );
  }
  luma.sort((a, b) => a - b);
  const at = (share: number) => +luma[Math.floor(luma.length * share)]!.toFixed(3);
  return {
    samples: luma.length,
    p05: at(0.05),
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p95: at(0.95),
    max: +luma[luma.length - 1]!.toFixed(3),
  };
}

export interface StageProps {
  readonly children: ReactNode;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt?: readonly [number, number, number];
}

export function Stage({ children, cameraFrom, lookAt = [0, 0, 0] }: StageProps) {
  const tier = renderTier();

  useEffect(() => armSoundUnlock(), []);

  return (
    <Canvas
      // Rule 4. Two is already generous for flat geometry; a phone gets less.
      dpr={tier === "mobile" ? [1, 1.5] : [1, 2]}
      // Antialiasing on the default framebuffer would be a second, redundant
      // resolve: the scene lands in a multisampled target instead.
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [...cameraFrom], fov: 34, near: 0.5, far: 1200 }}
      onCreated={(state) => {
        state.gl.setClearColor(new THREE.Color(0x0d1019), 1);
        state.camera.lookAt(new THREE.Vector3(...lookAt));
        // A handle on the live scene, in development only. Every 3D bug worth
        // the name is invisible from the outside — a camera pointing at empty
        // space and a scene that failed to populate look identical in a
        // screenshot, and only one of them is fixed by moving the camera.
        if (import.meta.env.DEV) {
          (globalThis as unknown as { three?: unknown }).three = state;
        }
      }}
      // Shadows are what make flat-shaded low poly read as solid rather than
      // as stickers. Soft on desktop; a phone gets the cheap filter, because a
      // 2048 PCF-soft map is most of a mobile frame budget on its own.
      shadows={tier === "mobile" ? "basic" : "soft"}
      // Nothing animates on its own once the camera settles, so frames are
      // requested rather than burned continuously. A learner reading a lesson
      // beside the map should not hear the fan.
      frameloop="always"
    >
      <Pipeline />
      {/*
        Sky, sun, fog and sea belong to the scene rather than to this file. The
        two map levels are the same world at two scales, and their fog has to
        start where their own islands end — a single distance set here was
        either a wall in front of the world map or nothing at all inside a
        course. See `Weather` in Maps.tsx.

        Suspense is load-bearing: the kit models stream in, and without a
        boundary the first `useGLTF` would throw the whole canvas away.
      */}
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
