/**
 * The world scene owns one WebGL renderer. Avatar previews are separate small
 * viewports because they live in different DOM positions and have a different
 * job from the world map.
 *
 * Canvas mount registry (the source gate checks this list):
 *   - `packages/world/src/Stage.tsx` — world, map and planet renderer
 *   - `packages/world/src/avatar/AvatarChip.tsx` — persistent navigation avatar
 *   - `apps/university/src/app/ProfileAvatar.tsx` — profile-page avatar
 *   - `apps/university/src/avatar-lab/AvatarLab.tsx` — avatar-workshop preview
 *
 * This file documents the world renderer's answers to the portfolio's
 * `scheduled-migration` exceptions for Web3D baseline rules 1 to 5. The small
 * avatar viewports follow the same per-viewport ownership rule and are listed
 * below; keeping the world colour pipeline here means nobody has to count tone
 * maps spread across four unrelated components.
 *
 *   1. One renderer owner, one loop per viewport. Stage owns the world loop;
 *      each small avatar viewport owns only its own preview loop. `useFrame` at
 *      priority 1 takes rendering away from R3F's automatic pass, so the world
 *      draw happens exactly once per frame, here.
 *   2. One tone map, one sRGB encode. The scene renders linear into a target;
 *      `ao.ts` may darken that linear colour (desktop only); `grade.ts` then
 *      runs the kit's standalone blit (ACES, then grade, then one sRGB encode)
 *      and forces `toneMapping` to `NoToneMapping` while that blit runs, so
 *      the renderer does not add a second pair. The kit guard asserts the
 *      count in development, below. AO is skipped on the mobile tier.
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
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { armSoundUnlock } from "@pieai/university-ui/sound/index.js";
import { createAoPass } from "./island/ao";
import { assertWorldGradePipeline, createGradePass } from "./island/grade";
import { renderTier } from "./sky/tier";

function Pipeline({ ambientOcclusion }: { readonly ambientOcclusion: boolean }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const pass = useMemo(() => createGradePass(), []);
  const ao = useMemo(() => (ambientOcclusion ? createAoPass() : null), [ambientOcclusion]);
  // Recomputed each render is fine: the viewport does not change mid-frame,
  // and the mobile skip has to follow a rotate-to-landscape the way dpr does.
  const mobile = renderTier() === "mobile";

  useEffect(() => () => pass.dispose(), [pass]);
  useEffect(() => () => ao?.dispose(), [ao]);

  useEffect(() => {
    const width = size.width * viewport.dpr;
    const height = size.height * viewport.dpr;
    pass.resize(width, height);
    ao?.resize(width, height);
  }, [pass, ao, size.width, size.height, viewport.dpr]);

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
    // AO before the encode. On a phone the directional map is the contact
    // shadow we can afford; this pass is the desktop crease.
    if (ao && !mobile && pass.target.depthTexture) {
      ao.render(gl, pass.target, camera);
      pass.render(gl, ao.target.texture);
    } else {
      pass.render(gl);
    }
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
    renderer: {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      lines: gl.info.render.lines,
      points: gl.info.render.points,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
    },
  };
}

/**
 * Fires when the kit models inside Suspense have committed, and again when
 * they suspend. The fallback stays `null` on purpose: a word inside the
 * canvas is geometry, and readable text is DOM. The overlay that uses these
 * callbacks lives next to the canvas, not in it.
 */
function ScenePresence({
  onReady,
  onBusy,
}: {
  readonly onReady?: () => void;
  readonly onBusy?: () => void;
}) {
  useLayoutEffect(() => {
    onReady?.();
    return () => onBusy?.();
  }, [onReady, onBusy]);
  return null;
}

