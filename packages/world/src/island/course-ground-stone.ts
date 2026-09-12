import type { IslandBlueprint } from "./island-blueprint.js";
import type { IslandDressingPlacement, IslandDressingPlan } from "./island-dressing.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { miniatureMetrics } from "./miniature-layout.js";
import { worldSizeForAsset } from "./island-composition.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";

export function isCourseGroundStone(p: IslandDressingPlacement): boolean {
  return p.kind === "rock" && p.packId === "nature-kit" && p.id.startsWith("nature-");
}

/** Replace only ambient flat donor slabs, not semantic seating/landmarks.
 * The rounded shared kit fits INSIDE the old proved footprint and keeps the
 * target height. Ground its entire foot anew on actual course triangles.
 */
export function courseGroundStones(blueprint: IslandBlueprint, dressing: IslandDressingPlan) {
  const metrics = miniatureMetrics("stone");
  return dressing.placements.filter(isCourseGroundStone).flatMap((p) => {
    const donor = worldSizeForAsset(p.assetId, p.height);
    const original = p.height / metrics.height;
    // Use the space already proved for a broad donor slab to make a legible
    // rounded anchor, not a handful of tiny replacement crumbs. The complete
    // new circle stays inside that original rectangle in every orientation.
    const grown = Math.min(original * 1.65, (Math.min(donor.x, donor.z) * 0.49) / metrics.radius);
    for (const size of [Math.max(original, grown), original]) {
      const radius = metrics.radius * size,
        height = metrics.height * size;
      if (
        distanceToIslandRoute(blueprint, p) <
        islandRouteClearance(blueprint) + radius + height * 0.7
      )
        continue;
      if (
        blueprint.nodes.some(
          (n) =>
            Math.hypot(n.x - p.x, n.z - p.z) < blueprint.route.nodeRadius + radius + height * 0.7,
        )
      )
        continue;
      const ground = islandTerrainFootprintRange(
        blueprint,
        landscapeFootprint(p.x, p.z, radius),
        "course",
      );
      if (!ground || ground.maxY - ground.minY > Math.min(0.25, height * 0.65)) continue;
      return [
        {
          id: p.id,
          x: p.x,
          z: p.z,
          y: ground.minY - 0.016,
          turn: p.turn,
          size,
          radius,
          height,
          groundRange: [ground.minY, ground.maxY] as const,
        },
      ];
    }
    return [];
  });
}
export type CourseGroundStone = ReturnType<typeof courseGroundStones>[number];
