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

/**
 * The interior pass was sized for a long island: its empty lawn lies seven and
 * more units from the road. On a six-lesson island no land is that far out —
 * its bare lawn sits four to seven units away — so every distance, and the
 * grove itself, scales with the island's half-width. Long islands (half-width
 * 36 and more) keep exactly the long-island values.
 */
export function interiorGroveScale(bp: IslandBlueprint): number {
  return bp.bounds.maxHalf >= 36 ? 1 : Math.min(1, Math.max(0.35, bp.bounds.maxHalf / 43));
}

/** How many trees and understorey shrubs one interior grove asks for. */
export const INTERIOR_TREES_PER_GROVE = 5;
export const INTERIOR_SHRUBS_PER_GROVE = 7;
/** Qualifying empty ground (m²) that earns one interior grove, and the most per island. */
export const INTERIOR_LAND_PER_GROVE = 170;
export const INTERIOR_GROVE_LIMIT = 5;

/**
 * Groves for the open land far from the road, sited after every other
 * placement so they only go where the island is still empty. Same field terms
 * as the upland groves; looser only in reach — they may come nearer the road
 * and nearer the plateau rim, which is where the measured emptiness was — and
 * never onto anything already standing.
 */
export function interiorGroves(
  bp: IslandBlueprint,
  field: IslandField,
  standing: readonly (IslandPoint & { readonly radius: number; readonly kind?: string })[],
  existing: readonly IslandPoint[],
): readonly RouteVegetationCentre[] {
  const clearance = islandRouteClearance(bp);
  const k = interiorGroveScale(bp);
  const at = (value: number, floor: number) => Math.max(floor, value * k);
  const roadGap = at(7, 3);
  const land = (x: number, z: number) => {
    const s = sampleIslandField(field, x, z);
    return s.inside && s.shore <= 0.8 && s.rock <= 0.32 && s.grass >= 0.3 ? s : null;
  };
  const trees = standing.filter((p) => p.kind === "tree");
  const emptiness = (x: number, z: number) =>
    trees.reduce((best, p) => Math.min(best, Math.hypot(p.x - x, p.z - z)), Infinity);
  // Only ground that is far from the road AND far from any tree counts as empty.
  let emptyLand = 0;
  for (let x = -bp.bounds.halfX; x <= bp.bounds.halfX; x += 1)
    for (let z = -bp.bounds.halfZ; z <= bp.bounds.halfZ; z += 1)
      if (
        land(x, z) &&
        distanceToIslandRoute(bp, { x, z }) >= clearance + roadGap &&
        emptiness(x, z) >= at(6, 3)
      )
        emptyLand += 1;
  const quota = Math.min(
    INTERIOR_GROVE_LIMIT,
    Math.floor(emptyLand / Math.max(40, INTERIOR_LAND_PER_GROVE * k * k)),
  );
  if (quota === 0) return [];
  const sites: Array<IslandPoint & { score: number }> = [];
  for (let ix = -10; ix <= 10; ix++)
    for (let iz = -10; iz <= 10; iz++) {
      const x = (ix / 14) * bp.bounds.halfX,
        z = (iz / 14) * bp.bounds.halfZ;
      const s = land(x, z);
      if (!s) continue;
      const distance = distanceToIslandRoute(bp, { x, z });
      if (distance < clearance + roadGap) continue;
      if (existing.some((p) => Math.hypot(p.x - x, p.z - z) < at(9, 4))) continue;
      if (standing.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + at(3, 1.5))) continue;
      if (Math.hypot(bp.hero.x - x, bp.hero.z - z) < bp.hero.radius + at(7, 3)) continue;
      const reach = at(3, 1.5);
      const covered = [
        [-reach, -reach],
        [reach, -reach],
        [reach, reach],
        [-reach, reach],
      ].every(([dx, dz]) => {
        const a = sampleIslandField(field, x + dx!, z + dz!);
        return (
          a.inside &&
          a.shore < 0.86 &&
          distanceToIslandRoute(bp, { x: x + dx!, z: z + dz! }) > clearance + reach
        );
      });
      if (!covered) continue;
      sites.push({
        x,
        z,
        score: s.grass * 1.4 - s.rock * 1.1 + Math.min(emptiness(x, z), 12) * 0.08,
      });
    }
  sites.sort((a, b) => b.score - a.score || a.x - b.x || a.z - b.z);
  const result: RouteVegetationCentre[] = [];
  for (const site of sites) {
    if (result.length >= quota) break;
    if (result.some((p) => Math.hypot(p.x - site.x, p.z - site.z) < at(10, 5))) continue;
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
