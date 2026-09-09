/**
 * One sun for both map projections.
 *
 * Elevation is candidate 40° (moved from 24°). On continuous-terrain course islands
 * with natural ~22° median slopes, 24° caused grazing incidence on lit slopes (p05 ~4.2°)
 * and extreme shadow lengths (>13x caster height), leading to severe self-shadowing acne.
 * 40° lifts glancing slope incidence to ~20° while maintaining directional relief
 * and miniature diorama readability.
 *
 * Fill terms: hemisphere 0.90 (from 0.38) and ambient 0.22 (from 0.09), with rim 0.34
 * and environment 0.16 unchanged. Shaded slope irradiance reaches ~1.28–1.30, preventing
 * the post-grade contrast stretch from crushing shadow channels to zero.
 *
 * Azimuth sits just off the course-design look direction (210° vs camera 65°->245°)
 * so the disc appears in the far sky (contre-jour) without becoming a centred flare.
 */
export const WORLD_SUN = {
  elevationDeg: 40,
  /**
   * From +Z, clockwise in XZ the same way three's spherical azimuth is. The
   * course-design camera sits at 65°, looking toward 245°. 210° is a side-back
   * sun: long shadows stay, but more of the visible dome faces the key.
   */
  azimuthDeg: 210,
  keyIntensity: 5.4,
  keyColor: 0xffefd2,
  /**
   * Upper hemisphere fill from sky mid stop. Restored to 0.90 so shaded slopes
   * keep chromatic color and do not fall below the grade contrast clip floor.
   */
  hemisphereIntensity: 0.9,
  /**
   * Kept warm on purpose to light down-facing normals and cliff undersides.
   */
  hemisphereGround: 0x8a5b45,
  /**
   * Desaturated cool ambient fill, raised to 0.22 to support open shadow values.
   */
  ambientIntensity: 0.22,
  ambientColor: 0xa9bdd4,
  /**
   * The back rim, which provides silhouette separation against sky.
   */
  rimIntensity: 0.34,
  rimColor: 0xa6c3d2,
  /** Light distance as a multiple of the shadowed ground radius. */
  distanceFactor: 2.65,
} as const;

/**
 * Every fill term in the rig, including the rim and the PMREM environment.
 *
 * `worldKeyToFillRatio` deliberately stays the narrow hemisphere+ambient
 * accounting some older notes quote. This is the whole denominator.
 */
export function worldTotalFill(environmentIntensity: number): number {
  return (
    WORLD_SUN.hemisphereIntensity +
    WORLD_SUN.ambientIntensity +
    WORLD_SUN.rimIntensity +
    environmentIntensity
  );
}

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

/**
 * Compute directional shadow normalBias scaled to shadow-map texel size in world units.
 *
 * `normalBias` pushes shadow receiver lookups along the surface normal. To clear
 * self-shadowing acne on continuous terrain slopes down to ~14° incidence, the normal
 * offset must cover approximately `texel / tan(minIncidence)`. For typical continuous
 * terrain slopes, this requires ~4x the world-space texel size.
 *
 * Scaled with `frustum.half * 2 / mapSize` so desktop (2048) and mobile (1024)
 * each get the bias their respective texel size requires (~0.14–0.18 on desktop 34u,
 * ~0.28–0.32 on mobile 34u). Clamped to [0.04, 0.40] to avoid detached shadows
 * (peter-panning) on large bounds while providing clean clearance on small ones.
 */
export function worldShadowNormalBias(
  frustum: Pick<WorldShadowFrustum, "half">,
  mapSize: number,
): number {
  const resolvedHalf = Number.isFinite(frustum.half) && frustum.half > 0 ? frustum.half : 14.16;
  const resolvedMapSize = Number.isFinite(mapSize) && mapSize > 0 ? mapSize : 2048;
  const texelSize = (resolvedHalf * 2) / resolvedMapSize;
  const rawBias = texelSize * 4.0;
  return Math.min(0.4, Math.max(0.04, +rawBias.toFixed(4)));
}
