/** A long course can contain a large meadow between route bends. Two
 * terrain-derived upland groves give that space an edge and a centre, while
 * keeping a broad open clearing. These are not arbitrary backdrop scatter:
 * sites read the existing grass/slope/height field and actual route/facilities.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import type { RouteVegetationCentre } from "./island-dressing.js";
import { sampleIslandField, type IslandField } from "./island-field.js";
import {
  distanceToIslandRoute,
  islandRouteFrameAtFraction,
  islandRouteClearance,
} from "./island-route-geometry.js";
export const UPLAND_GROVE_LIMIT = 2;
export function uplandGroves(
  bp: IslandBlueprint,
  field: IslandField,
  occupied: readonly (IslandPoint & { readonly radius: number })[],
  existing: readonly IslandPoint[],
): readonly RouteVegetationCentre[] {
  if (bp.lessonCount <= 12) return [];
  const quota = bp.lessonCount > 24 ? UPLAND_GROVE_LIMIT : 1;
  const sites: Array<IslandPoint & { score: number }> = [];
  const clearance = islandRouteClearance(bp);
  for (let ix = -5; ix <= 5; ix++)
    for (let iz = -5; iz <= 5; iz++) {
      const x = (ix / 7) * bp.bounds.halfX,
        z = (iz / 7) * bp.bounds.halfZ;
      const s = sampleIslandField(field, x, z),
        point = { x, z };
      if (!s.inside || s.shore > 0.7 || s.rock > 0.32 || s.grass < 0.3) continue;
      const distance = distanceToIslandRoute(bp, point);
      if (distance < clearance + 10 || distance > bp.bounds.maxHalf * 0.6) continue;
      if (existing.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) continue;
      if (occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 6)) continue;
      if (Math.hypot(bp.hero.x - x, bp.hero.z - z) < bp.hero.radius + 7) continue;
      const covered = [
        [-4, -4],
        [4, -4],
        [4, 4],
        [-4, 4],
      ].every(([dx, dz]) => {
        const p = { x: x + dx!, z: z + dz! },
          a = sampleIslandField(field, p.x, p.z);
        return a.inside && a.shore < 0.82 && distanceToIslandRoute(bp, p) > clearance + 4;
      });
      if (!covered) continue;
      sites.push({
        x,
        z,
        score: s.grass * 1.4 - s.rock * 1.1 + (s.height / bp.bounds.maxHalf) * 0.9,
      });
    }
  sites.sort((a, b) => b.score - a.score || a.x - b.x || a.z - b.z);
  const result: RouteVegetationCentre[] = [];
  for (const site of sites) {
    if (result.length >= quota) break;
    if (result.some((p) => Math.hypot(p.x - site.x, p.z - site.z) < 14)) continue;
    const nearest = bp.centerline.reduce(
      (best, p) =>
        Math.hypot(p.x - site.x, p.z - site.z) < Math.hypot(best.x - site.x, best.z - site.z)
          ? p
          : best,
      bp.centerline[0]!,
    );
    const frame = islandRouteFrameAtFraction(bp, nearest.t);
    if (!frame) continue;
    const side =
      Math.sign(
        (site.x - frame.point.x) * frame.baseNormal.x +
          (site.z - frame.point.z) * frame.baseNormal.z,
      ) || 1;
    result.push({
      x: site.x,
      z: site.z,
      routeFraction: nearest.t,
      side,
      tangent: frame.tangent,
      normal: { x: frame.baseNormal.x * side, z: frame.baseNormal.z * side },
    });
  }
  return result;
}
