/**
 * One sun for both map projections.
 *
 * Intensity is a multiply: it cannot create range on a smooth dome. Elevation
 * can, because it changes N·L from face to face. Runtime experiments on this
 * island (see `docs/reference/execution/island-look-contract.md`) found the
 * useful window at 16–28°; below that the back faces fall to scene-linear 0
 * and `measureScene().p05` becomes unusable.
 *
 * Colour split is from elemental-serenity `Lighting.class.js` at
 * `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09` (day key `0xfff4e6`, fill
 * `0x87ceeb`). Numbers are re-measured for this dome; the donor's 35° key
 * elevation is rejected because it is still too close to noon here.
 *
 * Azimuth sits just off the course-design look direction so the disc can
 * appear in the far sky (contre-jour) without becoming a centred flare.
 *
 * 2026-08-28 value pass: the settled 1440×900 course capture moved from
 * 9.0 / (0.3 + 0.1 + 0.1) = 18:1 to 5.2 / (1.3 + 0.4 + 0.8) = 2.08:1
 * when the PMREM environment is counted as fill. The canvas pixels below
 * display luminance 0.08 fell from 23.8781% to 11.8286%; the top
 * scene-linear p95 stayed in the same bright band (0.740 → 0.704). The lower hemisphere
 * bounce is deliberately warm, so the remaining shadow keeps hue instead of
 * becoming a neutral black hole.
 */
export const WORLD_SUN = {
  elevationDeg: 20,
  /**
   * From +Z, clockwise in XZ the same way three's spherical azimuth is. The
   * course-design camera sits at 65°, looking toward 245°. 210° is a side-back
   * sun: long shadows stay, but more of the visible dome faces the key.
   */
  azimuthDeg: 210,
  keyIntensity: 5.2,
  keyColor: 0xffefd2,
  hemisphereIntensity: 0.74,
  hemisphereGround: 0x8a5b45,
  ambientIntensity: 0.23,
  ambientColor: 0x9bb8d0,
  /** Light distance as a multiple of the shadowed ground radius. */
  distanceFactor: 2.65,
} as const;

const DEG = Math.PI / 180;

function directionFrom(
  elevationDeg: number,
  azimuthDeg: number,
): readonly [number, number, number] {
  const elevation = elevationDeg * DEG;
  const azimuth = azimuthDeg * DEG;
  const horizontal = Math.cos(elevation);
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation), Math.cos(azimuth) * horizontal];
}

const SUN_DIRECTION = directionFrom(WORLD_SUN.elevationDeg, WORLD_SUN.azimuthDeg);

export function worldSunDirection(): readonly [number, number, number] {
  return SUN_DIRECTION;
}

export function worldSunPosition(distance: number): readonly [number, number, number] {
  const [x, y, z] = worldSunDirection();
  const resolved = Number.isFinite(distance) && distance > 0 ? distance : 40;
  return [x * resolved, y * resolved, z * resolved];
}

export function worldKeyToFillRatio(): number {
  return WORLD_SUN.keyIntensity / (WORLD_SUN.hemisphereIntensity + WORLD_SUN.ambientIntensity);
}

export interface WorldShadowFrustum {
  readonly half: number;
  readonly near: number;
  readonly far: number;
  readonly mapSize: number;
  readonly lightDistance: number;
}

/**
 * Fit the shadow camera to the ground the design shot actually sees, not to
 * the weather sphere. ±0.3 × weather extent left most of a ~70-unit course
 * island unshadowed; stretching the same 2048 map across the whole
 * archipelago made each tree six texels and self-shadowed them black.
 */
export function worldShadowFrustum(groundRadius: number): WorldShadowFrustum {
  const radius = Number.isFinite(groundRadius) && groundRadius > 0 ? groundRadius : 12;
  const half = radius * 1.18;
  const lightDistance = radius * WORLD_SUN.distanceFactor;
  return {
    half,
    lightDistance,
    near: Math.max(0.5, lightDistance - half * 1.45),
    far: lightDistance + half * 1.45,
    mapSize: 2048,
  };
}
