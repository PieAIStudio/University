/**
 * The shared map light rig.
 *
 * `Weather` supplies sky, fog, clouds, and ground atmosphere. This component
 * supplies only the lights and their shadow camera, so changing a surface
 * material does not require opening the environment composition.
 */
import * as THREE from "three";

import { renderTier } from "./tier.js";
import { WORLD_SUN, worldShadowFrustum, worldSunPosition } from "./sun.js";

/**
 * How far the hemisphere's upward fill is pulled off the sky's own stop.
 *
 * The visible sky is a saturated blue by design. Feeding that exact hex to the
 * hemisphere light is not the same decision, and on 2026-09-02 it produced a
 * visible defect: the lesson plinths' bevel is a steep face that the 24° key
 * barely reaches, so it is rendered almost entirely by fill, and a saturated
 * blue fill on an ivory albedo came out teal. The plinths are the one thing on
 * this island a learner clicks, and they had turned a colour nobody chose.
 *
 * A sky is a broadband source; a single most-saturated stop is not its bounce
 * spectrum. Mixing toward a neutral keeps the fill cool — which is what makes
 * the shadows read as sunlight (LOOK-V2 §11 rule 2) — while keeping it from
 * painting neutral surfaces blue. Cool has to mean low-saturation cool.
 */
const HEMISPHERE_SKY_NEUTRALISE = 0.45;

/** The hemisphere's sky term: the sky's own colour, pulled toward neutral. */
export function hemisphereSkyTint(skyMid: number): THREE.Color {
  const tint = new THREE.Color(skyMid);
  // Mix toward a light neutral rather than pure white so the term stays a
  // daylight colour and does not simply become extra exposure.
  return tint.lerp(new THREE.Color(0xd8dee6), HEMISPHERE_SKY_NEUTRALISE);
}

export interface MapLightingProps {
  /** Radius of the ground that the active projection actually exposes. */
  readonly groundRadius: number;
  /** Sky colour used by the hemisphere's upper-facing fill. */
  readonly skyMid: number;
  readonly shadows?: boolean;
}

export function MapLighting({ groundRadius, skyMid, shadows = true }: MapLightingProps) {
  const shadow = worldShadowFrustum(groundRadius);
  const sunPosition = worldSunPosition(shadow.lightDistance);
  const mobile = renderTier() === "mobile";
  const mapSize = mobile ? 1024 : shadow.mapSize;

  return (
    <>
      {/*
        Fill is the denominator of scene-linear range. The current warm lower
        bounce plus blue ambient/PMREM fill is measured at 2.08:1 against the
        5.2 key, so the shadow still reads as a shadow without dropping to black.
      */}
      <hemisphereLight
        args={[
          hemisphereSkyTint(skyMid),
          WORLD_SUN.hemisphereGround,
          WORLD_SUN.hemisphereIntensity,
        ]}
      />
      <ambientLight color={WORLD_SUN.ambientColor} intensity={WORLD_SUN.ambientIntensity} />
      {/*
        `normalBias` is still the acne fix that matters on small curved
        geometry. The frustum itself is fitted to `groundRadius` so the 2048
        map covers the design shot without stretching across the weather
        sphere.
      */}
      <directionalLight
        color={WORLD_SUN.keyColor}
        position={sunPosition}
        intensity={WORLD_SUN.keyIntensity}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-shadow.half}
        shadow-camera-right={shadow.half}
        shadow-camera-top={shadow.half}
        shadow-camera-bottom={-shadow.half}
        shadow-camera-near={shadow.near}
        shadow-camera-far={shadow.far}
        shadow-bias={-0.0002}
        shadow-normalBias={0.06}
      />
      {/* A low cool rim separates the island silhouette from the sky. It has no
          shadow map: this is a fill edge, not another expensive key.

          2026-09-02: 0.78 → 0.34, and 0x8cc9d4 → 0xa6c3d2. Measured, not
          guessed — with the other three fill terms halved, a 0.78 rim became
          the single largest fill in the scene, and its colour is literally a
          saturated teal. Setting it to 0 for one capture is what proved it was
          only part of the blue on the plinth bevels; it also proved the rim is
          doing real work, because the near frame went heavy and dull without
          it. So it stays, at an intensity that is once again small next to the
          key and in a cool grey rather than a cyan. A rim is for silhouette. It
          is not allowed to become the scene's ambient. */}
      <directionalLight
        color={WORLD_SUN.rimColor}
        position={[-sunPosition[0] * 0.82, shadow.lightDistance * 0.44, -sunPosition[2] * 0.82]}
        intensity={WORLD_SUN.rimIntensity}
      />
    </>
  );
}
