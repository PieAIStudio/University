import type { IslandBlueprint, IslandPoint } from "./island-blueprint.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
import { placementFootprintRadius, type IslandDressingPlan } from "./island-dressing.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { miniatureMetrics } from "./miniature-layout.js";
import { landscapeFootprint } from "./course-outcrop-plan.js";
import { overlapsCourseSpring } from "./course-spring-plan.js";

export interface CourseGardenEdge extends IslandPoint {
  readonly id: string;
  readonly anchorId: string;
  readonly y: number;
  readonly turn: number;
  readonly size: number;
  readonly radius: number;
  readonly groundRange: readonly [number, number];
}

/** Two open sides of a real courtyard, not a fence around every object. These
 * optional companions never move/remove existing scenery. The empty entrance
 * faces the actual nearby walk and each whole solid must fit before emission.
 */
export function courseGardenEdges(blueprint: IslandBlueprint, dressing: IslandDressingPlan) {
  const edges: CourseGardenEdge[] = [];
  if (!blueprint.themeSelection.accentPackIds.includes("fantasy-town-kit")) return edges;
  const field = islandFieldFor(blueprint),
    clear = islandRouteClearance(blueprint);
  const metrics = miniatureMetrics("fence");
  const anchors = dressing.placements.filter((p) =>
    ["wall-doorway-square", "stall"].includes(p.assetId),
  );
  for (const anchor of anchors) {
    if (edges.length >= 6) break;
    const route = blueprint.centerline.reduce(
      (best, p) =>
        Math.hypot(p.x - anchor.x, p.z - anchor.z) <
        Math.hypot(best.x - anchor.x, best.z - anchor.z)
          ? p
          : best,
      blueprint.centerline[0]!,
    );
    const reach = Math.hypot(anchor.x - route.x, anchor.z - route.z);
    if (reach < 0.01) continue;
    const nx = (anchor.x - route.x) / reach,
      nz = (anchor.z - route.z) / reach;
    const tx = -nz,
      tz = nx;
    for (const side of [-1, 1]) {
      let found = false;
      for (const size of [1.8, 1.45]) {
        const radius = metrics.radius * size,
          height = metrics.height * size;
        for (const away of [0.4, 1.1, -0.35])
          for (const spread of [1.3, 2, 2.7]) {
            if (found) break;
            const width = placementFootprintRadius(anchor) + radius + spread;
            const point = {
              x: anchor.x + tx * width * side + nx * away,
              z: anchor.z + tz * width * side + nz * away,
            };
            const sample = sampleIslandField(field, point.x, point.z);
            if (!sample.inside || sample.shore > 0.83) continue;
            if (distanceToIslandRoute(blueprint, point) < clear + radius + height * 0.7) continue;
            if (
              blueprint.nodes.some(
                (p) =>
                  Math.hypot(p.x - point.x, p.z - point.z) <
                  blueprint.route.nodeRadius + radius + 0.6,
              )
            )
              continue;
            if (
              Math.hypot(blueprint.hero.x - point.x, blueprint.hero.z - point.z) <
              blueprint.hero.radius + radius + 0.4
            )
              continue;
            if (
              dressing.placements.some(
                (p) =>
                  Math.hypot(p.x - point.x, p.z - point.z) <
                  placementFootprintRadius(p) + radius + 0.16,
              )
            )
              continue;
            if (
              dressing.landscape?.outcrops.some(
                (p) => Math.hypot(p.x - point.x, p.z - point.z) < p.radius + radius + 0.2,
              )
            )
              continue;
            if (
              dressing.landscape?.spring &&
              overlapsCourseSpring(dressing.landscape.spring, point, radius)
            )
              continue;
            if (
              edges.some((p) => Math.hypot(p.x - point.x, p.z - point.z) < p.radius + radius + 0.2)
            )
              continue;
            const ground = islandTerrainFootprintRange(
              blueprint,
              landscapeFootprint(point.x, point.z, radius),
              "course",
            );
            if (!ground || ground.maxY - ground.minY > 0.12) continue;
            edges.push({
              ...point,
              id: `garden-edge/${anchor.id}/${side}`,
              anchorId: anchor.id,
              y: ground.minY - 0.012,
              turn: -Math.atan2(nz, nx),
              size,
              radius,
              groundRange: [ground.minY, ground.maxY],
            });
            found = true;
          }
        if (found) break;
      }
    }
  }
  return edges;
}