interface StageProps {
  readonly children: ReactNode;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt?: readonly [number, number, number];
  /** The DOM overlay's cue that the first real scene has committed. */
  readonly onSceneReady?: () => void;
  /** The DOM overlay's cue that kit models have gone back into flight. */
  readonly onSceneBusy?: () => void;
  /**
   * A click that hit no island. Island `onClick` already stopPropagates, so
   * this is "the ray hit nothing the scene cares about".
   *
   * Why `onPointerMissed`, not a document click listener: island and sea are
   * the same `<canvas>` node. A DOM target cannot tell them apart; R3F's
   * raycaster already did. Only objects with pointer handlers (the islands)
   * are tested, so a miss is sea, sky, empty. R3F also drops the event when
   * the pointer moved more than 2px, so a pan is not a miss. A document
   * listener would fire for 「进入这门课」 itself and for every rail button,
   * and we would have to guess which clicks were "outside".
   */
  readonly onPointerMissed?: (event: MouseEvent) => void;
  /**
   * The canvas is on the page but nobody is looking at it.
   *
   * The shells keep this canvas mounted across routes rather than tearing it
   * down: rebuilding the archipelago costs a visible stall, and destroying a
   * WebGL context to get it back a moment later is the expensive way to save
   * nothing. But `display: none` does not stop a render loop, so a learner
   * reading a lesson beside a hidden map was paying for sixty frames a second
   * of a scene behind an opaque panel — and now that the planet has a canvas of
   * its own, paying for two.
   */
  readonly paused?: boolean;
  /**
   * The screen-space crease pass. On by default; a scene made of one big
   * curved body wants it off.
   *
   * The pass is a 16-tap spiral kernel with no bilateral blur, which is the
   * right trade over a field of small islands — the creases land in contact
   * shadows and read as weight. Put a marker in front of a sphere and the same
   * sixteen taps straddle one steep depth edge instead, so each one darkens a
   * different pixel and the result is a ring of black petals around the thing
   * you just selected. Measured on the planet picker, where it looked like a
   * corrupted texture rather than a shadow.
   *
   * Blurring the pass would fix both, and is the better answer when there is a
   * second scene that needs it. One switch is the honest amount of machinery
   * for one scene.
   */
  readonly ambientOcclusion?: boolean;
}

export function Stage({
  children,
  cameraFrom,
  lookAt = [0, 0, 0],
  onSceneReady,
  onSceneBusy,
  onPointerMissed,
  paused = false,
  ambientOcclusion = true,
}: StageProps) {
  const tier = renderTier();

  useEffect(() => armSoundUnlock(), []);

  return (
    <Canvas
      // Rule 4. Two is already generous for flat geometry; a phone gets less.
      dpr={tier === "mobile" ? [1, 1.5] : [1, 2]}
      // Antialiasing on the default framebuffer would be a second, redundant
      // resolve: the scene lands in a multisampled target instead.
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      // The element colour, before WebGL has a clear colour. Default WebGL
      // clear is #000; this matches the page so a frame that lands before
      // `onCreated` is a dark page, not a broken one. The DOM overlay still
      // covers this — belt, not the actual loading screen.
      style={{ background: "var(--game-ui-bg, #0d1019)" }}
      // Mobile chrome occupies the top course card and the bottom tab bar.
      // A slightly wider lens is the shared 3D safe-area treatment: it keeps
      // the same target and tilt, but fits the current island plus the next
      // few nodes into the unobscured middle instead of cropping both ends.
      camera={{ position: [...cameraFrom], fov: tier === "mobile" ? 42 : 34, near: 0.5, far: 1200 }}
      onPointerMissed={onPointerMissed}
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
      // as stickers. A phone gets the cheap filter; everything else gets PCF.
      //
      // `"percentage"` rather than `"soft"`, and that is not a downgrade — it
      // is what was already on screen. three 0.185 deprecated
      // `PCFSoftShadowMap` and silently rewrites it to `PCFShadowMap` on the
      // first shadow render, warning once per canvas. So this file asked for
      // soft, the comment above it promised soft, and the renderer had been
      // drawing PCF the whole time.
      //
      // Genuinely soft shadows now mean `"variance"` (VSM) plus a tuned
      // `shadow.radius`, and VSM light-bleeds through thin geometry — the
      // islands are thin plates. That is a look to choose on purpose with the
      // scene in front of you, not a word to swap in a comment.
      shadows={tier === "mobile" ? "basic" : "percentage"}
      // `always` while anyone is looking: the beacon pulses, the controls
      // damp, and the clouds drift, so there is no settled state to stop at.
      // `never` the moment the canvas is hidden — that is the only thing here
      // that was ever burning frames for nobody.
      frameloop={paused ? "never" : "always"}
    >
      <Pipeline ambientOcclusion={ambientOcclusion} />
      {/*
        Sky, sun, fog and sea belong to the scene rather than to this file. The
        two map levels are the same world at two scales, and their fog has to
        start where their own islands end — a single distance set here was
        either a wall in front of the world map or nothing at all inside a
        course. See `Weather` in Maps.tsx.

        Suspense is load-bearing: the kit models stream in, and without a
        boundary the first `useGLTF` would throw the whole canvas away. The
        fallback is still `null` — a sentence drawn here would be geometry.
      */}
      <Suspense fallback={null}>
        <ScenePresence onReady={onSceneReady} onBusy={onSceneBusy} />
        {children}
      </Suspense>
    </Canvas>
  );
}
