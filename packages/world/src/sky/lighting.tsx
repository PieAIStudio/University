/**
 * The shared map light rig.
 *
 * `Weather` supplies sky, fog, clouds, and ground atmosphere. This component
 * supplies only the lights and their shadow camera, so changing a surface
 * material does not require opening the environment composition.
 */
import { renderTier } from "./tier.js";
import { WORLD_SUN, worldShadowFrustum, worldSunPosition } from "./sun.js";

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
      <hemisphereLight args={[skyMid, WORLD_SUN.hemisphereGround, WORLD_SUN.hemisphereIntensity]} />
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
      {/* A low cool rim separates the island silhouette from the warm sky. It
          has no shadow map: this is a fill edge, not another expensive key. */}
      <directionalLight
        color={0x8cc9d4}
        position={[-sunPosition[0] * 0.82, shadow.lightDistance * 0.44, -sunPosition[2] * 0.82]}
        intensity={0.78}
      />
    </>
  );
}
