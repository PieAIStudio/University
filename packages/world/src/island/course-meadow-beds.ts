/** Low meadow beds read the existing field and the actual reserved scenery.
 * They are a bounded composition of open ground, not a second biome raster.
 * No camera, progress, terrain edit or per-course authored coordinate enters.
 */
import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { hash } from "./random.js";

export interface MeadowBed extends IslandPoint {
  readonly id: string;
  readonly radius: number;
  readonly count: number;
  readonly meadow: true;
  readonly sheltered: boolean;
}

export function courseMeadowBeds(
  blueprint: IslandBlueprint,
  occupied: readonly (IslandPoint & {
    readonly radius: number;
    readonly kind?: string;
    readonly height?: number;
  })[],
): readonly MeadowBed[] {
  const field = islandFieldFor(blueprint);
  const clearance = islandRouteClearance(blueprint);
  const trees = occupied.filter((p) => p.kind === "tree");
  const quota = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(blueprint.lessonCount))));
  const candidates: (MeadowBed & { readonly score: number })[] = [];
  for (let ix = -8; ix <= 8; ix++) {
    for (let iz = -8; iz <= 8; iz++) {
      const id = `meadow/${ix}/${iz}`;
      const jitter = hash(`${blueprint.seed}/${id}`);
      const x = ((ix + jitter * 0.6 - 0.3) / 10) * blueprint.bounds.halfX;
      const z =
        ((iz + hash(`${blueprint.seed}/${id}/z`) * 0.6 - 0.3) / 10) * blueprint.bounds.halfZ;
      const s = sampleIslandField(field, x, z);
      if (!s.inside || s.grass < 0.3 || s.rock > 0.42 || s.shore > 0.8) continue;
      const radius = 1.65 + jitter * 0.55;
      const route = distanceToIslandRoute(blueprint, { x, z });
      if (route < clearance + radius + 0.45) continue;
      if (
        Math.hypot(x - blueprint.hero.x, z - blueprint.hero.z) <
        blueprint.hero.radius + radius + 0.8
      )
        continue;
      if (
        blueprint.nodes.some(
          (n) => Math.hypot(n.x - x, n.z - z) < blueprint.route.nodeRadius + radius + 0.8,
        )
      )
        continue;
      // Canopies may shade a low bed; solid trunks and all other footprints
      // must remain clear. Every actual member still receives the full gate.
      if (
        occupied.some(
          (p) =>
            Math.hypot(p.x - x, p.z - z) <
            (p.kind === "tree" ? (p.height ?? 0) * 0.14 : p.radius) + radius + 0.2,
        )
      )
        continue;
      const supported = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return sampleIslandField(field, x + Math.cos(a) * radius, z + Math.sin(a) * radius).inside;
      }).every(Boolean);
      if (!supported) continue;
      const treeDistance = trees.reduce(
        (best, p) => Math.min(best, Math.hypot(x - p.x, z - p.z)),
        Infinity,
      );
      candidates.push({
        id,
        x,
        z,
        radius,
        count: 8,
        meadow: true,
        sheltered: treeDistance < 7,
        score:
          s.grass * 1.4 - s.rock * 0.7 - Math.abs(route - clearance - 5) * 0.045 + jitter * 0.28,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const beds: MeadowBed[] = [];
  for (const site of candidates) {
    if (beds.length >= quota) break;
    // Empty intervals are part of the composition, not unused capacity.
    if (beds.some((p) => Math.hypot(p.x - site.x, p.z - site.z) < p.radius + site.radius + 3))
      continue;
    beds.push(site);
  }
  return beds;
}
