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
 *
 * 2026-09-02 elevation re-test. The 16–28° window above was measured under the
 * old warm sky and against a scene where nothing cast a shadow, so it was worth
 * re-running once both had changed. Course-design, 1440×900, post=on:
 *
 * | elevation | landLightnessRise | what the picture does |
 * | --- | --- | --- |
 * | 20° | **25.3** | worst picture; half the island falls into one shadow, the
 *   greens go muddy olive, and several lesson plinths sit inside shade |
 * | 24° | 19.8 | kept |
 * | 30° | 14.4 | shadows shorten, the terraces stop reading as steps |
 *
 * 24° stays, and the reason is worth keeping: 20° **scores best** on the metric
 * that is supposed to mean "the land has a light gradient", and is plainly the
 * worst of the three to look at. This is the documented failure mode of
 * `island-look-contract.md` reproduced on purpose — the ratchet is a floor, and
 * an elevation chosen to maximise one of its rows would have shipped a course
 * island whose clickable nodes were in shadow.
 */
export const WORLD_SUN = {
  elevationDeg: 24,
  /**
   * From +Z, clockwise in XZ the same way three's spherical azimuth is. The
   * course-design camera sits at 65°, looking toward 245°. 210° is a side-back
   * sun: long shadows stay, but more of the visible dome faces the key.
   */
  azimuthDeg: 210,
  keyIntensity: 5.4,
  keyColor: 0xffefd2,
  /**
   * 2026-09-02: the three fill terms below were cut to roughly half, because
   * the ratio is the only thing that moves the picture and the numerator
   * cannot move it. The 2026-08-28 note above already records that raising
   * `keyIntensity` did nothing — a multiply scales key and fill together once
   * the PMREM is counted as fill. Halving the denominator is the same
   * arithmetic run the other way, and it is the one that works.
   *
   * The fill is now overwhelmingly blue: the hemisphere's upper half takes the
   * course sky's `mid` stop, which is a saturated blue since the same date, and
   * the PMREM is baked from that sky. That is the warm-key/cool-shadow split of
   * LOOK-V2 §11 rule 2, obtained by pointing existing lights at the new sky
   * rather than by adding a light.
   */
  hemisphereIntensity: 0.38,
  /**
   * Kept warm on purpose, and kept as the one warm term in the fill. It lights
   * down-facing normals only, so it is what stops the undersides of the cliffs
   * from going to a neutral hole once the blue fill above is halved.
   */
  hemisphereGround: 0x8a5b45,
  ambientIntensity: 0.09,
  /**
   * Cool but deliberately desaturated. A first pass at 0x7fa4cc was measurably
   * too saturated: combined with the blue hemisphere it turned the ivory lesson
   * plinths teal (see `lighting.tsx`). Shadows have to keep hue without the
   * fill becoming paint.
   */
  ambientColor: 0xa9bdd4,
  /**
   * The back rim, which is fill and has to be counted as fill.
   *
   * These two lived as literals inside `lighting.tsx`, which is how a 0.78
   * teal light stayed invisible to `sun.test.ts` while that test asserted the
   * scene's key-to-fill ratio from the other three terms. The ratio it checked
   * was therefore never the scene's ratio. Keeping the numbers here is what
   * makes the accounting checkable.
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
